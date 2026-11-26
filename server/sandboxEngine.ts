import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AggregationResponse,
  AggregationStage,
  DatabaseSummary,
  IndexSummary,
  QueryDocumentsResponse,
  SchemaAnalysisResponse,
  SchemaFieldSummary,
  ShellExecuteResponse,
} from '../src/types/mongo.ts';
import {isDateMarker, isObjectIdMarker, parseRelaxedJson} from './jsonParser.ts';

interface SandboxCollection {
  documents: Record<string, unknown>[];
  indexes: IndexSummary[];
}

interface SandboxStore {
  databases: Record<string, Record<string, SandboxCollection>>;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.resolve(DATA_DIR, 'sandbox.json');

function ensureSafeStorePath(targetPath: string): string {
  const resolved = path.resolve(targetPath);
  if (!resolved.startsWith(DATA_DIR + path.sep)) {
    throw new Error('Unsafe storage path');
  }
  return resolved;
}

function generateObjectIdHex(): string {
  const timestamp = Math.floor(Date.now() / 1000)
    .toString(16)
    .padStart(8, '0');
  const randomPart = crypto.randomBytes(8).toString('hex');
  return (timestamp + randomPart).slice(0, 24);
}

function normalizeValue(val: unknown): unknown {
  if (isObjectIdMarker(val)) return val.value || generateObjectIdHex();
  if (isDateMarker(val)) return val.value;
  if (Array.isArray(val)) return val.map(normalizeValue);
  if (val && typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      out[k] = normalizeValue(v);
    }
    return out;
  }
  return val;
}

