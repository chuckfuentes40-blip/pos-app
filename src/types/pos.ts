export type ScanMethod = 'hardware' | 'camera' | 'manual';
export type PaymentMethod = 'cash' | 'gcash';
export type ActiveTab = 'pos' | 'inventory' | 'settings';

export interface Product {
  id: string;
  name: string;
  barcode: string;
  price: number;
  stock: number;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface ReceiptData {
  id: string;
  timestamp: string;
  items: CartItem[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  cashReceived?: number;
  changeDue?: number;
  gcashRefNumber?: string;
}