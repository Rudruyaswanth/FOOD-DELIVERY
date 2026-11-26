import {ArrowRight, RefreshCw} from 'lucide-react';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {mongoApi} from '../api/client';
import type {FoodOrderDoc, FoodOrderItem, FoodOrderStatus, MenuItemDoc} from '../types/mongo';
import {formatRupees} from '../utils/currency';

interface KitchenQueueViewProps {
  onOrderUpdated: () => void;
}

const NEXT_STATUS: Record<FoodOrderStatus, {next: FoodOrderStatus; label: string; eta: number} | null> = {
  confirmed: {next: 'preparing', label: 'Start Preparing', eta: 18},
  preparing: {next: 'out_for_delivery', label: 'Dispatch Courier', eta: 9},
  out_for_delivery: {next: 'delivered', label: 'Mark Delivered', eta: 0},
  delivered: null,
};

export function KitchenQueueView({onOrderUpdated}: KitchenQueueViewProps) {
  const [orders, setOrders] = useState<FoodOrderDoc[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'active' | FoodOrderStatus | 'all'>('active');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordRes, menuRes] = await Promise.all([
        mongoApi.queryDocuments({
          db: 'food_delivery',
          collection: 'orders',
          filter: '{}',
          projection: '{}',
          sort: '{"createdAt": -1}',
          skip: 0,
          limit: 100,
        }),
        mongoApi.queryDocuments({
          db: 'food_delivery',
          collection: 'menu_items',
          filter: '{}',
          projection: '{}',
          sort: '{"restaurantName": 1}',
          skip: 0,
          limit: 100,
        }),
      ]);

      setOrders(
        ordRes.documents.map((d) => ({
          _id: String(d._id ?? ''),
          orderNumber: String(d.orderNumber ?? ''),
          restaurantName: String(d.restaurantName ?? ''),
          customerName: String(d.customerName ?? ''),
          customerEmail: String(d.customerEmail ?? ''),
          deliveryAddress: String(d.deliveryAddress ?? ''),
          items: Array.isArray(d.items) ? (d.items as FoodOrderItem[]) : [],
          subtotal: Number(d.subtotal ?? 0),
          deliveryFee: Number(d.deliveryFee ?? 0),
          total: Number(d.total ?? 0),
          status: (d.status as FoodOrderStatus) || 'confirmed',
          estimatedMinutes: Number(d.estimatedMinutes ?? 15),
          createdAt: String(d.createdAt ?? ''),
          updatedAt: String(d.updatedAt ?? ''),
        })),
      );

      setMenuItems(
        menuRes.documents.map((m) => ({
          _id: String(m._id ?? ''),
          sku: String(m.sku ?? ''),
          restaurantId: String(m.restaurantId ?? ''),
          restaurantName: String(m.restaurantName ?? ''),
          title: String(m.title ?? ''),
          description: String(m.description ?? ''),
          category: String(m.category ?? ''),
          price: Number(m.price ?? 0),
          dietaryTags: Array.isArray(m.dietaryTags) ? (m.dietaryTags as MenuItemDoc['dietaryTags']) : [],
          customOptions: Array.isArray(m.customOptions) ? (m.customOptions as MenuItemDoc['customOptions']) : [],
          prepMinutes: Number(m.prepMinutes ?? 15),
          available: m.available !== false,
          imageKey: String(m.imageKey ?? ''),
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load kitchen queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const counts = useMemo(() => {
    const confirmed = orders.filter((o) => o.status === 'confirmed').length;
    const preparing = orders.filter((o) => o.status === 'preparing').length;
    const courier = orders.filter((o) => o.status === 'out_for_delivery').length;
    const delivered = orders.filter((o) => o.status === 'delivered').length;
    return {active: confirmed + preparing + courier, confirmed, preparing, courier, delivered};
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'all') return orders;
    if (statusFilter === 'active') return orders.filter((o) => o.status !== 'delivered');
    return orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  const advanceOrder = async (order: FoodOrderDoc) => {
    const transition = NEXT_STATUS[order.status];
    if (!transition) return;
    setUpdatingId(order._id);
    setError(null);
    const updatedAt = new Date().toISOString();
    try {
      const payload = {
        orderNumber: order.orderNumber,
        restaurantName: order.restaurantName,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        deliveryAddress: order.deliveryAddress,
        items: order.items,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        total: order.total,
        status: transition.next,
        estimatedMinutes: transition.eta,
        createdAt: order.createdAt,
        updatedAt,
      };
      await mongoApi.updateDocument('food_delivery', 'orders', order._id, JSON.stringify(payload));
      setOrders((prev) =>
        prev.map((o) =>
          o._id === order._id
            ? {...o, status: transition.next, estimatedMinutes: transition.eta, updatedAt}
            : o,
        ),
      );
      onOrderUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to advance kitchen ticket');
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleDishAvailability = async (item: MenuItemDoc) => {
    setError(null);
    const nextAvail = !item.available;
    try {
      const payload = {
        sku: item.sku,
        restaurantId: item.restaurantId,
        restaurantName: item.restaurantName,
        title: item.title,
        description: item.description,
        category: item.category,
        price: item.price,
        dietaryTags: item.dietaryTags,
        customOptions: item.customOptions,
        prepMinutes: item.prepMinutes,
        available: nextAvail,
        imageKey: item.imageKey,
      };
      await mongoApi.updateDocument('food_delivery', 'menu_items', item._id, JSON.stringify(payload));
      setMenuItems((prev) => prev.map((m) => (m._id === item._id ? {...m, available: nextAvail} : m)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update dish availability');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-10">
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Kitchen Queue</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Advance live food preparation tickets stored in <code className="font-mono">food_delivery.orders</code>
              </p>
            </div>
            <button
              type="button"
              onClick={loadQueue}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Queue
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 border border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-slate-900 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
            <div className="p-4 space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">Open Tickets</p>
              <p className="text-2xl font-semibold font-mono tabular-nums">{counts.active}</p>
            </div>
            <div className="p-4 space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">Confirmed</p>
              <p className="text-2xl font-semibold font-mono tabular-nums text-amber-600 dark:text-amber-400">
                {counts.confirmed}
              </p>
            </div>
            <div className="p-4 space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">Preparing</p>
              <p className="text-2xl font-semibold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                {counts.preparing}
              </p>
            </div>
            <div className="p-4 space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">Out for Delivery</p>
              <p className="text-2xl font-semibold font-mono tabular-nums">{counts.courier}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-md w-fit">
            {(
              [
                {id: 'active', label: 'Active Queue'},
                {id: 'confirmed', label: 'Confirmed'},
                {id: 'preparing', label: 'Preparing'},
                {id: 'out_for_delivery', label: 'Out for Delivery'},
                {id: 'delivered', label: 'Completed'},
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {filteredOrders.length === 0 ? (
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 p-10 text-center text-xs text-slate-500 dark:text-slate-400">
              {loading ? 'Loading tickets...' : 'No tickets in this queue.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredOrders.map((order) => {
                const transition = NEXT_STATUS[order.status];
                return (
                  <div
                    key={order._id}
                    className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <p className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {order.orderNumber}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{order.restaurantName}</p>
                        </div>
                        <span className="text-xs font-medium capitalize text-emerald-700 dark:text-emerald-400">
                          {order.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div className="space-y-2 text-xs">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="space-y-0.5">
                            <p className="font-medium text-slate-900 dark:text-slate-100">
                              {item.qty} &times; {item.title}
                            </p>
                            {item.selectedOptions?.length > 0 && (
                              <p className="text-slate-500 dark:text-slate-400">{item.selectedOptions.join(' · ')}</p>
                            )}
                            {item.notes && (
                              <p className="text-amber-700 dark:text-amber-400 font-medium">Note: {item.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
                        <p className="text-slate-800 dark:text-slate-200 font-medium">{order.customerName}</p>
                        <p className="truncate">{order.deliveryAddress}</p>
                      </div>

                      {transition ? (
                        <button
                          type="button"
                          disabled={updatingId === order._id}
                          onClick={() => advanceOrder(order)}
                          className="w-full py-2 px-3.5 text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white rounded-md inline-flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                          {transition.label}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <p className="text-center text-xs text-slate-400 py-1.5">Completed</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Menu Availability</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Toggle dish stock status directly in <code className="font-mono">food_delivery.menu_items</code>
            </p>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-slate-900 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400">
                  <th className="px-4 py-2.5 font-medium">Dish</th>
                  <th className="px-4 py-2.5 font-medium">Kitchen</th>
                  <th className="px-4 py-2.5 font-medium text-right">Price</th>
                  <th className="px-4 py-2.5 font-medium text-right">Availability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {menuItems.map((item) => (
                  <tr key={item._id} className="h-10 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">{item.title}</td>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{item.restaurantName}</td>
                    <td className="px-4 py-2 font-mono text-right tabular-nums">{formatRupees(item.price)}</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => toggleDishAvailability(item)}
                        className={`px-2.5 py-1 text-xs font-medium rounded border cursor-pointer ${
                          item.available
                            ? 'border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                            : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {item.available ? 'In Stock' : 'Sold Out'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