export function createStarterStore(): SandboxStore {
  return {
    databases: {
      ecommerce_local: {
        users: {
          indexes: [
            {name: '_id_', key: {_id: 1}, unique: true},
            {name: 'email_1', key: {email: 1}, unique: true},
          ],
          documents: [
            {
              _id: '67451a10c9b120001a000101',
              name: 'Elena Rostova',
              email: 'elena.rostova@example.com',
              plan: 'pro',
              country: 'DE',
              active: true,
              ordersCount: 14,
              lifetimeSpend: 1842.5,
              tags: ['early-adopter', 'api-user'],
              createdAt: '2026-03-14T09:20:00.000Z',
            },
            {
              _id: '67451a10c9b120001a000102',
              name: 'Marcus Chen',
              email: 'marcus.chen@example.com',
              plan: 'enterprise',
              country: 'US',
              active: true,
              ordersCount: 31,
              lifetimeSpend: 5290.0,
              tags: ['vip', 'bulk-orders'],
              createdAt: '2026-01-22T15:45:00.000Z',
            },
            {
              _id: '67451a10c9b120001a000103',
              name: 'Priya Nair',
              email: 'priya.nair@example.com',
              plan: 'starter',
              country: 'IN',
              active: true,
              ordersCount: 4,
              lifetimeSpend: 312.75,
              tags: ['mobile'],
              createdAt: '2026-07-08T11:10:00.000Z',
            },
            {
              _id: '67451a10c9b120001a000104',
              name: 'Lucas Moreau',
              email: 'lucas.moreau@example.com',
              plan: 'pro',
              country: 'FR',
              active: false,
              ordersCount: 7,
              lifetimeSpend: 689.2,
              tags: ['paused'],
              createdAt: '2026-04-19T18:02:00.000Z',
            },
            {
              _id: '67451a10c9b120001a000105',
              name: 'Hannah Lindqvist',
              email: 'hannah.lindqvist@example.com',
              plan: 'enterprise',
              country: 'SE',
              active: true,
              ordersCount: 22,
              lifetimeSpend: 4110.4,
              tags: ['vip', 'eu-west'],
              createdAt: '2026-02-11T08:15:00.000Z',
            },
          ],
        },
        orders: {
          indexes: [
            {name: '_id_', key: {_id: 1}, unique: true},
            {name: 'status_1_total_-1', key: {status: 1, total: -1}, unique: false},
          ],
          documents: [
            {
              _id: '67451b20c9b120001a000201',
              orderNumber: 'ORD-9041',
              customerEmail: 'marcus.chen@example.com',
              status: 'delivered',
              total: 420.0,
              currency: 'USD',
              items: [
                {sku: 'KB-MECH-75', qty: 2, unitPrice: 165.0},
                {sku: 'CABLE-USB4', qty: 3, unitPrice: 30.0},
              ],
              orderedAt: '2026-11-18T14:22:00.000Z',
            },
            {
              _id: '67451b20c9b120001a000202',
              orderNumber: 'ORD-9042',
              customerEmail: 'elena.rostova@example.com',
              status: 'processing',
              total: 289.5,
              currency: 'EUR',
              items: [{sku: 'MON-ARM-PRO', qty: 1, unitPrice: 289.5}],
              orderedAt: '2026-11-22T09:11:00.000Z',
            },
            {
              _id: '67451b20c9b120001a000203',
              orderNumber: 'ORD-9043',
              customerEmail: 'hannah.lindqvist@example.com',
              status: 'delivered',
              total: 740.0,
              currency: 'EUR',
              items: [{sku: 'DOCK-TB4', qty: 2, unitPrice: 370.0}],
              orderedAt: '2026-11-12T17:04:00.000Z',
            },
            {
              _id: '67451b20c9b120001a000204',
              orderNumber: 'ORD-9044',
              customerEmail: 'priya.nair@example.com',
              status: 'shipped',
              total: 129.0,
              currency: 'USD',
              items: [{sku: 'STAND-ALUM', qty: 1, unitPrice: 129.0}],
              orderedAt: '2026-11-24T06:40:00.000Z',
            },
          ],
        },
        products: {
          indexes: [
            {name: '_id_', key: {_id: 1}, unique: true},
            {name: 'sku_1', key: {sku: 1}, unique: true},
          ],
          documents: [
            {
              _id: '67451c30c9b120001a000301',
              sku: 'KB-MECH-75',
              title: 'Tactile 75% Aluminum Keyboard',
              category: 'Peripherals',
              price: 165.0,
              inStock: 42,
              published: true,
            },
            {
              _id: '67451c30c9b120001a000302',
              sku: 'DOCK-TB4',
              title: 'Thunderbolt 4 Workstation Dock',
              category: 'Connectivity',
              price: 370.0,
              inStock: 19,
              published: true,
            },
            {
              _id: '67451c30c9b120001a000303',
              sku: 'MON-ARM-PRO',
              title: 'Pneumatic Dual Monitor Arm',
              category: 'Ergonomics',
              price: 289.5,
              inStock: 8,
              published: true,
            },
          ],
        },
      },
      telemetry_dev: {
        events: {
          indexes: [
            {name: '_id_', key: {_id: 1}, unique: true},
            {name: 'service_1_ts_-1', key: {service: 1, ts: -1}, unique: false},
          ],
          documents: [
            {
              _id: '67451d40c9b120001a000401',
              service: 'auth-gateway',
              level: 'info',
              durationMs: 14,
              region: 'us-west-2',
              ts: '2026-11-25T21:40:00.000Z',
            },
            {
              _id: '67451d40c9b120001a000402',
              service: 'checkout-worker',
              level: 'warn',
              durationMs: 412,
              region: 'eu-central-1',
              ts: '2026-11-25T21:44:12.000Z',
            },
            {
              _id: '67451d40c9b120001a000403',
              service: 'catalog-indexer',
              level: 'info',
              durationMs: 67,
              region: 'us-east-1',
              ts: '2026-11-25T21:52:09.000Z',
            },
          ],
        },
      },
      food_delivery: {
        restaurants: {
          indexes: [
            {name: '_id_', key: {_id: 1}, unique: true},
            {name: 'slug_1', key: {slug: 1}, unique: true},
          ],
          documents: [
            {
              _id: '67452000c9b120001a000001',
              slug: 'osteria-verde',
              name: 'Osteria Verde',
              cuisine: 'Modern Italian',
              prepTimeMins: 22,
              deliveryFee: 49,
              rating: 4.9,
              address: '412 Mercer St, Suite B',
              isOpen: true,
            },
            {
              _id: '67452000c9b120001a000002',
              slug: 'kuro-and-broth',
              name: 'Kuro & Broth',
              cuisine: 'Japanese Ramen & Bowls',
              prepTimeMins: 18,
              deliveryFee: 35,
              rating: 4.8,
              address: '108 Pinehurst Ave',
              isOpen: true,
            },
            {
              _id: '67452000c9b120001a000003',
              slug: 'solstice-hearth',
              name: 'Solstice Hearth',
              cuisine: 'Seasonal Bistro',
              prepTimeMins: 15,
              deliveryFee: 0,
              rating: 4.9,
              address: '785 Hawthorne Blvd',
              isOpen: true,
            },
          ],
        },
        menu_items: {
          indexes: [
            {name: '_id_', key: {_id: 1}, unique: true},
            {name: 'restaurantId_1', key: {restaurantId: 1}, unique: false},
            {name: 'sku_1', key: {sku: 1}, unique: true},
          ],
          documents: [
            {
              _id: '67452100c9b120001a000011',
              sku: 'FD-GNOCCHI-01',
              restaurantId: '67452000c9b120001a000001',
              restaurantName: 'Osteria Verde',
              title: 'Brown Butter Ricotta Gnocchi',
              description: 'Hand-rolled sheep ricotta gnocchi tossed in toasted hazelnut sage butter and aged pecorino.',
              category: 'Mains',
              price: 490,
              dietaryTags: ['vegetarian'],
              prepMinutes: 18,
              available: true,
              imageKey: 'truffle-gnocchi',
              customOptions: [
                {
                  name: 'Portion Size',
                  required: true,
                  multiSelect: false,
                  choices: [
                    {label: 'Standard Plate', priceDelta: 0},
                    {label: 'Sharing Portion', priceDelta: 190},
                  ],
                },
                {
                  name: 'Kitchen Add-Ons',
                  required: false,
                  multiSelect: true,
                  choices: [
                    {label: 'Shaved Black Truffle', priceDelta: 120},
                    {label: 'Grilled Sourdough', priceDelta: 80},
                  ],
                },
              ],
            },
            {
              _id: '67452100c9b120001a000012',
              sku: 'FD-PIZZA-02',
              restaurantId: '67452000c9b120001a000001',
              restaurantName: 'Osteria Verde',
              title: 'Wood-Fired Sourdough Margherita',
              description: '48-hour fermented crust, San Marzano DOP tomatoes, fior di latte, and sweet basil.',
              category: 'Mains',
              price: 450,
              dietaryTags: ['vegetarian'],
              prepMinutes: 16,
              available: true,
              imageKey: 'sourdough-pizza',
              customOptions: [
                {
                  name: 'Crust Style',
                  required: true,
                  multiSelect: false,
                  choices: [
                    {label: 'Classic Sourdough', priceDelta: 0},
                    {label: 'Gluten-Free Crust', priceDelta: 90},
                  ],
                },
                {
                  name: 'Toppings',
                  required: false,
                  multiSelect: true,
                  choices: [
                    {label: 'Calabrian Chili Oil', priceDelta: 40},
                    {label: 'Burrata Ball', priceDelta: 110},
                  ],
                },
              ],
            },
            {
              _id: '67452100c9b120001a000013',
              sku: 'FD-RAMEN-03',
              restaurantId: '67452000c9b120001a000002',
              restaurantName: 'Kuro & Broth',
              title: 'Chili-Garlic Tonkotsu Ramen',
              description: 'Slow-simmered pork bone broth, charred chashu, jammy soy egg, bok choy, and roasted garlic oil.',
              category: 'Noodles',
              price: 520,
              dietaryTags: ['spicy'],
              prepMinutes: 15,
              available: true,
              imageKey: 'spicy-ramen',
              customOptions: [
                {
                  name: 'Spice Level',
                  required: true,
                  multiSelect: false,
                  choices: [
                    {label: 'Mild Chili', priceDelta: 0},
                    {label: 'House Spicy', priceDelta: 0},
                    {label: 'Extra Fiery', priceDelta: 20},
                  ],
                },
                {
                  name: 'Extras',
                  required: false,
                  multiSelect: true,
                  choices: [
                    {label: 'Extra Jammy Egg', priceDelta: 60},
                    {label: 'Extra Chashu Pork', priceDelta: 120},
                  ],
                },
              ],
            },
            {
              _id: '67452100c9b120001a000014',
              sku: 'FD-POKE-04',
              restaurantId: '67452000c9b120001a000002',
              restaurantName: 'Kuro & Broth',
              title: 'Citrus-Cured Wild Salmon Bowl',
              description: 'Yuzu-tamari glazed Atlantic salmon over sushi rice with avocado, edamame, and crisp cucumber.',
              category: 'Bowls',
              price: 560,
              dietaryTags: ['gluten-free'],
              prepMinutes: 12,
              available: true,
              imageKey: 'salmon-poke',
              customOptions: [
                {
                  name: 'Base',
                  required: true,
                  multiSelect: false,
                  choices: [
                    {label: 'Seasoned Sushi Rice', priceDelta: 0},
                    {label: 'Mixed Greens & Quinoa', priceDelta: 30},
                  ],
                },
                {
                  name: 'Add-Ons',
                  required: false,
                  multiSelect: true,
                  choices: [
                    {label: 'Double Salmon', priceDelta: 160},
                    {label: 'Pickled Ginger & Avocado', priceDelta: 70},
                  ],
                },
              ],
            },
            {
              _id: '67452100c9b120001a000015',
              sku: 'FD-HARVEST-05',
              restaurantId: '67452000c9b120001a000003',
              restaurantName: 'Solstice Hearth',
              title: 'Miso Sweet Potato & Quinoa Bowl',
              description: 'Charred miso-glazed sweet potato, crispy red quinoa, watermelon radish, avocado, and lemon tahini.',
              category: 'Bowls',
              price: 390,
              dietaryTags: ['vegan', 'gluten-free', 'vegetarian'],
              prepMinutes: 12,
              available: true,
              imageKey: 'harvest-bowl',
              customOptions: [
                {
                  name: 'Dressing',
                  required: true,
                  multiSelect: false,
                  choices: [
                    {label: 'Lemon Herb Tahini', priceDelta: 0},
                    {label: 'Spicy Harissa Vinaigrette', priceDelta: 0},
                  ],
                },
                {
                  name: 'Protein Boost',
                  required: false,
                  multiSelect: true,
                  choices: [
                    {label: 'Crispy Herb Tofu', priceDelta: 95},
                    {label: 'Roasted Chickpeas', priceDelta: 55},
                  ],
                },
              ],
            },
            {
              _id: '67452100c9b120001a000016',
              sku: 'FD-MATCHA-06',
              restaurantId: '67452000c9b120001a000003',
              restaurantName: 'Solstice Hearth',
              title: 'Ceremonial Matcha Tiramisu',
              description: 'Whisked Uji matcha mascarpone cream layered with espresso-soaked sponge and fresh mint.',
              category: 'Desserts',
              price: 260,
              dietaryTags: ['vegetarian'],
              prepMinutes: 5,
              available: true,
              imageKey: 'matcha-tiramisu',
              customOptions: [
                {
                  name: 'Serving',
                  required: true,
                  multiSelect: false,
                  choices: [
                    {label: 'Single Slice', priceDelta: 0},
                    {label: 'Box of Two', priceDelta: 230},
                  ],
                },
              ],
            },
          ],
        },
        orders: {
          indexes: [
            {name: '_id_', key: {_id: 1}, unique: true},
            {name: 'orderNumber_1', key: {orderNumber: 1}, unique: true},
            {name: 'status_1_createdAt_-1', key: {status: 1, createdAt: -1}, unique: false},
          ],
          documents: [
            {
              _id: '67452200c9b120001a000101',
              orderNumber: 'FD-4821',
              restaurantName: 'Osteria Verde',
              customerName: 'Elena Rostova',
              customerEmail: 'elena.rostova@example.com',
              deliveryAddress: '215 Maplewood Ave, Apt 4B',
              items: [
                {
                  sku: 'FD-GNOCCHI-01',
                  title: 'Brown Butter Ricotta Gnocchi',
                  qty: 1,
                  unitPrice: 610,
                  selectedOptions: ['Standard Plate', 'Shaved Black Truffle'],
                  notes: 'Extra pecorino on the side',
                  lineTotal: 610,
                },
                {
                  sku: 'FD-MATCHA-06',
                  title: 'Ceremonial Matcha Tiramisu',
                  qty: 1,
                  unitPrice: 260,
                  selectedOptions: ['Single Slice'],
                  notes: '',
                  lineTotal: 260,
                },
              ],
              subtotal: 870,
              deliveryFee: 49,
              total: 919,
              currency: 'INR',
              status: 'preparing',
              estimatedMinutes: 19,
              createdAt: '2026-11-25T22:30:00.000Z',
              updatedAt: '2026-11-25T22:34:00.000Z',
            },
            {
              _id: '67452200c9b120001a000102',
              orderNumber: 'FD-4820',
              restaurantName: 'Kuro & Broth',
              customerName: 'Marcus Chen',
              customerEmail: 'marcus.chen@example.com',
              deliveryAddress: '840 Cedar Lane, Floor 3',
              items: [
                {
                  sku: 'FD-RAMEN-03',
                  title: 'Chili-Garlic Tonkotsu Ramen',
                  qty: 2,
                  unitPrice: 580,
                  selectedOptions: ['House Spicy', 'Extra Jammy Egg'],
                  notes: 'Pack broth separately',
                  lineTotal: 1160,
                },
              ],
              subtotal: 1160,
              deliveryFee: 35,
              total: 1195,
              currency: 'INR',
              status: 'out_for_delivery',
              estimatedMinutes: 8,
              createdAt: '2026-11-25T22:15:00.000Z',
              updatedAt: '2026-11-25T22:38:00.000Z',
            },
            {
              _id: '67452200c9b120001a000103',
              orderNumber: 'FD-4819',
              restaurantName: 'Solstice Hearth',
              customerName: 'Priya Nair',
              customerEmail: 'priya.nair@example.com',
              deliveryAddress: '59 Oakridge Court',
              items: [
                {
                  sku: 'FD-HARVEST-05',
                  title: 'Miso Sweet Potato & Quinoa Bowl',
                  qty: 1,
                  unitPrice: 485,
                  selectedOptions: ['Lemon Herb Tahini', 'Crispy Herb Tofu'],
                  notes: '',
                  lineTotal: 485,
                },
              ],
              subtotal: 485,
              deliveryFee: 0,
              total: 485,
              currency: 'INR',
              status: 'delivered',
              estimatedMinutes: 0,
              createdAt: '2026-11-25T21:10:00.000Z',
              updatedAt: '2026-11-25T21:42:00.000Z',
            },
          ],
        },
        customers: {
          indexes: [
            {name: '_id_', key: {_id: 1}, unique: true},
            {name: 'email_1', key: {email: 1}, unique: true},
          ],
          documents: [
            {
              _id: '67452300c9b120001a000201',
              name: 'Elena Rostova',
              email: 'elena.rostova@example.com',
              phone: '+1 (415) 555-0142',
              defaultAddress: '215 Maplewood Ave, Apt 4B',
            },
            {
              _id: '67452300c9b120001a000202',
              name: 'Marcus Chen',
              email: 'marcus.chen@example.com',
              phone: '+1 (415) 555-0198',
              defaultAddress: '840 Cedar Lane, Floor 3',
            },
          ],
        },
      },
      local: {
        startup_log: {
          indexes: [{name: '_id_', key: {_id: 1}, unique: true}],
          documents: [
            {
              _id: 'localhost-27017-init',
              hostname: 'localhost',
              port: 27017,
              bindIp: '127.0.0.1',
              storageEngine: 'wiredTiger',
              startTime: '2026-11-25T20:00:00.000Z',
            },
          ],
        },
      },
    },
  };
}

