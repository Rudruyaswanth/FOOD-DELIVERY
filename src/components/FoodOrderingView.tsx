import {CheckCircle2, Clock, Minus, Plus, Search, ShoppingBag, Star, UtensilsCrossed, X} from 'lucide-react';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {mongoApi} from '../api/client';
import type {CustomerDoc, DietaryTag, DishOptionGroup, FoodOrderItem, MenuItemDoc, RestaurantDoc} from '../types/mongo';
import {formatRupees} from '../utils/currency';

interface BagEntry {
  key: string;
  item: MenuItemDoc;
  qty: number;
  selectedOptions: string[];
  unitPrice: number;
  notes: string;
}

interface FoodOrderingViewProps {
  onOrderCreated: (orderNumber: string) => void;
  onTrackLatest: () => void;
  onOpenStudio: () => void;
}

const HERO_SPREAD = '/src/assets/images/bistro_hero_spread_1795675764234.jpg';

const DISH_IMAGES: Record<string, string> = {
  'truffle-gnocchi': '/src/assets/images/dish_truffle_gnocchi_1795675764039.jpg',
  'harvest-bowl': '/src/assets/images/dish_harvest_bowl_1795675764739.jpg',
  'spicy-ramen': '/src/assets/images/dish_spicy_ramen_1795675764919.jpg',
  'sourdough-pizza': '/src/assets/images/dish_sourdough_pizza_1795675765173.jpg',
  'salmon-poke': '/src/assets/images/dish_salmon_poke_1795675765884.jpg',
  'matcha-tiramisu': '/src/assets/images/dish_matcha_tiramisu_1795675766206.jpg',
};

const DIETARY_FILTERS: Array<{id: 'all' | DietaryTag; label: string}> = [
  {id: 'all', label: 'All Dishes'},
  {id: 'vegetarian', label: 'Vegetarian'},
  {id: 'vegan', label: 'Vegan'},
  {id: 'gluten-free', label: 'Gluten-Free'},
  {id: 'spicy', label: 'Spicy'},
];

function DishImage({imageKey, title}: {imageKey: string; title: string}) {
  const [failed, setFailed] = useState(false);
  const src = DISH_IMAGES[imageKey];

  if (!src || failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-stone-100 dark:bg-slate-800 text-slate-400">
        <UtensilsCrossed className="w-8 h-8 stroke-[1.5]" />
        <span className="text-xs font-medium">{title}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={title}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
    />
  );
}

