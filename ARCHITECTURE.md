# Leafline — System Architecture (`ARCHITECTURE.md`)

**Leafline** is a full-stack online food delivery platform paired with an embedded **MongoDB Studio** workbench. It serves a diner storefront, live order tracking, a kitchen fulfillment queue, and a complete MongoDB explorer over a unified dual-mode backend (`mongodb` Node.js driver for MongoDB Atlas / local `mongod`, plus a persistent JSON-backed Local Sandbox engine).

---

## 1. High-Level Architecture

```
+-------------------------------------------------------------------+
|                        Browser Client (React 19)                  |
|  - Order Storefront (FoodOrderingView)                            |
|  - Live Order Tracker (OrderTrackerView, 5s polling)              |
|  - Kitchen Queue & Stock (KitchenQueueView)                       |
|  - MongoDB Studio (Sidebar, Documents, Aggregation, Schema, Shell)|
+---------------------------------+---------------------------------+
                                  |
                          fetch('/api/*') JSON
                                  |
+---------------------------------v---------------------------------+
|                    Express Server (server.ts :3000)               |
|  - Dev: Vite middleware (SPA)   |  Prod: Static dist/ + SPA route |
|  - REST API routes (/api/status, /api/connect, /api/documents/*,  |
|    /api/aggregate, /api/schema, /api/indexes, /api/shell, /seed)  |
+---------------------------------+---------------------------------+
                                  |
                     MongoConnectionManager
                      (server/mongoEngine.ts)
                                  |
            +---------------------+---------------------+
            |                                           |
            v                                           v
+-----------------------+                 +-------------------------+
|   Live MongoDB Mode   |                 |   Local Sandbox Mode    |
|  mongodb Node Driver  |                 |     SandboxEngine       |
|  (Atlas SRV / Local)  |                 | (server/sandboxEngine)  |
+-----------+-----------+                 +------------+------------+
            |                                          |
            v                                          v
  MongoDB Atlas / mongod                       data/sandbox.json
```

---

## 2. Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend UI** | React 19, TypeScript, Tailwind CSS v4 | Storefront, order tracker, kitchen queue, MongoDB Studio |
| **Icons & Motion** | `lucide-react`, `motion` | Crisp UI iconography and modal/drawer ergonomics |
| **Backend Server** | Node.js (v22), Express 4, `tsx` | Unified API server and Vite dev/static asset host on port `3000` |
| **Database Driver** | Official `mongodb` v7 Node.js driver | Direct connection to MongoDB Atlas (`mongodb+srv://`) or `mongod` |
| **Local Persistence** | `SandboxEngine` (`data/sandbox.json`) | In-process MongoDB query, update, aggregation, index, and shell emulator |
| **Build Tooling** | Vite 8, TypeScript (`tsc --noEmit`) | SPA bundling, static asset copying, and static type checking |

---

## 3. Directory & Module Structure

```text
.
├── server.ts                        # Express server + Vite middleware + /api/* routes
├── server/
│   ├── mongoEngine.ts               # Dual-mode connection manager (Live MongoDB + Sandbox)
│   ├── sandboxEngine.ts             # Persistent JSON engine, starter schemas, INR migration
│   └── jsonParser.ts                # Safe relaxed-JSON parser (ObjectId, ISODate, operators)
├── src/
│   ├── App.tsx                      # Top navigation shell, section switcher, theme & DB state
│   ├── main.tsx                     # React root mount
│   ├── index.css                    # Tailwind CSS v4 entry and font definitions
│   ├── api/
│   │   └── client.ts                # Typed frontend wrapper for all /api/* endpoints
│   ├── types/
│   │   └── mongo.ts                 # Shared TypeScript interfaces (orders, menus, studio)
│   ├── utils/
│   │   └── currency.ts              # Indian Rupee (₹ / en-IN) currency formatter
│   ├── assets/images/               # Bistro photography for hero and dishes
│   └── components/
│       ├── FoodOrderingView.tsx     # Storefront, partner kitchens, dietary filters, bag drawer
│       ├── OrderTrackerView.tsx     # 4-stage live order tracker with 5-second auto-refresh
│       ├── KitchenQueueView.tsx     # Ticket advancement & menu availability toggles
│       ├── Sidebar.tsx              # Studio database/collection tree & Seed Starter Schema
│       ├── DocumentsView.tsx        # Filter/projection/sort bar & document CRUD modals
│       ├── AggregationView.tsx      # Multi-stage MongoDB aggregation pipeline builder
│       ├── SchemaIndexesView.tsx    # Field type sampling & index creation/deletion
│       ├── ShellSnippetsView.tsx    # Interactive mongosh emulator + Node/Python/Java snippets
│       └── ConnectModal.tsx         # MongoDB URI connector, compression toggle & mode switch
├── index.html                       # HTML entry & metadata
├── vite.config.ts                   # Vite build config + src/assets dist copy plugin
├── package.json                     # Scripts (dev, start, build, lint) & dependencies
└── .env.example                     # Environment variable template (no hardcoded secrets)
```