function getByDotPath(obj: unknown, dotPath: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = dotPath.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || typeof cur !== 'object') return undefined;
    if (Array.isArray(cur)) {
      const idx = Number(part);
      if (Number.isInteger(idx) && idx >= 0 && idx < cur.length) {
        cur = cur[idx];
      } else {
        return cur.map((item) => getByDotPath(item, part)).filter((v) => v !== undefined);
      }
    } else {
      cur = (cur as Record<string, unknown>)[part];
    }
  }
  return cur;
}

function setByDotPath(obj: Record<string, unknown>, dotPath: string, value: unknown): void {
  const parts = dotPath.split('.');
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return;
    if (!cur[key] || typeof cur[key] !== 'object' || Array.isArray(cur[key])) {
      cur[key] = {};
    }
    cur = cur[key] as Record<string, unknown>;
  }
  const last = parts[parts.length - 1];
  if (last === '__proto__' || last === 'constructor' || last === 'prototype') return;
  cur[last] = value;
}

function unsetByDotPath(obj: Record<string, unknown>, dotPath: string): void {
  const parts = dotPath.split('.');
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const next = cur[parts[i]];
    if (!next || typeof next !== 'object' || Array.isArray(next)) return;
    cur = next as Record<string, unknown>;
  }
  delete cur[parts[parts.length - 1]];
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && !Array.isArray(b)) {
    return a.some((item) => valuesEqual(item, b));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return -1;
  if (b === undefined || b === null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

function matchesCondition(docValue: unknown, condition: unknown): boolean {
  if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
    const entries = Object.entries(condition as Record<string, unknown>);
    const hasOperators = entries.some(([k]) => k.startsWith('$'));
    if (hasOperators) {
      for (const [op, target] of entries) {
        if (op === '$eq') {
          if (!valuesEqual(docValue, target)) return false;
        } else if (op === '$ne') {
          if (valuesEqual(docValue, target)) return false;
        } else if (op === '$gt') {
          if (docValue === undefined || compareValues(docValue, target) <= 0) return false;
        } else if (op === '$gte') {
          if (docValue === undefined || compareValues(docValue, target) < 0) return false;
        } else if (op === '$lt') {
          if (docValue === undefined || compareValues(docValue, target) >= 0) return false;
        } else if (op === '$lte') {
          if (docValue === undefined || compareValues(docValue, target) > 0) return false;
        } else if (op === '$in') {
          if (!Array.isArray(target) || !target.some((t) => valuesEqual(docValue, t))) return false;
        } else if (op === '$nin') {
          if (Array.isArray(target) && target.some((t) => valuesEqual(docValue, t))) return false;
        } else if (op === '$exists') {
          const exists = docValue !== undefined;
          if (Boolean(target) !== exists) return false;
        } else if (op === '$regex') {
          const pattern = String(target);
          if (pattern.length > 200) return false;
          const regex = new RegExp(pattern, 'i');
          if (Array.isArray(docValue)) {
            if (!docValue.some((item) => regex.test(String(item)))) return false;
          } else if (!regex.test(String(docValue ?? ''))) {
            return false;
          }
        }
      }
      return true;
    }
  }
  return valuesEqual(docValue, condition);
}

function matchesFilter(doc: Record<string, unknown>, filter: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(filter)) {
    if (key === '$and' && Array.isArray(value)) {
      if (!value.every((sub) => sub && typeof sub === 'object' && matchesFilter(doc, sub as Record<string, unknown>))) {
        return false;
      }
      continue;
    }
    if (key === '$or' && Array.isArray(value)) {
      if (!value.some((sub) => sub && typeof sub === 'object' && matchesFilter(doc, sub as Record<string, unknown>))) {
        return false;
      }
      continue;
    }
    const docValue = getByDotPath(doc, key);
    if (!matchesCondition(docValue, value)) return false;
  }
  return true;
}

