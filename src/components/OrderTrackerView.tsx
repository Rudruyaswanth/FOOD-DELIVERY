import {Check, ChefHat, Clock, MapPin, RefreshCw, Truck} from 'lucide-react';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {mongoApi} from '../api/client';
import type {FoodOrderDoc, FoodOrderItem, FoodOrderStatus} from '../types/mongo';
import {formatRupees} from '../utils/currency';

interface OrderTrackerViewProps {
  selectedOrderNumber: string | null;
  onSelectOrderNumber: (orderNumber: string) => void;
}

const STAGES: Array<{
  id: FoodOrderStatus;
  label: string;
  description: string;
}> = [
  {id: 'confirmed', label: 'Order Confirmed', description: 'Ticket received by partner kitchen'},
  {id: 'preparing', label: 'Preparing in Kitchen', description: 'Chefs are cooking and plating your dishes'},
  {id: 'out_for_delivery', label: 'Out for Delivery', description: 'Courier is en route to your address'},
  {id: 'delivered', label: 'Delivered', description: 'Order arrived at your doorstep'},
];

export function OrderTrackerView({selectedOrderNumber, onSelectOrderNumber}: OrderTrackerViewProps) {
  const [orders, setOrders] = useState<FoodOrderDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setError(null);
    try {
      const res = await mongoApi.queryDocuments({
        db: 'food_delivery',
        collection: 'orders',
        filter: '{}',
        projection: '{}',
        sort: '{"createdAt": -1}',
        skip: 0,
        limit: 50,
      });

      const mapped: FoodOrderDoc[] = res.documents.map((d) => ({
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
      }));
      setOrders(mapped);
      if (!selectedOrderNumber && mapped[0]) {
        onSelectOrderNumber(mapped[0].orderNumber);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load orders');
    } finally {
      setLoading(false);
    }
  }, [selectedOrderNumber, onSelectOrderNumber]);

  useEffect(() => {
    loadOrders();
    const timer = setInterval(loadOrders, 5000);
    return () => clearInterval(timer);
  }, [loadOrders]);

  const activeOrder = useMemo(() => {
    if (orders.length === 0) return null;
    return orders.find((o) => o.orderNumber === selectedOrderNumber) ?? orders[0];
  }, [orders, selectedOrderNumber]);

  const activeStageIdx = activeOrder ? STAGES.findIndex((s) => s.id === activeOrder.status) : 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Track Order</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live status updates synced automatically from kitchen operations
            </p>
          </div>
          <button
            type="button"
            onClick={loadOrders}
            className="px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {loading && orders.length === 0 ? (
          <div className="h-64 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 animate-pulse" />
        ) : !activeOrder ? (
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 p-12 text-center space-y-2">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">No active orders found</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Place an order from the storefront to track live kitchen progress here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-4 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-600 dark:text-slate-400">
                Recent Orders ({orders.length})
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {orders.map((order) => {
                  const isSelected = order.orderNumber === activeOrder.orderNumber;
                  return (
                    <button
                      key={order._id}
                      type="button"
                      onClick={() => onSelectOrderNumber(order.orderNumber)}
                      className={`w-full px-4 py-3.5 text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/40'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {order.orderNumber}
                        </span>
                        <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                          {formatRupees(order.total)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                        {order.restaurantName} · {order.status.replace(/_/g, ' ')}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-8 space-y-6">
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 p-6 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      Order {activeOrder.orderNumber} · {activeOrder.restaurantName}
                    </p>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mt-1">
                      {STAGES[Math.max(0, activeStageIdx)].label}
                    </h2>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Estimated Arrival</p>
                    <p className="text-lg font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
                      {activeOrder.status === 'delivered' ? 'Arrived' : `${activeOrder.estimatedMinutes} min`}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  {STAGES.map((stage, idx) => {
                    const completed = idx <= activeStageIdx;
                    const current = idx === activeStageIdx;
                    return (
                      <div key={stage.id} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono shrink-0 ${
                              completed
                                ? 'bg-emerald-700 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                            }`}
                          >
                            {completed ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                          </div>
                          <div
                            className={`h-0.5 flex-1 ${
                              idx < activeStageIdx
                                ? 'bg-emerald-700'
                                : 'bg-slate-200 dark:bg-slate-800'
                            }`}
                          />
                        </div>
                        <div>
                          <p
                            className={`text-xs font-semibold ${
                              current
                                ? 'text-emerald-800 dark:text-emerald-400'
                                : completed
                                  ? 'text-slate-900 dark:text-slate-100'
                                  : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {stage.label}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{stage.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {activeOrder.deliveryAddress}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ChefHat className="w-3.5 h-3.5 text-slate-400" />
                    {activeOrder.restaurantName}
                  </span>
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    {activeOrder.status === 'out_for_delivery' ? (
                      <Truck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    Updated {activeOrder.updatedAt ? new Date(activeOrder.updatedAt).toLocaleTimeString() : 'just now'}
                  </span>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 p-6 space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Order Receipt</h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {activeOrder.items.map((item, idx) => (
                    <div key={idx} className="py-3 flex items-start justify-between gap-4">
                      <div className="space-y-0.5">
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {item.qty} &times; {item.title}
                        </p>
                        {item.selectedOptions?.length > 0 && (
                          <p className="text-slate-500 dark:text-slate-400">{item.selectedOptions.join(' · ')}</p>
                        )}
                        {item.notes && <p className="italic text-slate-500 dark:text-slate-400">Note: {item.notes}</p>}
                      </div>
                      <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                        {formatRupees(Number(item.lineTotal))}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>Subtotal</span>
                    <span className="font-mono tabular-nums">{formatRupees(activeOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>Delivery Fee</span>
                    <span className="font-mono tabular-nums">
                      {activeOrder.deliveryFee === 0 ? 'Free' : formatRupees(activeOrder.deliveryFee)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-slate-900 dark:text-slate-100 pt-1">
                    <span>Total Paid</span>
                    <span className="font-mono tabular-nums">{formatRupees(activeOrder.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