---

## 4. Application Views & Data Flow

### 4.1 Customer Ordering Storefront (`FoodOrderingView.tsx`)
- Queries `food_delivery.restaurants`, `food_delivery.menu_items`, and `food_delivery.customers` on mount via `mongoApi.queryDocuments`.
- Supports filtering by partner kitchen, dietary tags (`vegetarian`, `vegan`, `gluten-free`, `spicy`), and text search across dish names/descriptions/kitchens.
- Opens a customization dialog per dish supporting single-select radio groups (e.g., portion size, crust, spice level), multi-select add-ons, special kitchen instructions, and quantity selection.
- Manages a slide-over **Delivery Bag** with Indian Rupee (`₹`) totals computed via `formatRupees()` (`src/utils/currency.ts`).
- Checkout writes a new order document (`currency: 'INR'`, `status: 'confirmed'`) into `food_delivery.orders` and records a timing telemetry event in `telemetry_dev.events`.

### 4.2 Live Order Tracker (`OrderTrackerView.tsx`)
- Polls `food_delivery.orders` every 5 seconds (and supports manual refresh) sorted by `createdAt` descending.
- Tracks orders across 4 sequential stages:
  1. `confirmed` — Order Confirmed
  2. `preparing` — Preparing in Kitchen
  3. `out_for_delivery` — Out for Delivery
  4. `delivered` — Delivered
- Displays ETA, delivery address, restaurant name, itemized receipt, subtotal, delivery fee, and total paid in `₹`.

### 4.3 Kitchen Operations Queue (`KitchenQueueView.tsx`)
- Displays live order counts (`Open Tickets`, `Confirmed`, `Preparing`, `Out for Delivery`) and filter tabs.
- Advances order tickets through `confirmed -> preparing -> out_for_delivery -> delivered` via `PUT /api/documents/update`, recalculating `estimatedMinutes` and `updatedAt`.
- Provides a **Menu Availability** table to toggle `available` (`In Stock` / `Sold Out`) directly on `food_delivery.menu_items` documents.

### 4.4 MongoDB Studio (`Sidebar`, `DocumentsView`, `AggregationView`, `SchemaIndexesView`, `ShellSnippetsView`)
- **Database Tree (`Sidebar.tsx`)**: Inspects all databases and collections with document counts, allows creating/dropping collections, and exposes **Seed Starter Schema** (`POST /api/seed`).
- **Documents (`DocumentsView.tsx`)**: Runs `find` queries with relaxed JSON filter, projection, sort, skip, and limit, plus full JSON document insert, edit, and delete.
- **Aggregation (`AggregationView.tsx`)**: Builds and executes multi-stage pipelines (`$match`, `$group`, `$sort`, `$project`, `$limit`, `$skip`, `$unwind`, `$count`).
- **Schema & Indexes (`SchemaIndexesView.tsx`)**: Samples up to 200 documents to compute field presence percentages and BSON type distributions; creates/drops ascending (`1`), descending (`-1`), and `text` indexes.
- **Shell & Snippets (`ShellSnippetsView.tsx`)**: Executes `mongosh`-style commands (`db.collection.find(...)`, `countDocuments`, `insertOne`, `updateOne`, `deleteOne`, `aggregate`, `getIndexes`) and generates ready-to-copy driver snippets for `mongosh`, Node.js, Python, and Java (Spring Data MongoDB).

---

## 5. Dual-Mode Persistence Engine (`MongoConnectionManager` & `SandboxEngine`)

### Connection Lifecycle (`server/mongoEngine.ts`)
1. On first request, `ensureInitialized()` reads `process.env.MONGODB_URI` (defaulting to `mongodb://localhost:27017/`).
2. `tryConnect()` validates the URI (`mongodb://` or `mongodb+srv://`, rejecting unedited `<db_password>` placeholders) and attempts a `MongoClient` connection (5s timeout for SRV Atlas clusters, 2s for local sockets).
3. If live connection succeeds, `mode` switches to `'live'` and all CRUD, aggregation, schema, index, and shell calls execute against the connected cluster.
4. If unreachable during startup fallback, `mode` stays `'sandbox'` and routes seamlessly to `SandboxEngine` without blocking the UI. Users can switch between live cluster and Local Sandbox anytime in **Connect DB** (`ConnectModal.tsx`).
5. System databases (`admin`, `local`, `config`) handle restricted `listCollections` permissions gracefully on Atlas shared/free tiers.