function applyProjection(doc: Record<string, unknown>, projection: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.keys(projection);
  if (keys.length === 0) return structuredClone(doc);

  const nonIdEntries = Object.entries(projection).filter(([k]) => k !== '_id');
  const isInclusion = nonIdEntries.some(([, v]) => Boolean(v));

  if (isInclusion) {
    const out: Record<string, unknown> = {};
    if (projection._id !== 0 && projection._id !== false && '_id' in doc) {
      out._id = doc._id;
    }
    for (const [k, v] of nonIdEntries) {
      if (v) {
        const val = getByDotPath(doc, k);
        if (val !== undefined) {
          setByDotPath(out, k, structuredClone(val));
        }
      }
    }
    return out;
  }

  const out = structuredClone(doc);
  for (const [k, v] of Object.entries(projection)) {
    if (!v) {
      unsetByDotPath(out, k);
    }
  }
  return out;
}

function applySort(docs: Record<string, unknown>[], sortObj: Record<string, unknown>): Record<string, unknown>[] {
  const entries = Object.entries(sortObj);
  if (entries.length === 0) return docs;
  return [...docs].sort((a, b) => {
    for (const [field, dir] of entries) {
      const mult = Number(dir) < 0 ? -1 : 1;
      const cmp = compareValues(getByDotPath(a, field), getByDotPath(b, field));
      if (cmp !== 0) return cmp * mult;
    }
    return 0;
  });
}

