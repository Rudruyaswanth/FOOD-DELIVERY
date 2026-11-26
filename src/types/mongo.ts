export type ConnectionMode = 'live' | 'sandbox';

export interface ConnectionStatus {
  mode: ConnectionMode;
  targetUri: string;
  maskedUri: string;
  connected: boolean;
  serverVersion: string;
  hostLabel: string;
  lastError: string | null;
  checkedAt: string;
}

export interface CollectionSummary {
  name: string;
  count: number;
  storageSizeBytes: number;
  avgObjSizeBytes: number;
  indexCount: number;
}

export interface DatabaseSummary {
  name: string;
  sizeOnDiskBytes: number;
  collections: CollectionSummary[];
}

export interface QueryDocumentsRequest {
  db: string;
  collection: string;
  filter?: string;
  projection?: string;
  sort?: string;
  skip?: number;
  limit?: number;
}

export interface QueryDocumentsResponse {
  documents: Record<string, unknown>[];
  totalCount: number;
  executionMs: number;
  mode: ConnectionMode;
}

export interface AggregationStage {
  id: string;
  operator: '$match' | '$group' | '$sort' | '$project' | '$limit' | '$skip' | '$unwind' | '$count';
  body: string;
  enabled: boolean;
}

export interface AggregationResponse {
  results: Record<string, unknown>[];
  executionMs: number;
  mode: ConnectionMode;
}

export interface SchemaFieldTypeStat {
  type: string;
  count: number;
  percentage: number;
}

export interface SchemaFieldSummary {
  field: string;
  presenceCount: number;
  presencePercentage: number;
  types: SchemaFieldTypeStat[];
  samples: string[];
}

export interface SchemaAnalysisResponse {
  sampledCount: number;
  totalCount: number;
  fields: SchemaFieldSummary[];
}

export interface IndexSummary {
  name: string;
  key: Record<string, 1 | -1 | 'text'>;
  unique: boolean;
  sparse?: boolean;
}

export interface ShellExecuteResponse {
  ok: boolean;
  command: string;
  output: unknown;
  executionMs: number;
  error?: string;
}

export type DietaryTag = 'vegetarian' | 'vegan' | 'gluten-free' | 'spicy';

export type FoodOrderStatus = 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered';

export interface DishChoice {
  label: string;
  priceDelta: number;
}

export interface DishOptionGroup {
  name: string;
  required: boolean;
  multiSelect: boolean;
  choices: DishChoice[];
}

export interface RestaurantDoc {
  _id: string;
  slug: string;
  name: string;
  cuisine: string;
  prepTimeMins: number;
  deliveryFee: number;
  rating: number;
  address: string;
  isOpen: boolean;
}

export interface MenuItemDoc {
  _id: string;
  sku: string;
  restaurantId: string;
  restaurantName: string;
  title: string;
  description: string;
  category: string;
  price: number;
  dietaryTags: DietaryTag[];
  customOptions: DishOptionGroup[];
  prepMinutes: number;
  available: boolean;
  imageKey: string;
}

export interface FoodOrderItem {
  sku: string;
  title: string;
  qty: number;
  unitPrice: number;
  selectedOptions: string[];
  notes: string;
  lineTotal: number;
}

export interface FoodOrderDoc {
  _id: string;
  orderNumber: string;
  restaurantName: string;
  customerName: string;
  customerEmail: string;
  deliveryAddress: string;
  items: FoodOrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: FoodOrderStatus;
  estimatedMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDoc {
  _id: string;
  name: string;
  email: string;
  phone: string;
  defaultAddress: string;
}