export function FoodOrderingView({onOrderCreated, onTrackLatest, onOpenStudio}: FoodOrderingViewProps) {
  const [restaurants, setRestaurants] = useState<RestaurantDoc[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemDoc[]>([]);
  const [customers, setCustomers] = useState<CustomerDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedRestaurant, setSelectedRestaurant] = useState<string>('all');
  const [dietaryFilter, setDietaryFilter] = useState<'all' | DietaryTag>('all');
  const [search, setSearch] = useState('');
  const [heroFailed, setHeroFailed] = useState(false);

  const [customizing, setCustomizing] = useState<MenuItemDoc | null>(null);
  const [singleChoices, setSingleChoices] = useState<Record<string, string>>({});
  const [multiChoices, setMultiChoices] = useState<Record<string, string[]>>({});
  const [dishNotes, setDishNotes] = useState('');
  const [dishQty, setDishQty] = useState(1);

  const [bag, setBag] = useState<BagEntry[]>([]);
  const [bagOpen, setBagOpen] = useState(false);
  const [customerName, setCustomerName] = useState('Elena Rostova');
  const [customerEmail, setCustomerEmail] = useState('elena.rostova@example.com');
  const [deliveryAddress, setDeliveryAddress] = useState('215 Maplewood Ave, Apt 4B');
  const [placing, setPlacing] = useState(false);
  const [confirmedOrderNum, setConfirmedOrderNum] = useState<string | null>(null);

  const loadStorefront = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [restRes, menuRes, custRes] = await Promise.all([
        mongoApi.queryDocuments({
          db: 'food_delivery',
          collection: 'restaurants',
          filter: '{}',
          projection: '{}',
          sort: '{"name": 1}',
          skip: 0,
          limit: 50,
        }),
        mongoApi.queryDocuments({
          db: 'food_delivery',
          collection: 'menu_items',
          filter: '{}',
          projection: '{}',
          sort: '{"sku": 1}',
          skip: 0,
          limit: 100,
        }),
        mongoApi
          .queryDocuments({
            db: 'food_delivery',
            collection: 'customers',
            filter: '{}',
            projection: '{}',
            sort: '{"name": 1}',
            skip: 0,
            limit: 50,
          })
          .catch(() => ({documents: []})),
      ]);

      setRestaurants(
        restRes.documents.map((r) => ({
          _id: String(r._id ?? ''),
          slug: String(r.slug ?? ''),
          name: String(r.name ?? ''),
          cuisine: String(r.cuisine ?? ''),
          prepTimeMins: Number(r.prepTimeMins ?? 20),
          deliveryFee: Number(r.deliveryFee ?? 0),
          rating: Number(r.rating ?? 4.8),
          address: String(r.address ?? ''),
          isOpen: r.isOpen !== false,
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
          category: String(m.category ?? 'Mains'),
          price: Number(m.price ?? 0),
          dietaryTags: Array.isArray(m.dietaryTags) ? (m.dietaryTags as DietaryTag[]) : [],
          customOptions: Array.isArray(m.customOptions) ? (m.customOptions as DishOptionGroup[]) : [],
          prepMinutes: Number(m.prepMinutes ?? 15),
          available: m.available !== false,
          imageKey: String(m.imageKey ?? ''),
        })),
      );

      const loadedCust = custRes.documents.map((c) => ({
        _id: String(c._id ?? ''),
        name: String(c.name ?? ''),
        email: String(c.email ?? ''),
        phone: String(c.phone ?? ''),
        defaultAddress: String(c.defaultAddress ?? ''),
      }));
      setCustomers(loadedCust);
      if (loadedCust[0]) {
        setCustomerName(loadedCust[0].name);
        setCustomerEmail(loadedCust[0].email);
        setDeliveryAddress(loadedCust[0].defaultAddress);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load restaurants and menus');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStorefront();
  }, [loadStorefront]);

  const filteredDishes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menuItems.filter((item) => {
      const restOk = selectedRestaurant === 'all' || item.restaurantId === selectedRestaurant;
      const dietOk = dietaryFilter === 'all' || item.dietaryTags.includes(dietaryFilter);
      const searchOk =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.restaurantName.toLowerCase().includes(q);
      return restOk && dietOk && searchOk;
    });
  }, [menuItems, selectedRestaurant, dietaryFilter, search]);

  const openCustomizer = (item: MenuItemDoc) => {
    const initSingle: Record<string, string> = {};
    const initMulti: Record<string, string[]> = {};
    for (const group of item.customOptions) {
      if (!group.multiSelect && group.choices[0]) {
        initSingle[group.name] = group.choices[0].label;
      } else if (group.multiSelect) {
        initMulti[group.name] = [];
      }
    }
    setSingleChoices(initSingle);
    setMultiChoices(initMulti);
    setDishNotes('');
    setDishQty(1);
    setCustomizing(item);
  };

  const customizedUnitPrice = useMemo(() => {
    if (!customizing) return 0;
    let total = customizing.price;
    for (const group of customizing.customOptions) {
      if (!group.multiSelect) {
        const chosen = singleChoices[group.name];
        const match = group.choices.find((c) => c.label === chosen);
        if (match) total += match.priceDelta;
      } else {
        const chosenList = multiChoices[group.name] ?? [];
        for (const label of chosenList) {
          const match = group.choices.find((c) => c.label === label);
          if (match) total += match.priceDelta;
        }
      }
    }
    return Number(total.toFixed(2));
  }, [customizing, singleChoices, multiChoices]);

  const handleConfirmAddDish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customizing) return;
    const selectedOptions: string[] = [];
    for (const group of customizing.customOptions) {
      if (!group.multiSelect && singleChoices[group.name]) {
        selectedOptions.push(singleChoices[group.name]);
      } else if (group.multiSelect) {
        selectedOptions.push(...(multiChoices[group.name] ?? []));
      }
    }
    const cleanNotes = dishNotes.trim();
    const key = `${customizing._id}|${selectedOptions.join(',')}|${cleanNotes}`;

    setConfirmedOrderNum(null);
    setBag((prev) => {
      const existing = prev.find((entry) => entry.key === key);
      if (existing) {
        return prev.map((entry) => (entry.key === key ? {...entry, qty: entry.qty + dishQty} : entry));
      }
      return [
        ...prev,
        {
          key,
          item: customizing,
          qty: dishQty,
          selectedOptions,
          unitPrice: customizedUnitPrice,
          notes: cleanNotes,
        },
      ];
    });
    setCustomizing(null);
    setBagOpen(true);
  };

  const bagCount = useMemo(() => bag.reduce((s, e) => s + e.qty, 0), [bag]);
  const bagSubtotal = useMemo(() => bag.reduce((s, e) => s + e.unitPrice * e.qty, 0), [bag]);

  const bagDeliveryFee = useMemo(() => {
    if (bag.length === 0) return 0;
    const primaryRest = restaurants.find((r) => r._id === bag[0].item.restaurantId);
    return primaryRest ? primaryRest.deliveryFee : 49;
  }, [bag, restaurants]);

  const bagTotal = Number((bagSubtotal + bagDeliveryFee).toFixed(2));

  const updateBagQty = (key: string, delta: number) => {
    setBag((prev) =>
      prev.map((e) => (e.key === key ? {...e, qty: e.qty + delta} : e)).filter((e) => e.qty > 0),
    );
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bag.length === 0) return;
    setPlacing(true);
    setError(null);
    const start = performance.now();
    try {
      const orderNumber = `FD-${Math.floor(4900 + Math.random() * 5000)}`;
      const nowIso = new Date().toISOString();
      const restaurantNames = Array.from(new Set(bag.map((b) => b.item.restaurantName))).join(' + ');
      const maxPrep = Math.max(...bag.map((b) => b.item.prepMinutes), 15);

      const items: FoodOrderItem[] = bag.map((b) => ({
        sku: b.item.sku,
        title: b.item.title,
        qty: b.qty,
        unitPrice: b.unitPrice,
        selectedOptions: b.selectedOptions,
        notes: b.notes,
        lineTotal: Number((b.unitPrice * b.qty).toFixed(2)),
      }));

      const orderDoc = {
        orderNumber,
        restaurantName: restaurantNames,
        customerName: customerName.trim() || 'Guest Diner',
        customerEmail: customerEmail.trim() || 'guest@example.com',
        deliveryAddress: deliveryAddress.trim() || '120 Market St',
        items,
        subtotal: Number(bagSubtotal.toFixed(2)),
        deliveryFee: bagDeliveryFee,
        total: bagTotal,
        currency: 'INR',
        status: 'confirmed',
        estimatedMinutes: maxPrep + 12,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await mongoApi.insertDocument('food_delivery', 'orders', JSON.stringify(orderDoc));

      await mongoApi
        .insertDocument(
          'telemetry_dev',
          'events',
          JSON.stringify({
            service: 'food-delivery-checkout',
            level: 'info',
            durationMs: Math.max(15, Math.round(performance.now() - start)),
            region: 'us-west-2',
            ts: nowIso,
          }),
        )
        .catch(() => {});

      setBag([]);
      setConfirmedOrderNum(orderNumber);
      onOrderCreated(orderNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to place delivery order');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <section className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-6 py-10 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-5 flex flex-col justify-between gap-6 py-2">
            <div className="space-y-4">
              <p className="text-xs font-medium text-emerald-800 dark:text-emerald-400">
                Local Kitchens · Fresh to Your Door
              </p>
              <h1 className="font-display text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-[1.12]">
                Seasonal bistro kitchens delivered hot in 25 minutes
              </h1>
              <p className="text-sm lg:text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-md">
                Customize every dish, filter by dietary preference, and follow live kitchen prep through doorstep drop-off.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a
                href="#menu-catalog"
                className="px-5 py-2.5 text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                Explore Menu
              </a>
              <button
                type="button"
                onClick={onTrackLatest}
                className="px-4 py-2.5 text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Track Active Order
              </button>
              <button
                type="button"
                onClick={onOpenStudio}
                className="px-3 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
              >
                View in MongoDB
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-stone-100 dark:bg-slate-800 min-h-[260px]">
            {heroFailed ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                Seasonal Bistro Spread
              </div>
            ) : (
              <img
                src={HERO_SPREAD}
                alt="Fresh wood-fired pizza and harvest grain bowl on limestone bistro table"
                referrerPolicy="no-referrer"
                onError={() => setHeroFailed(true)}
                className="w-full h-full lg:h-full object-cover"
              />
            )}
          </div>
        </div>
      </section>

      <section id="menu-catalog" className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Partner Kitchens</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {restaurants.length} kitchens open now
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              type="button"
              onClick={() => setSelectedRestaurant('all')}
              className={`p-4 text-left rounded-lg border transition-colors cursor-pointer ${
                selectedRestaurant === 'all'
                  ? 'border-emerald-700 bg-emerald-50/50 dark:border-emerald-500 dark:bg-emerald-950/30'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">All Partner Kitchens</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                {menuItems.length} dishes across all cuisines
              </p>
            </button>

            {restaurants.map((rest) => {
              const active = selectedRestaurant === rest._id;
              return (
                <button
                  key={rest._id}
                  type="button"
                  onClick={() => setSelectedRestaurant(active ? 'all' : rest._id)}
                  className={`p-4 text-left rounded-lg border transition-colors cursor-pointer ${
                    active
                      ? 'border-emerald-700 bg-emerald-50/50 dark:border-emerald-500 dark:bg-emerald-950/30'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{rest.name}</p>
                    <span className="inline-flex items-center gap-1 text-xs font-mono tabular-nums text-slate-700 dark:text-slate-300 shrink-0">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      {rest.rating.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                    {rest.cuisine} · {rest.prepTimeMins} min ·{' '}
                    {rest.deliveryFee === 0 ? 'Free delivery' : `${formatRupees(rest.deliveryFee)} fee`}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-md">
            {DIETARY_FILTERS.map((df) => (
              <button
                key={df.id}
                type="button"
                onClick={() => setDietaryFilter(df.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  dietaryFilter === df.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {df.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search dishes or cuisines"
                className="pl-8 pr-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <button
              type="button"
              onClick={() => setBagOpen(true)}
              className="px-4 py-2 text-xs font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-md hover:bg-slate-800 dark:hover:bg-white inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer tabular-nums"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              Bag ({bagCount})
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {Array.from({length: 6}).map((_, i) => (
              <div
                key={i}
                className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900 animate-pulse"
              >
                <div className="aspect-[4/3] bg-slate-200 dark:bg-slate-800" />
                <div className="p-5 space-y-3">
                  <div className="h-3 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-5 w-44 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-9 w-full bg-slate-200 dark:bg-slate-800 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredDishes.length === 0 ? (
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 p-12 text-center space-y-3">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              No dishes match the selected filters
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedRestaurant('all');
                setDietaryFilter('all');
                setSearch('');
              }}
              className="px-4 py-2 text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white rounded-md cursor-pointer"
            >
              Reset Menu Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {filteredDishes.map((item) => (
              <article
                key={item._id}
                className="group border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900 flex flex-col transition-transform duration-200 hover:-translate-y-0.5"
              >
                <div className="aspect-[4/3] overflow-hidden bg-stone-100 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
                  <DishImage imageKey={item.imageKey} title={item.title} />
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="truncate">{item.restaurantName}</span>
                      {item.dietaryTags.length > 0 && (
                        <span className="capitalize text-emerald-800 dark:text-emerald-400 shrink-0">
                          {item.dietaryTags.slice(0, 2).join(' · ')}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{item.title}</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
                      {item.description}
                    </p>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                        {formatRupees(item.price)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        <Clock className="w-3.5 h-3.5" />
                        {item.prepMinutes} min
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={!item.available}
                      onClick={() => openCustomizer(item)}
                      className="w-full py-2.5 px-4 text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white rounded-md transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      {item.available ? 'Customize & Add' : 'Sold Out'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {customizing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{customizing.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{customizing.restaurantName}</p>
              </div>
              <button
                type="button"
                onClick={() => setCustomizing(null)}
                aria-label="Close dish customization"
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmAddDish} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{customizing.description}</p>

              {customizing.customOptions.map((group) => (
                <div key={group.name} className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{group.name}</span>
                    <span className="text-slate-400">{group.required ? 'Required' : 'Optional'}</span>
                  </div>

                  <div className="space-y-1.5">
                    {group.choices.map((choice) => {
                      const isSelected = group.multiSelect
                        ? (multiChoices[group.name] ?? []).includes(choice.label)
                        : singleChoices[group.name] === choice.label;

                      return (
                        <label
                          key={choice.label}
                          className="flex items-center justify-between p-2.5 rounded-md border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                        >
                          <span className="flex items-center gap-2.5 text-slate-800 dark:text-slate-200">
                            <input
                              type={group.multiSelect ? 'checkbox' : 'radio'}
                              name={group.name}
                              checked={isSelected}
                              onChange={(e) => {
                                if (!group.multiSelect) {
                                  setSingleChoices((prev) => ({...prev, [group.name]: choice.label}));
                                } else {
                                  setMultiChoices((prev) => {
                                    const cur = prev[group.name] ?? [];
                                    const next = e.target.checked
                                      ? [...cur, choice.label]
                                      : cur.filter((l) => l !== choice.label);
                                    return {...prev, [group.name]: next};
                                  });
                                }
                              }}
                              className="accent-emerald-700"
                            />
                            {choice.label}
                          </span>
                          <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                            {choice.priceDelta > 0 ? `+${formatRupees(choice.priceDelta)}` : 'Included'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="block font-semibold text-slate-900 dark:text-slate-100">
                  Special Kitchen Instructions
                </label>
                <input
                  type="text"
                  value={dishNotes}
                  onChange={(e) => setDishNotes(e.target.value)}
                  placeholder="Allergies, dressing on side, extra napkins..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-between gap-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDishQty((q) => Math.max(1, q - 1))}
                    aria-label="Decrease dish quantity"
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-6 text-center font-mono text-sm tabular-nums">{dishQty}</span>
                  <button
                    type="button"
                    onClick={() => setDishQty((q) => q + 1)}
                    aria-label="Increase dish quantity"
                    className="p-2 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded-md transition-colors tabular-nums cursor-pointer"
                >
                  Add to Bag · {formatRupees(customizedUnitPrice * dishQty)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {bagOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                Delivery Bag ({bagCount})
              </h2>
              <button
                type="button"
                onClick={() => setBagOpen(false)}
                aria-label="Close delivery bag"
                className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {confirmedOrderNum && (
                <div className="p-4 rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4" />
                    Order {confirmedOrderNum} Confirmed
                  </div>
                  <p className="text-emerald-700 dark:text-emerald-300">
                    Sent to kitchen and saved to MongoDB.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setBagOpen(false);
                      onTrackLatest();
                    }}
                    className="px-3 py-1.5 bg-emerald-700 text-white rounded font-medium cursor-pointer"
                  >
                    Open Live Tracker
                  </button>
                </div>
              )}

              {bag.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Your delivery bag is empty</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Choose a dish from any kitchen and customize your order.
                  </p>
                </div>
              ) : (
                bag.map((entry) => (
                  <div
                    key={entry.key}
                    className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{entry.item.title}</p>
                      {entry.selectedOptions.length > 0 && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {entry.selectedOptions.join(' · ')}
                        </p>
                      )}
                      {entry.notes && (
                        <p className="text-xs italic text-slate-500 dark:text-slate-400">Note: {entry.notes}</p>
                      )}
                      <p className="text-xs font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                        {formatRupees(entry.unitPrice * entry.qty)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateBagQty(entry.key, -1)}
                        aria-label="Decrease quantity"
                        className="p-1.5 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-5 text-center text-xs font-mono tabular-nums">{entry.qty}</span>
                      <button
                        type="button"
                        onClick={() => updateBagQty(entry.key, 1)}
                        aria-label="Increase quantity"
                        className="p-1.5 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {bag.length > 0 && (
              <form
                onSubmit={handlePlaceOrder}
                className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-3.5 text-xs"
              >
                {customers.length > 0 && (
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Saved Diner Profile
                    </label>
                    <select
                      value={customerEmail}
                      onChange={(e) => {
                        const match = customers.find((c) => c.email === e.target.value);
                        if (match) {
                          setCustomerName(match.name);
                          setCustomerEmail(match.email);
                          setDeliveryAddress(match.defaultAddress);
                        } else {
                          setCustomerEmail(e.target.value);
                        }
                      }}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
                    >
                      {customers.map((c) => (
                        <option key={c._id} value={c.email}>
                          {c.name} · {c.defaultAddress}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Your Name</label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                    <input
                      type="email"
                      required
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Delivery Address</label>
                  <input
                    type="text"
                    required
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Street, Apt, Floor"
                    className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md"
                  />
                </div>

                <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Subtotal</span>
                    <span className="font-mono tabular-nums">{formatRupees(bagSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Delivery Fee</span>
                    <span className="font-mono tabular-nums">
                      {bagDeliveryFee === 0 ? 'Free' : formatRupees(bagDeliveryFee)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-slate-900 dark:text-slate-100 pt-1">
                    <span>Total</span>
                    <span className="font-mono tabular-nums">{formatRupees(bagTotal)}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={placing}
                  className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded-md transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {placing ? 'Submitting to Kitchen...' : `Place Delivery Order · ${formatRupees(bagTotal)}`}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