function detectTypeName(val: unknown): string {
  if (val === null) return 'Null';
  if (Array.isArray(val)) return 'Array';
  if (typeof val === 'boolean') return 'Boolean';
  if (typeof val === 'number') return Number.isInteger(val) ? 'Int32' : 'Double';
  if (typeof val === 'string') {
    if (/^[0-9a-f]{24}$/i.test(val)) return 'ObjectId';
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) return 'Date';
    return 'String';
  }
  if (typeof val === 'object') return 'Object';
  return 'Mixed';
}

export class SandboxEngine {
  private store: SandboxStore;

  constructor() {
    this.store = this.loadStore();
  }

  private loadStore(): SandboxStore {
    try {
      const safePath = ensureSafeStorePath(STORE_PATH);
      if (fs.existsSync(safePath)) {
        const raw = fs.readFileSync(safePath, 'utf-8');
        const parsed = JSON.parse(raw) as SandboxStore;
        if (parsed && typeof parsed === 'object' && parsed.databases) {
          if (!parsed.databases.food_delivery) {
            const starter = createStarterStore();
            parsed.databases.food_delivery = starter.databases.food_delivery;
            this.saveStore(parsed);
          } else {
            const fd = parsed.databases.food_delivery;
            const gnocchi = fd.menu_items?.documents?.find((d) => d.sku === 'FD-GNOCCHI-01');
            if (gnocchi && Number(gnocchi.price) < 100) {
              const starter = createStarterStore();
              const starterFd = starter.databases.food_delivery;

              const starterRestBySlug = new Map(
                starterFd.restaurants.documents.map((r) => [String(r.slug), r]),
              );
              if (fd.restaurants?.documents) {
                fd.restaurants.documents = fd.restaurants.documents.map((r) => {
                  const match = starterRestBySlug.get(String(r.slug));
                  return match ? {...r, deliveryFee: match.deliveryFee} : r;
                });
              }

              const starterItemBySku = new Map(
                starterFd.menu_items.documents.map((m) => [String(m.sku), m]),
              );
              if (fd.menu_items?.documents) {
                fd.menu_items.documents = fd.menu_items.documents.map((m) => {
                  const match = starterItemBySku.get(String(m.sku));
                  return match
                    ? {...m, price: match.price, customOptions: match.customOptions}
                    : m;
                });
              }

              const starterOrderByNum = new Map(
                starterFd.orders.documents.map((o) => [String(o.orderNumber), o]),
              );
              if (fd.orders?.documents) {
                fd.orders.documents = fd.orders.documents.map((o) => {
                  const match = starterOrderByNum.get(String(o.orderNumber));
                  if (match) {
                    return {
                      ...o,
                      items: match.items,
                      subtotal: match.subtotal,
                      deliveryFee: match.deliveryFee,
                      total: match.total,
                      currency: 'INR',
                    };
                  }
                  if (o.currency !== 'INR' && Number(o.total ?? 0) < 150) {
                    const convertedItems = Array.isArray(o.items)
                      ? o.items.map((item) => {
                          const rec = item as Record<string, unknown>;
                          const qty = Number(rec.qty ?? 1);
                          const unitPrice = Math.round(Number(rec.unitPrice ?? 0) * 26.5);
                          return {
                            ...rec,
                            unitPrice,
                            lineTotal: unitPrice * qty,
                          };
                        })
                      : [];
                    const subtotal = convertedItems.reduce(
                      (sum, it) => sum + Number((it as Record<string, unknown>).lineTotal ?? 0),
                      0,
                    );
                    const deliveryFee = Number(o.deliveryFee ?? 0) > 0 ? Math.round(Number(o.deliveryFee) * 16.5) : 0;
                    return {
                      ...o,
                      items: convertedItems,
                      subtotal,
                      deliveryFee,
                      total: subtotal + deliveryFee,
                      currency: 'INR',
                    };
                  }
                  return o;
                });
              }

              this.saveStore(parsed);
            }
          }
          return parsed;
        }
      }
    } catch {
      // Fall back to starter store if unreadable
    }
    const starter = createStarterStore();
    this.saveStore(starter);
    return starter;
  }

