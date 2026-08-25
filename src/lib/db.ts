import Dexie, { Table } from 'dexie';

export interface LocalProduct {
  id: string;
  name: string;
  price: number;
  cost?: number;             // <-- Add this line
  stock: number;
  min_stock?: number;
  unit?: string;             // <-- Add this line (prevents future TS errors)
  category?: string;         // <-- Add this line
  barcode?: string;
}

export interface LocalSale {
  id: string;
  total_amount: number;
  payment_method: string;
  created_at: string;
  items: { product_id: string; quantity: number; unit_price: number }[];
  synced: boolean;
}

export interface SyncQueue {
  id?: number;
  action: 'CREATE_SALE' | 'UPDATE_STOCK';
  payload: any;
  timestamp: number;
}

class POSDatabase extends Dexie {
  products!: Table<LocalProduct>;
  sales!: Table<LocalSale>;
  syncQueue!: Table<SyncQueue>;

  constructor() {
    super('POSOfflineDB');
    this.version(2).stores({
      products: 'id, name, barcode, stock',
      sales: 'id, created_at, synced',
      syncQueue: '++id, timestamp'
    });
  }
}

export const db = new POSDatabase();