### Local Sandbox Engine (`server/sandboxEngine.ts`)
- Persists all databases, collections, documents, and index definitions to `data/sandbox.json` using path-traversal-guarded file resolution (`ensureSafeStorePath`).
- Automatically migrates legacy USD starter records in `food_delivery` to Indian Rupees (`INR`) on load if `FD-GNOCCHI-01` still holds pre-migration pricing.
- Supports MongoDB query operators (`$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$and`, `$or`, `$regex`, `$exists`, dot-notation paths) and update operators (`$set`, `$unset`, `$inc`, `$push`).

### Safe Relaxed JSON Parser (`server/jsonParser.ts`)
- Custom tokenizer and recursive-descent parser (no `eval` or `vm` execution) supporting unquoted object keys, single-quoted strings, trailing commas, `ObjectId("...")`, `ISODate("...")`, and `new Date("...")`.
- Guards against prototype pollution by rejecting `__proto__`, `constructor`, and `prototype` keys.

---

## 6. MongoDB Starter Schema (`food_delivery`)

All monetary values are stored and displayed in **INR (`₹`)**.

| Collection | Key Fields | Indexes |
| :--- | :--- | :--- |
| **`restaurants`** | `_id`, `slug`, `name`, `cuisine`, `prepTimeMins`, `deliveryFee`, `rating`, `address`, `isOpen` | `_id_`, `slug_1` (unique) |
| **`menu_items`** | `_id`, `sku`, `restaurantId`, `restaurantName`, `title`, `description`, `category`, `price`, `dietaryTags`, `customOptions[]`, `prepMinutes`, `available`, `imageKey` | `_id_`, `restaurantId_1`, `sku_1` (unique) |
| **`orders`** | `_id`, `orderNumber`, `restaurantName`, `customerName`, `customerEmail`, `deliveryAddress`, `items[]`, `subtotal`, `deliveryFee`, `total`, `currency`, `status`, `estimatedMinutes`, `createdAt`, `updatedAt` | `_id_`, `orderNumber_1` (unique), `status_1_createdAt_-1` |
| **`customers`** | `_id`, `name`, `email`, `phone`, `defaultAddress` | `_id_`, `email_1` (unique) |

Additional starter databases available in MongoDB Studio:
- `ecommerce_local` (`products`, `orders`, `customers`)
- `telemetry_dev` (`events`, `sessions`)
- `local` (`startup_log`)

---

## 7. Backend REST API Reference (`server.ts`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/status` | Returns current connection mode (`live` \| `sandbox`), masked URI, host, and version |
| `POST` | `/api/connect` | Connects to a provided MongoDB URI (supports `enableCompression`) |
| `POST` | `/api/mode` | Switches active mode between `live` and `sandbox` |
| `POST` | `/api/seed` | Idempotently seeds missing starter collections into the active database |
| `GET` | `/api/databases` | Lists databases, collections, document counts, and index counts |
| `POST` | `/api/databases` | Creates a new database/collection |
| `DELETE` | `/api/collections` | Drops a collection (`?db=...&collection=...`) |
| `POST` | `/api/documents/query` | Runs `find` with filter, projection, sort, skip, and limit |
| `POST` | `/api/documents/insert` | Inserts a JSON/relaxed-JSON document |
| `PUT` | `/api/documents/update` | Replaces or applies update operators to a document by `_id` |
| `DELETE` | `/api/documents/delete` | Deletes a document by `_id` (`?db=...&collection=...&id=...`) |
| `POST` | `/api/aggregate` | Executes a multi-stage aggregation pipeline |
| `GET` | `/api/schema` | Samples documents and returns field presence & type percentages |
| `GET` | `/api/indexes` | Lists collection indexes |
| `POST` | `/api/indexes` | Creates an index (`1`, `-1`, or `text`, optional `unique`) |
| `DELETE` | `/api/indexes` | Drops a non-`_id_` index by name |
| `POST` | `/api/shell` | Evaluates supported `db.<col>.*` shell commands |

---

## 8. Security & Environment Design

- **Credential Isolation**: Database URIs and credentials belong strictly in server-side `process.env.MONGODB_URI` or the runtime `/api/connect` session—never committed to source files or exposed in client bundles. `maskMongoUri()` strips passwords from all `/api/status` responses.
- **No Code Execution**: User-supplied queries, aggregation stages, and shell commands are parsed by `server/jsonParser.ts` rather than `eval()`/`new Function()`.
- **Prototype & Path Guards**: Object keys `__proto__`, `constructor`, and `prototype` are stripped during parsing and BSON conversion; `SandboxEngine` validates its storage path stays inside `data/`.
- **Production Build**: Vite builds client assets to `dist/` and copies `src/assets/` via a custom `closeBundle` plugin so dish photography resolves reliably in production (`npm run build && npm start`).