  private saveStore(store: SandboxStore = this.store): void {
    fs.mkdirSync(DATA_DIR, {recursive: true});
    const safePath = ensureSafeStorePath(STORE_PATH);
    fs.writeFileSync(safePath, JSON.stringify(store, null, 2), 'utf-8');
  }

  private getCollection(db: string, collection: string): SandboxCollection {
    const dbObj = this.store.databases[db];
    if (!dbObj) throw new Error(`Database "${db}" does not exist`);
    const col = dbObj[collection];
    if (!col) throw new Error(`Collection "${db}.${collection}" does not exist`);
    return col;
  }

  listDatabases(): DatabaseSummary[] {
    return Object.entries(this.store.databases).map(([dbName, cols]) => {
      const collections = Object.entries(cols).map(([colName, col]) => {
        const rawSize = Buffer.byteLength(JSON.stringify(col.documents), 'utf-8');
        const count = col.documents.length;
        return {
          name: colName,
          count,
          storageSizeBytes: Math.max(4096, rawSize),
          avgObjSizeBytes: count > 0 ? Math.round(rawSize / count) : 0,
          indexCount: col.indexes.length,
        };
      });
      const sizeOnDiskBytes = collections.reduce((acc, c) => acc + c.storageSizeBytes, 0);
      return {name: dbName, sizeOnDiskBytes, collections};
    });
  }

  createDatabaseCollection(db: string, collection: string): void {
    if (!this.store.databases[db]) {
      this.store.databases[db] = {};
    }
    if (!this.store.databases[db][collection]) {
      this.store.databases[db][collection] = {
        documents: [],
        indexes: [{name: '_id_', key: {_id: 1}, unique: true}],
      };
    }
    this.saveStore();
  }

  dropCollection(db: string, collection: string): void {
    if (this.store.databases[db]) {
      delete this.store.databases[db][collection];
      if (Object.keys(this.store.databases[db]).length === 0) {
        delete this.store.databases[db];
      }
      this.saveStore();
    }
  }

  findDocuments(
    db: string,
    collection: string,
    filterRaw = '{}',
    projectionRaw = '{}',
    sortRaw = '{}',
    skip = 0,
    limit = 25,
  ): QueryDocumentsResponse {
    const start = performance.now();
    const col = this.getCollection(db, collection);
    const filter = normalizeValue(parseRelaxedJson(filterRaw, {})) as Record<string, unknown>;
    const projection = normalizeValue(parseRelaxedJson(projectionRaw, {})) as Record<string, unknown>;
    const sort = normalizeValue(parseRelaxedJson(sortRaw, {})) as Record<string, unknown>;

    const matched = col.documents.filter((doc) => matchesFilter(doc, filter));
    const totalCount = matched.length;
    const sorted = applySort(matched, sort);
    const sliced = sorted.slice(skip, skip + limit).map((doc) => applyProjection(doc, projection));

    return {
      documents: sliced,
      totalCount,
      executionMs: Math.max(1, Math.round(performance.now() - start)),
      mode: 'sandbox',
    };
  }

