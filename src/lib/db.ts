import Dexie, { Table } from 'dexie';

export interface LocalProduct {
  id?: string;
  barcode: string;
  name: string;
  price: number;
  stock: number;
  synced?: boolean;
}

export class PosDatabase extends Dexie {
  products!: Table<LocalProduct>;

  constructor() {
    super('PeddlrOfflineDB');
    this.version(1).stores({
      products: '++id, barcode, name, synced'
    });
  }
}

export const db = new PosDatabase();