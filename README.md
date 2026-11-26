# Leafline — Online Food Delivery & MongoDB Studio

Leafline is a full-stack bistro food delivery application powered by a dual-mode MongoDB backend (MongoDB Atlas / local `mongod` via the official `mongodb` Node.js driver, plus a persistent Local Sandbox JSON store).

## Key Features

- **Customer Ordering (`Order`)**: Browse partner kitchens, filter by dietary tags (`Vegetarian`, `Vegan`, `Gluten-Free`, `Spicy`), customize portions and add-ons, and check out in Indian Rupees (`₹`).
- **Live Order Tracking (`Track`)**: 4-stage real-time progress tracker (`Confirmed` -> `Preparing` -> `Out for Delivery` -> `Delivered`) with 5-second automatic sync and itemized receipts.
- **Kitchen Operations (`Kitchen`)**: Advance live preparation tickets across stages and toggle dish stock (`In Stock` / `Sold Out`) directly in MongoDB.
- **MongoDB Studio (`MongoDB Studio`)**: Full document browser and CRUD editor, multi-stage aggregation pipeline builder, schema field analyzer, index manager, interactive `mongosh` runner, driver code snippets, and one-click starter schema seeding.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the complete technical architecture, data models, REST API reference, and dual-mode persistence design.

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables (optional; runs in Local Sandbox automatically if omitted):
   ```bash
   cp .env.example .env
   # Set MONGODB_URI to your MongoDB Atlas SRV or local mongodb://localhost:27017/ URI
   ```
3. Start development server on port `3000`:
   ```bash
   npm run dev
   ```
4. Build and run in production:
   ```bash
   npm run build
   npm start
   ```