  insertDocument(db: string, collection: string, docRaw: string): Record<string, unknown> {
    const col = this.getCollection(db, collection);
    const parsed = normalizeValue(parseRelaxedJson(docRaw));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Document must be a JSON object');
    }
    const doc = {...(parsed as Record<string, unknown>)};
    if (!doc._id) {
      doc._id = generateObjectIdHex();
    }
    if (col.documents.some((existing) => valuesEqual(existing._id, doc._id))) {
      throw new Error(`Duplicate _id "${String(doc._id)}"`);
    }
    col.documents.unshift(doc);
    this.saveStore();
    return structuredClone(doc);
  }

  updateDocument(db: string, collection: string, id: string, replacementRaw: string): Record<string, unknown> {
    const col = this.getCollection(db, collection);
    const idx = col.documents.findIndex((d) => String(d._id) === id);
    if (idx === -1) {
      throw new Error(`Document with _id "${id}" not found`);
    }
    const parsed = normalizeValue(parseRelaxedJson(replacementRaw));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Document must be a JSON object');
    }
    const updated = {...(parsed as Record<string, unknown>), _id: col.documents[idx]._id};
    col.documents[idx] = updated;
    this.saveStore();
    return structuredClone(updated);
  }

  deleteDocument(db: string, collection: string, id: string): void {
    const col = this.getCollection(db, collection);
    const before = col.documents.length;
    col.documents = col.documents.filter((d) => String(d._id) !== id);
    if (col.documents.length === before) {
      throw new Error(`Document with _id "${id}" not found`);
    }
    this.saveStore();
  }

  runAggregation(db: string, collection: string, stages: AggregationStage[]): AggregationResponse {
    const start = performance.now();
    const col = this.getCollection(db, collection);
    let current = col.documents.map((d) => structuredClone(d));

    for (const stage of stages) {
      if (!stage.enabled) continue;
      const body = normalizeValue(parseRelaxedJson(stage.body));

      if (stage.operator === '$match') {
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          throw new Error('$match stage requires an object');
        }
        current = current.filter((doc) => matchesFilter(doc, body as Record<string, unknown>));
      } else if (stage.operator === '$sort') {
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          throw new Error('$sort stage requires an object');
        }
        current = applySort(current, body as Record<string, unknown>);
      } else if (stage.operator === '$limit') {
        const n = Number(body);
        if (!Number.isFinite(n) || n < 0) throw new Error('$limit requires a positive number');
        current = current.slice(0, Math.min(200, Math.floor(n)));
      } else if (stage.operator === '$skip') {
        const n = Number(body);
        if (!Number.isFinite(n) || n < 0) throw new Error('$skip requires a non-negative number');
        current = current.slice(Math.floor(n));
      } else if (stage.operator === '$project') {
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          throw new Error('$project stage requires an object');
        }
        current = current.map((doc) => applyProjection(doc, body as Record<string, unknown>));
      } else if (stage.operator === '$count') {
        const fieldName = typeof body === 'string' && body.trim() ? body.trim() : 'count';
        current = [{[fieldName]: current.length}];
      } else if (stage.operator === '$unwind') {
        const pathExpr = typeof body === 'string' ? body : (body as {path?: string})?.path;
        if (!pathExpr || !pathExpr.startsWith('$')) {
          throw new Error('$unwind expects a field path like "$items"');
        }
        const field = pathExpr.slice(1);
        const expanded: Record<string, unknown>[] = [];
        for (const doc of current) {
          const arr = getByDotPath(doc, field);
          if (Array.isArray(arr)) {
            for (const item of arr) {
              const copy = structuredClone(doc);
              setByDotPath(copy, field, item);
              expanded.push(copy);
            }
          }
        }
        current = expanded;
      } else if (stage.operator === '$group') {
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          throw new Error('$group stage requires an object');
        }
        const spec = body as Record<string, unknown>;
        const idExpr = spec._id;
        const groups = new Map<string, {keyVal: unknown; docs: Record<string, unknown>[]}>();

        for (const doc of current) {
          let keyVal: unknown = null;
          if (typeof idExpr === 'string' && idExpr.startsWith('$')) {
            keyVal = getByDotPath(doc, idExpr.slice(1)) ?? null;
          } else if (idExpr && typeof idExpr === 'object') {
            const composite: Record<string, unknown> = {};
            for (const [k, expr] of Object.entries(idExpr as Record<string, unknown>)) {
              composite[k] = typeof expr === 'string' && expr.startsWith('$') ? getByDotPath(doc, expr.slice(1)) : expr;
            }
            keyVal = composite;
          } else {
            keyVal = idExpr ?? null;
          }
          const mapKey = JSON.stringify(keyVal);
          const existing = groups.get(mapKey);
          if (existing) existing.docs.push(doc);
          else groups.set(mapKey, {keyVal, docs: [doc]});
        }

        const outDocs: Record<string, unknown>[] = [];
        for (const {keyVal, docs} of groups.values()) {
          const row: Record<string, unknown> = {_id: keyVal};
          for (const [outField, accExpr] of Object.entries(spec)) {
            if (outField === '_id') continue;
            if (accExpr && typeof accExpr === 'object') {
              const [[accOp, accArg]] = Object.entries(accExpr as Record<string, unknown>);
              if (accOp === '$sum') {
                if (typeof accArg === 'number') {
                  row[outField] = docs.length * accArg;
                } else if (typeof accArg === 'string' && accArg.startsWith('$')) {
                  const f = accArg.slice(1);
                  row[outField] = docs.reduce((s, d) => s + (Number(getByDotPath(d, f)) || 0), 0);
                }
              } else if (accOp === '$avg' && typeof accArg === 'string' && accArg.startsWith('$')) {
                const f = accArg.slice(1);
                const nums = docs.map((d) => Number(getByDotPath(d, f))).filter((n) => !Number.isNaN(n));
                row[outField] = nums.length ? Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2)) : null;
              } else if (accOp === '$min' && typeof accArg === 'string' && accArg.startsWith('$')) {
                const f = accArg.slice(1);
                const vals = docs.map((d) => getByDotPath(d, f)).filter((v) => v !== undefined);
                row[outField] = vals.sort(compareValues)[0] ?? null;
              } else if (accOp === '$max' && typeof accArg === 'string' && accArg.startsWith('$')) {
                const f = accArg.slice(1);
                const vals = docs.map((d) => getByDotPath(d, f)).filter((v) => v !== undefined);
                row[outField] = vals.sort(compareValues).at(-1) ?? null;
              } else if (accOp === '$count') {
                row[outField] = docs.length;
              }
            }
          }
          outDocs.push(row);
        }
        current = outDocs;
      }
    }

    return {
      results: current.slice(0, 200),
      executionMs: Math.max(1, Math.round(performance.now() - start)),
      mode: 'sandbox',
    };
  }

  analyzeSchema(db: string, collection: string): SchemaAnalysisResponse {
    const col = this.getCollection(db, collection);
    const totalCount = col.documents.length;
    const sampled = col.documents.slice(0, 200);
    const sampledCount = sampled.length;

    const fieldMap = new Map<
      string,
      {presence: number; typeCounts: Map<string, number>; samples: Set<string>}
    >();

    for (const doc of sampled) {
      for (const [field, val] of Object.entries(doc)) {
        let entry = fieldMap.get(field);
        if (!entry) {
          entry = {presence: 0, typeCounts: new Map(), samples: new Set()};
          fieldMap.set(field, entry);
        }
        entry.presence += 1;
        const t = detectTypeName(val);
        entry.typeCounts.set(t, (entry.typeCounts.get(t) ?? 0) + 1);
        if (entry.samples.size < 3) {
          const preview = typeof val === 'object' ? JSON.stringify(val) : String(val);
          entry.samples.add(preview.length > 48 ? preview.slice(0, 45) + '...' : preview);
        }
      }
    }

    const fields: SchemaFieldSummary[] = Array.from(fieldMap.entries()).map(([field, info]) => {
      const types = Array.from(info.typeCounts.entries()).map(([type, count]) => ({
        type,
        count,
        percentage: sampledCount ? Math.round((count / sampledCount) * 100) : 0,
      }));
      return {
        field,
        presenceCount: info.presence,
        presencePercentage: sampledCount ? Math.round((info.presence / sampledCount) * 100) : 0,
        types,
        samples: Array.from(info.samples),
      };
    });

    return {sampledCount, totalCount, fields};
  }

  listIndexes(db: string, collection: string): IndexSummary[] {
    return structuredClone(this.getCollection(db, collection).indexes);
  }

  createIndex(db: string, collection: string, keySpec: Record<string, 1 | -1 | 'text'>, unique: boolean): IndexSummary {
    const col = this.getCollection(db, collection);
    const name = Object.entries(keySpec)
      .map(([k, v]) => `${k}_${v}`)
      .join('_');
    if (col.indexes.some((i) => i.name === name)) {
      throw new Error(`Index "${name}" already exists`);
    }
    const created: IndexSummary = {name, key: keySpec, unique};
    col.indexes.push(created);
    this.saveStore();
    return created;
  }

  dropIndex(db: string, collection: string, indexName: string): void {
    if (indexName === '_id_') throw new Error('Cannot drop the default _id_ index');
    const col = this.getCollection(db, collection);
    col.indexes = col.indexes.filter((i) => i.name !== indexName);
    this.saveStore();
  }

  executeShell(db: string, command: string): ShellExecuteResponse {
    const start = performance.now();
    const trimmed = command.trim().replace(/;$/, '');
    try {
      if (trimmed === 'show dbs' || trimmed === 'show databases') {
        const dbs = this.listDatabases().map((d) => ({
          name: d.name,
          sizeOnDisk: d.sizeOnDiskBytes,
          collections: d.collections.length,
        }));
        return {ok: true, command, output: dbs, executionMs: Math.max(1, Math.round(performance.now() - start))};
      }
      if (trimmed === 'show collections' || trimmed === 'show tables') {
        const cols = Object.keys(this.store.databases[db] ?? {});
        return {ok: true, command, output: cols, executionMs: Math.max(1, Math.round(performance.now() - start))};
      }
      if (trimmed === 'db.stats()') {
        const cols = this.store.databases[db] ?? {};
        const docCount = Object.values(cols).reduce((s, c) => s + c.documents.length, 0);
        return {
          ok: true,
          command,
          output: {db, collections: Object.keys(cols).length, objects: docCount, ok: 1},
          executionMs: Math.max(1, Math.round(performance.now() - start)),
        };
      }

      const match = trimmed.match(/^db\.([a-zA-Z0-9_.-]+)\.(find|findOne|countDocuments|insertOne)\(([\s\S]*)\)$/);
      if (match) {
        const [, colName, method, argsRaw] = match;
        if (method === 'find') {
          const filterStr = argsRaw.trim() || '{}';
          const res = this.findDocuments(db, colName, filterStr, '{}', '{}', 0, 25);
          return {ok: true, command, output: res.documents, executionMs: res.executionMs};
        }
        if (method === 'findOne') {
          const filterStr = argsRaw.trim() || '{}';
          const res = this.findDocuments(db, colName, filterStr, '{}', '{}', 0, 1);
          return {ok: true, command, output: res.documents[0] ?? null, executionMs: res.executionMs};
        }
        if (method === 'countDocuments') {
          const filterStr = argsRaw.trim() || '{}';
          const res = this.findDocuments(db, colName, filterStr, '{}', '{}', 0, 1);
          return {ok: true, command, output: res.totalCount, executionMs: res.executionMs};
        }
        if (method === 'insertOne') {
          const inserted = this.insertDocument(db, colName, argsRaw);
          return {
            ok: true,
            command,
            output: {acknowledged: true, insertedId: inserted._id},
            executionMs: Math.max(1, Math.round(performance.now() - start)),
          };
        }
      }

      return {
        ok: false,
        command,
        output: null,
        executionMs: Math.max(1, Math.round(performance.now() - start)),
        error: 'Supported commands: show dbs, show collections, db.stats(), db.<col>.find({...}), db.<col>.findOne({...}), db.<col>.countDocuments({...}), db.<col>.insertOne({...})',
      };
    } catch (err) {
      return {
        ok: false,
        command,
        output: null,
        executionMs: Math.max(1, Math.round(performance.now() - start)),
        error: err instanceof Error ? err.message : 'Command execution failed',
      };
    }
  }
}
