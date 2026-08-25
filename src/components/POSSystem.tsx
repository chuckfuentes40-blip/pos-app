'use client';

import React, { useState, useEffect, useRef } from 'react';
import CameraScanner from './CameraScanner';
 import { supabase } from '@/lib/supabase';
import { db } from '@/lib/db';
import {
  ShoppingCart,
  Package,
  BarChart3,
  BookOpen,
  Bluetooth,
  Sliders,
  Search,
  Plus,
  Trash2,
  Camera,
  Printer,
  Download,
  Mail,
  X,
  Check,
  Menu,
  Percent,
  Truck,
  User,
  Phone,
  MapPin,
  CreditCard,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Edit,
  Minus,
  FileText,
  CheckCircle2,
  Clock,
  Tag,
  Sun,
  Moon
} from 'lucide-react';

// --- Types & Interfaces ---
export type ScanMethod = 'hardware' | 'camera' | 'manual';
export type TabType = 'pos' | 'inventory' | 'analytics' | 'ledger' | 'settings';

export interface Product {
  id: string;
  name: string;
  price: number;
  cost: number;
  stock: number;
  lowStockThreshold: number;
  unit: string;
  barcode: string;
  category?: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface Customer {
  name: string;
  phone: string;
  address: string;
  notes: string;
}

export interface Transaction {
  id: string;
  timestamp: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  serviceFee: number;
  deliveryFee: number;
  netSales: number;
  paymentMethod: 'cash' | 'gcash';
  cashReceived?: number;
  changeDue?: number;
  gcashRefNumber?: string;
  customer?: Customer;
}

export interface LedgerEntry {
  id: string;
  customerName: string;
  phone: string;
  amount: number;
  dueDate: string;
  status: 'unpaid' | 'paid';
  description: string;
}

const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

// --- Initial Sample Data ---
const INITIAL_PRODUCTS: Product[] = [
  { id: '1', name: 'Coke Mismo 300ml', price: 20, cost: 15, stock: 45, lowStockThreshold: 10, unit: 'pcs', barcode: '4800016021011', category: 'Beverages' },
  { id: '2', name: 'San Miguel Light Can', price: 65, cost: 50, stock: 8, lowStockThreshold: 12, unit: 'pcs', barcode: '4800016021028', category: 'Beverages' },
  { id: '3', name: 'Lucky Me Instant Pancit Canton', price: 15, cost: 11, stock: 120, lowStockThreshold: 20, unit: 'pcs', barcode: '4800016021035', category: 'Groceries' },
  { id: '4', name: 'Marlboro Red Pack', price: 150, cost: 130, stock: 5, lowStockThreshold: 10, unit: 'pack', barcode: '4800016021042', category: 'Tobacco' },
  { id: '5', name: 'Gardenia Slice Bread White', price: 85, cost: 70, stock: 15, lowStockThreshold: 5, unit: 'pcs', barcode: '4800016021059', category: 'Bakery' },
];

const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'TRX-1001',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    items: [{ ...INITIAL_PRODUCTS[0], quantity: 2 }, { ...INITIAL_PRODUCTS[2], quantity: 4 }],
    subtotal: 100,
    discount: 0,
    serviceFee: 0,
    deliveryFee: 0,
    netSales: 100,
    paymentMethod: 'cash',
    cashReceived: 100,
    changeDue: 0
  },
  {
    id: 'TRX-1002',
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    items: [{ ...INITIAL_PRODUCTS[1], quantity: 2 }, { ...INITIAL_PRODUCTS[3], quantity: 1 }],
    subtotal: 280,
    discount: 10,
    serviceFee: 0,
    deliveryFee: 20,
    netSales: 290,
    paymentMethod: 'gcash',
    gcashRefNumber: '1234567890'
  }
];

const INITIAL_LEDGER: LedgerEntry[] = [
  { id: 'LED-1', customerName: 'Aling Nena', phone: '09171234567', amount: 450, dueDate: '2026-09-01', status: 'unpaid', description: 'Groceries & Softdrinks' },
  { id: 'LED-2', customerName: 'Mang Juan', phone: '09189876543', amount: 1200, dueDate: '2026-08-30', status: 'unpaid', description: 'Sack of Rice partial balance' },
  { id: 'LED-3', customerName: 'Tito Boy', phone: '09223334444', amount: 300, dueDate: '2026-08-20', status: 'paid', description: 'Cigarettes & Matches' }
];

export default function POSSystem() {
  // Navigation & UI state
  const [activeTab, setActiveTab] = useState<TabType>('pos');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Hardware / PWA setup
  const [posScanMethod, setPosScanMethod] = useState<ScanMethod>('hardware');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Data state
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pos_transactions');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [ledger, setLedger] = useState<LedgerEntry[]>(INITIAL_LEDGER);

  // POS Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Order Modifiers
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [serviceFee, setServiceFee] = useState<number>(0);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [activeFeeModal, setActiveFeeModal] = useState<'discount' | 'service' | 'delivery' | null>(null);
  const [feeInputValue, setFeeInputValue] = useState<string>('');

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gcash'>('cash');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [gcashRefNumber, setGcashRefNumber] = useState<string>('');

  // Customer State
  const [customer, setCustomer] = useState<Customer>({ name: '', phone: '', address: '', notes: '' });
  const [showCustomerFields, setShowCustomerFields] = useState<boolean>(false);

  // Modals and Camera
  const [isPosCameraOpen, setIsPosCameraOpen] = useState(false);
  const [isInlineScanning, setIsInlineScanning] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Product Form state
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCost, setFormCost] = useState('');
  const [formStock, setFormStock] = useState('');
  const [formLowStock, setFormLowStock] = useState('5');
  const [formUnit, setFormUnit] = useState('pcs');
  const [formBarcode, setFormBarcode] = useState('');

  // ✅ PLACE IT HERE (Inside POSSystem, after state definitions)
  const handleOpenProductModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormName(product.name);
      setFormPrice(product.price.toString());
      setFormCost(product.cost ? product.cost.toString() : '');
      setFormStock(product.stock.toString());
      setFormLowStock(product.lowStockThreshold ? product.lowStockThreshold.toString() : '5');
      setFormUnit(product.unit || 'pcs');
      setFormBarcode(product.barcode || '');
    } else {
      setEditingProduct(null);
      setFormName('');
      setFormPrice('');
      setFormCost('');
      setFormStock('');
      setFormLowStock('5');
      setFormUnit('pcs');
      setFormBarcode('');
    }
    setIsModalOpen(true);
  };

  // Export / Analytics / Receipt Modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportTab, setExportTab] = useState<'sales' | 'movement' | 'capital'>('sales');
  const [exportEmail, setExportEmail] = useState('owner@peddlr.ph');
  const [receiptData, setReceiptData] = useState<Transaction | null>(null);
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'utang' | 'paid'>('all');

  // Video scanner refs
  const posVideoRef = useRef<HTMLVideoElement | null>(null);
  const inlineVideoRef = useRef<HTMLVideoElement | null>(null);

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const handleBluetoothPrint = async () => {
  if (!receiptData) return;

  if (!('bluetooth' in navigator)) {
    alert('Web Bluetooth is not supported in this browser. Please use Chrome on Android or PC.');
    return;
  }

  try {
    // 1. Request access to nearby Bluetooth printers
    const device = await (navigator as any).bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb', // Standard ESC/POS
        '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Serial Port
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
      ]
    });

    // 2. Connect to GATT Server
    const server = await device.gatt.connect();

    // 3. Find Printable Service & Characteristic
    const services = await server.getPrimaryServices();
    let writeCharacteristic = null;

    for (const service of services) {
      const characteristics = await service.getCharacteristics();
      for (const char of characteristics) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          writeCharacteristic = char;
          break;
        }
      }
      if (writeCharacteristic) break;
    }

    if (!writeCharacteristic) {
      alert('Could not find a writeable channel on this Bluetooth device.');
      return;
    }

    

    // 4. Build ESC/POS Raw Data Stream (32 character width for 58mm)
    const encoder = new TextEncoder();
    let esc = '';

    // ESC/POS Command Constants
    const INIT = '\x1B\x40';
    const ALIGN_CENTER = '\x1B\x61\x01';
    const ALIGN_LEFT = '\x1B\x61\x00';
    const ALIGN_RIGHT = '\x1B\x61\x02';
    const BOLD_ON = '\x1B\x45\x01';
    const BOLD_OFF = '\x1B\x45\x00';
    const LINE_FEED = '\n';

    // Helper for 32-column formatted lines
    const formatLine = (left: string, right: string) => {
      const maxLen = 32;
      const spaceLen = Math.max(1, maxLen - (left.length + right.length));
      return left + ' '.repeat(spaceLen) + right + LINE_FEED;
    };

    // Build Receipt Content
    esc += INIT;
    esc += ALIGN_CENTER + BOLD_ON + 'INAKI STORE' + LINE_FEED + BOLD_OFF;
    esc += new Date(receiptData.timestamp).toLocaleString('en-PH') + LINE_FEED;
    esc += `Receipt #: ${receiptData.id}` + LINE_FEED;
    esc += '--------------------------------' + LINE_FEED;

    // Items
    esc += ALIGN_LEFT;
    receiptData.items.forEach((item) => {
      const name = item.name.length > 20 ? item.name.substring(0, 18) + '..' : item.name;
      const qtyPrice = `${item.quantity} x P${item.price.toFixed(2)}`;
      const total = `P${(item.price * item.quantity).toFixed(2)}`;

      esc += BOLD_ON + name + BOLD_OFF + LINE_FEED;
      esc += formatLine(`  ${qtyPrice}`, total);
    });

    esc += '--------------------------------' + LINE_FEED;

    // Totals
    if (receiptData.discount > 0) {
      esc += formatLine('DISCOUNT:', `-P${receiptData.discount.toFixed(2)}`);
    }
    if (receiptData.serviceFee > 0) {
      esc += formatLine('SERVICE FEE:', `+P${receiptData.serviceFee.toFixed(2)}`);
    }
    if (receiptData.deliveryFee > 0) {
      esc += formatLine('DELIVERY FEE:', `+P${receiptData.deliveryFee.toFixed(2)}`);
    }

    esc += BOLD_ON + formatLine('TOTAL:', `P${receiptData.netSales.toFixed(2)}`) + BOLD_OFF;
    esc += formatLine('PAYMENT:', receiptData.paymentMethod.toUpperCase());

    if (receiptData.paymentMethod === 'cash') {
      esc += formatLine('RECEIVED:', `P${(receiptData.cashReceived || 0).toFixed(2)}`);
      esc += formatLine('CHANGE:', `P${(receiptData.changeDue || 0).toFixed(2)}`);
    } else if (receiptData.paymentMethod === 'gcash' && receiptData.gcashRefNumber) {
      esc += formatLine('REF NO:', receiptData.gcashRefNumber);
    }

    if (receiptData.customer?.name) {
      esc += '--------------------------------' + LINE_FEED;
      esc += `Customer: ${receiptData.customer.name}` + LINE_FEED;
    }

    // Footer & Extra Feeds for Paper Tear
    esc += '--------------------------------' + LINE_FEED;
    esc += ALIGN_CENTER + BOLD_ON + 'Maraming Salamat Po!' + LINE_FEED + BOLD_OFF;
    esc += 'Please Come Again' + LINE_FEED;
    esc += LINE_FEED + LINE_FEED + LINE_FEED; // Feed paper

    // 5. Send Chunked Bytes to Bluetooth Printer (20-byte MTU limit handling)
    const data = encoder.encode(esc);
    const chunkSize = 20;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      await writeCharacteristic.writeValue(chunk);
    }

    alert('Receipt printed successfully!');
  } catch (error: any) {
    console.error('Bluetooth Print Error:', error);
    alert(`Bluetooth Print Failed: ${error.message || 'Device disconnected or cancelled'}`);
  }
};

// Safe helper to prevent toFixed runtime crashes
const formatMoney = (val: number | string | undefined | null): string => {
  const num = Number(val);
  return isNaN(num) ? '0.00' : num.toFixed(2);
};

const fetchTransactions = async () => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('timestamp', { ascending: false });

  if (error) {
    console.error('Error fetching transactions:', error);
    return;
  }

  // Map lowercase Supabase keys to React camelCase keys
  const normalizedTransactions = (data || []).map((trx: any) => ({
    id: trx.id,
    timestamp: trx.timestamp,
    items: Array.isArray(trx.items) ? trx.items : [],
    subtotal: Number(trx.subtotal || 0),
    discount: Number(trx.discount || 0),
    serviceFee: Number(trx.servicefee ?? trx.serviceFee ?? 0),
    deliveryFee: Number(trx.deliveryfee ?? trx.deliveryFee ?? 0),
    netSales: Number(trx.netsales ?? trx.netSales ?? 0),
    paymentMethod: trx.paymentmethod || trx.paymentMethod || 'cash',
    cashReceived: Number(trx.cashreceived ?? trx.cashReceived ?? 0),
    changeDue: Number(trx.changedue ?? trx.changeDue ?? 0),
    gcashRefNumber: trx.gcashrefnumber || trx.gcashRefNumber || '',
    customer: trx.customer || undefined,
  }));

  setTransactions(normalizedTransactions);
};

// Load saved theme preference on mount
useEffect(() => {
  const savedTheme = localStorage.getItem('pos_theme') as 'dark' | 'light';
  if (savedTheme) {
    setTheme(savedTheme);
  }
}, []);

const handleThemeChange = (newTheme: 'dark' | 'light') => {
  setTheme(newTheme);
  localStorage.setItem('pos_theme', newTheme);
};

useEffect(() => {
  const loadInitialData = async () => {
    try {
      if (navigator.onLine) {
        // 1. Load Products from Supabase
        const { data: prodData, error: prodError } = await supabase.from('products').select('*');
        if (!prodError && prodData) {
          setProducts(prodData);

          const dexieFormat = prodData.map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            stock: p.stock,
            min_stock: p.lowStockThreshold || p.min_stock,
            barcode: p.barcode,
          }));
          await db.products.bulkPut(dexieFormat);
        }

        // 2. Load Transactions from Supabase
        const { data: trxData, error: trxError } = await supabase
          .from('transactions')
          .select('*')
          .order('timestamp', { ascending: false });

        if (!trxError && trxData) {
          setTransactions(trxData);
          if (db.sales) {
            await db.sales.bulkPut(trxData);
          }
          return;
        }
      }

      // 3. Fallback to Dexie IndexedDB if offline
      const localProducts = await db.products.toArray();
      if (localProducts.length > 0) {
        setProducts(localProducts as any);
      }

      if (db.sales) {
        const localTransactions = await db.sales.toArray();
        if (localTransactions.length > 0) {
          localTransactions.sort(
            (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          setTransactions(localTransactions as any);
        }
      }
    } catch (err) {
      console.error('Error loading initial data:', err);
    }
  };

  loadInitialData();
}, []);

// Load persisted products from LocalStorage on mount
useEffect(() => {
  const savedProducts = localStorage.getItem('pos_products');
  if (savedProducts) {
    try {
      setProducts(JSON.parse(savedProducts));
    } catch (err) {
      console.error('Failed to parse stored products:', err);
    }
  }
}, []);


  // PWA install prompt handler
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallApp = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          setDeferredPrompt(null);
        }
      });
    }
  };

  // Cart Calculations
  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const netSales = Math.max(0, subtotal - discountAmount + serviceFee + deliveryFee);
  const parsedCash = parseFloat(cashReceived) || 0;
  const changeDue = Math.max(0, parsedCash - netSales);

  // Cart Handlers
  const addToCart = (product: Product) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === product.id);
      if (existing) {
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

const handleCheckout = async (action: 'bt_print' | 'standard_print' | 'close' = 'close') => {
  if (cart.length === 0) return;
  
  if (paymentMethod === 'cash' && parsedCash < netSales) {
    alert('Cash received is insufficient!');
    return;
  }

  const transactionId = `TRX-${Date.now().toString().slice(-5)}`;
  const currentTimestamp = new Date().toISOString();

  const newTransaction: Transaction = {
    id: transactionId,
    timestamp: currentTimestamp,
    items: [...cart],
    subtotal: subtotal || 0,
    discount: discountAmount || 0,
    serviceFee: serviceFee || 0,
    deliveryFee: deliveryFee || 0,
    netSales: netSales || 0,
    paymentMethod,
    cashReceived: paymentMethod === 'cash' ? parsedCash : undefined,
    changeDue: paymentMethod === 'cash' ? changeDue : undefined,
    gcashRefNumber: paymentMethod === 'gcash' ? gcashRefNumber : undefined,
    customer: customer?.name ? { ...customer } : undefined,
  };

  // 1. Local state updates
  setTransactions((prev) => [newTransaction, ...(prev || [])]);
  setReceiptData(newTransaction);

  // 2. Persist to Supabase
  if (navigator.onLine) {
    const supabasePayload = {
      id: transactionId,
      timestamp: currentTimestamp,
      items: cart,
      subtotal: subtotal || 0,
      discount: discountAmount || 0,
      servicefee: serviceFee || 0,
      deliveryfee: deliveryFee || 0,
      netsales: netSales || 0,
      paymentmethod: paymentMethod,
      cashreceived: paymentMethod === 'cash' ? parsedCash : null,
      changedue: paymentMethod === 'cash' ? changeDue : null,
      gcashrefnumber: paymentMethod === 'gcash' ? gcashRefNumber || null : null,
      customer: customer?.name ? customer : null,
    };

    supabase.from('transactions').insert([supabasePayload]).then(({ error }) => {
      if (error) console.error('Supabase Error:', error.message);
    });

    // Update stock in background
    for (const item of cart) {
      const product = products.find((p) => p.id === item.id);
      if (product) {
        const newStock = Math.max(0, (product.stock || 0) - item.quantity);
        supabase.from('products').update({ stock: newStock }).eq('id', item.id);
      }
    }
  }

  // 3. Trigger requested print action
  if (action === 'standard_print') {
    setTimeout(() => window.print(), 200);
  } else if (action === 'bt_print') {
    // Call your custom Bluetooth print function if defined
    if (typeof (window as any).printViaBluetooth === 'function') {
      (window as any).printViaBluetooth(newTransaction);
    } else {
      window.print();
    }
  }

  // 4. Clear forms and close modal
  setCart([]);
  setDiscountAmount(0);
  setServiceFee(0);
  setDeliveryFee(0);
  setCashReceived('');
  setGcashRefNumber('');
  setCustomer({ name: '', phone: '', address: '', notes: '' });
  setShowCustomerFields(false);
  setIsPaymentModalOpen(false);
};
 

  // Fee / Discount Modal
  const handleOpenFeeModal = (type: 'discount' | 'service' | 'delivery') => {
    setActiveFeeModal(type);
    if (type === 'discount') setFeeInputValue(discountAmount.toString());
    if (type === 'service') setFeeInputValue(serviceFee.toString());
    if (type === 'delivery') setFeeInputValue(deliveryFee.toString());
  };

  const handleApplyFeeModal = () => {
    const val = parseFloat(feeInputValue) || 0;
    if (activeFeeModal === 'discount') setDiscountAmount(val);
    if (activeFeeModal === 'service') setServiceFee(val);
    if (activeFeeModal === 'delivery') setDeliveryFee(val);
    setActiveFeeModal(null);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
  e.preventDefault();

  // Helper to ensure IDs always conform to standard UUID v4 format
  const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const productId = editingProduct ? editingProduct.id : generateUUID();

  const productData: Product = {
    id: productId,
    name: formName,
    price: parseFloat(formPrice) || 0,
    cost: parseFloat(formCost) || 0,
    stock: parseInt(formStock) || 0,
    lowStockThreshold: parseInt(formLowStock) || 5,
    unit: formUnit || 'pcs',
    barcode: formBarcode || Date.now().toString(),
    category: 'General',
  };

  try {
    // 1. Save locally to Dexie IndexedDB FIRST
    if (db.products) {
      await db.products.put({
        id: productData.id,
        name: productData.name,
        price: productData.price,
        stock: productData.stock,
        min_stock: productData.lowStockThreshold,
        barcode: productData.barcode,
      });
    }

    // 2. Update React State immediately
    if (editingProduct) {
      setProducts((prev) => prev.map((p) => (p.id === editingProduct.id ? productData : p)));
    } else {
      setProducts((prev) => [productData, ...prev]);
    }

    // 3. Close Modal
    setIsModalOpen(false);
    setIsInlineScanning(false);

    // 4. Background Sync to Supabase (EXACT match to table schema)
    if (navigator.onLine) {
      const supabasePayload = {
        id: productData.id,
        barcode: productData.barcode || null,
        name: productData.name,
        price: productData.price,
        cost: productData.cost,
        stock: productData.stock,
        min_stock: productData.lowStockThreshold,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('products')
        .upsert(supabasePayload, { onConflict: 'id' });

      if (error) {
        console.error('Supabase Sync Error:', error.message);
        alert(`Saved locally, but failed to sync to Supabase: ${error.message}`);
        return;
      }
    }

    alert(`Product "${formName}" saved successfully!`);
  } catch (err: any) {
    console.error('Local save error:', err);
    alert(`Failed to save product locally: ${err.message || 'Unknown error'}`);
  }
};

const handleDeleteProduct = (id: string) => {
  if (confirm('Are you sure you want to delete this product?')) {
    const updatedProducts = products.filter((p) => p.id !== id);

    // Update State and LocalStorage
    setProducts(updatedProducts);
    localStorage.setItem('pos_products', JSON.stringify(updatedProducts));

    alert('Product deleted successfully.');
  }
};

  // Categories list
  const categories = ['All', ...Array.from(new Set(products.map((p) => p.category || 'General')))];

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode.includes(searchQuery);
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCat;
  });
//// 1. Time Filter State
  const [timeFilter, setTimeFilter] = useState<'daily' | 'weekly' | 'monthly' | 'all'>('daily');

  // 2. Filter transactions based on selected range
  const filteredTransactions = (transactions || []).filter((t) => {
    if (!t.timestamp) return false;
    const tDate = new Date(t.timestamp);
    const now = new Date();

    if (timeFilter === 'daily') {
      return tDate.toDateString() === now.toDateString();
    }
    if (timeFilter === 'weekly') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      return tDate >= sevenDaysAgo;
    }
    if (timeFilter === 'monthly') {
      return (
        tDate.getMonth() === now.getMonth() &&
        tDate.getFullYear() === now.getFullYear()
      );
    }
    return true; // 'all'
  });

  // 3. Analytics Metrics (Calculated from filteredTransactions)
  const totalSalesVal = filteredTransactions.reduce((sum, t) => {
    const val = Number(t.netSales ?? (t as any).netsales ?? 0);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const totalGCashSalesVal = filteredTransactions.reduce((sum, t) => {
    const method = (t.paymentMethod || (t as any).paymentmethod || '').toLowerCase();
    if (method === 'gcash') {
      const val = Number(t.netSales ?? (t as any).netsales ?? 0);
      return sum + (isNaN(val) ? 0 : val);
    }
    return sum;
  }, 0);

  const totalCostVal = filteredTransactions.reduce((sum, t) => {
    const items = Array.isArray(t.items) ? t.items : [];
    const costOfItems = items.reduce((c, i) => {
      const cost = Number(i.cost ?? (i as any).unit_cost ?? 0);
      const qty = Number(i.quantity ?? (i as any).qty ?? 1);
      const total = cost * qty;
      return c + (isNaN(total) ? 0 : total);
    }, 0);
    return sum + costOfItems;
  }, 0);

  const grossProfit = totalSalesVal - totalCostVal;

  const totalInventoryCapital = (products || []).reduce((sum, p) => {
    const cost = Number(p.cost ?? 0);
    const stock = Number(p.stock ?? 0);
    const val = cost * stock;
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  return (
  <div
    className={`flex h-screen w-screen overflow-hidden font-sans select-none transition-colors duration-200 ${
      theme === 'dark'
        ? 'bg-slate-950 text-slate-100'
        : 'bg-slate-100 text-slate-900'
    }`}
  >
    {/* Mobile & Tablet Drawer Backdrop */}
    {isSidebarOpen && (
      <div
        onClick={() => setIsSidebarOpen(false)}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 2xl:hidden transition-opacity"
      />
    )}

    {/* Sidebar Navigation */}
    <aside
      className={`fixed 2xl:static top-0 bottom-0 left-0 z-50 w-64 ${
        theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
      } border-r flex flex-col justify-between transition-transform duration-300 ease-in-out ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } 2xl:translate-x-0`}
    >
      <div>
        {/* Logo & Header */}
        <div className={`p-4 sm:p-5 border-b ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <img
              src="/Inaki.png"
              alt="IÑAKI Logo"
              className="h-8 w-8 mx-auto rounded-lg object-cover mb-1 border border-gray-200 print:border-none"
            />
            <div>
              <h1 className={`font-extrabold text-base tracking-wide ${
                theme === 'dark'
                  ? 'bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent'
                  : 'text-slate-900'
              }`}>
                IÑAKI
              </h1>
              <p className={`text-[10px] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'} font-medium`}>
                SARI-SARI Store Terminal
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className={`2xl:hidden p-1.5 rounded-lg ${
              theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <X size={18} />
          </button>
        </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1.5">
            {[
              { id: 'pos', label: 'POS Terminal', icon: ShoppingCart },
              { id: 'inventory', label: 'Inventory', icon: Package },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 },
              { id: 'ledger', label: 'Utang Ledger', icon: BookOpen },
              { id: 'settings', label: 'Hardware Settings', icon: Sliders },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as TabType);
                    setIsSidebarOpen(false); // Close drawer when selecting navigation link
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-600/30'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <Icon size={18} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Store Profile Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-fuchsia-400">
              S
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-200 truncate">Sari-Sari Store Main</p>
              <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Online Sync
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Top Header Bar with Hamburger Button for Android Tablets and Mobile */}
        <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="2xl:hidden p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition"
              aria-label="Open Navigation Menu"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-sm sm:text-base font-bold tracking-wide capitalize text-slate-100 flex items-center gap-2">
              {activeTab === 'pos' && <ShoppingCart size={18} className="text-fuchsia-400" />}
              {activeTab === 'inventory' && <Package size={18} className="text-fuchsia-400" />}
              {activeTab === 'analytics' && <BarChart3 size={18} className="text-fuchsia-400" />}
              {activeTab === 'ledger' && <BookOpen size={18} className="text-fuchsia-400" />}
              {activeTab === 'settings' && <Sliders size={18} className="text-fuchsia-400" />}
              {activeTab === 'pos' ? 'POS Checkout Terminal' : activeTab}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700 hidden sm:inline-block">
              {new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </header>

        {/* Tab Body Contents */}
        <main className="flex-1 overflow-hidden flex min-w-0">
          
          {/* 1. POS Terminal Tab */}
          {activeTab === 'pos' && (
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-w-0">
              
              {/* Product Catalog Column */}
              <div className="flex-1 flex flex-col border-r border-slate-800 overflow-hidden min-w-0">
                
                {/* Search & Scan Controls */}
                <div className="p-3 sm:p-4 bg-slate-900/60 border-b border-slate-800 space-y-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
                      <input
                        type="text"
                        placeholder="Search product name or barcode..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    <button
                    onClick={() => setIsPosCameraOpen(true)}
                    className="px-3.5 py-2 bg-fuchsia-600/20 hover:bg-fuchsia-600/30 text-fuchsia-400 border border-fuchsia-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shrink-0"
                  >
                    <Camera size={16} />
                    <span className="hidden sm:inline landscape:inline">Camera Scan</span>
                  </button>
                  </div>
                </div>

                {/* Product Grid */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredProducts.map((product) => {
                    const isLowStock = product.stock <= product.lowStockThreshold;
                    const isOutOfStock = product.stock <= 0;

                    return (
                      <button
                        key={product.id}
                        onClick={() => addToCart(product)}
                        disabled={isOutOfStock}
                        className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between relative group ${
                          isOutOfStock
                            ? 'bg-slate-900/40 border-slate-800/60 opacity-50 cursor-not-allowed'
                            : 'bg-slate-900 border-slate-800/80 hover:border-fuchsia-500/50 hover:bg-slate-850'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-1 mb-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-400 bg-fuchsia-600/10 px-2 py-0.5 rounded-md">
                              {product.category || 'Item'}
                            </span>
                            {isLowStock && !isOutOfStock && (
                              <span className="text-[9px] bg-amber-500/20 text-amber-400 font-bold px-1.5 py-0.5 rounded">
                                Low
                              </span>
                            )}
                          </div>

                          <h3 className="font-bold text-xs sm:text-sm text-slate-100 line-clamp-2 leading-snug">
                            {product.name}
                          </h3>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                          <span className="font-mono font-bold text-sm text-white">
                            ₱{product.price.toFixed(2)}
                          </span>
                          <span className={`text-[10px] font-mono ${isOutOfStock ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                            {isOutOfStock ? 'OUT OF STOCK' : `${product.stock} ${product.unit}`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cart Summary Column */}
              <div className="w-full lg:w-80 xl:w-96 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col shrink-0">
                <div className="p-3 sm:p-4 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart size={18} className="text-fuchsia-400" />
                    <h3 className="font-bold text-sm text-slate-100">Current Order</h3>
                  </div>
                  {cart.length > 0 && (
                    <button
                      onClick={() => setCart([])}
                      className="text-xs text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1"
                    >
                      <Trash2 size={12} /> Clear
                    </button>
                  )}
                </div>

                {/* Cart Items List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                      <ShoppingCart size={36} className="text-slate-700 stroke-1" />
                      <p className="text-xs font-semibold">Cart is empty</p>
                      <p className="text-[11px] text-slate-600">Select items from catalog to build order</p>
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div
                        key={item.id}
                        className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-xs text-slate-200 truncate">{item.name}</h4>
                          <p className="text-[10px] font-mono text-slate-400">₱{item.price.toFixed(2)} / {item.unit}</p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="h-6 w-6 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center font-bold text-xs"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="font-mono text-xs font-bold px-1.5 min-w-[20px] text-center text-white">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="h-6 w-6 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center font-bold text-xs"
                          >
                            <Plus size={12} />
                          </button>
                        </div>

                        <div className="text-right min-w-[60px]">
                          <p className="font-mono font-bold text-xs text-white">
                            ₱{(item.price * item.quantity).toFixed(2)}
                          </p>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-[10px] text-slate-500 hover:text-rose-400"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Checkout Section */}
                <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950 space-y-3">
                  
                  {/* Fee & Discount Quick Buttons */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => handleOpenFeeModal('discount')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition flex items-center justify-center gap-1 ${
                        discountAmount > 0
                          ? 'bg-fuchsia-600/20 border-fuchsia-500/50 text-fuchsia-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Percent size={12} /> Disc: ₱{discountAmount}
                    </button>

                    <button
                      onClick={() => handleOpenFeeModal('service')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition flex items-center justify-center gap-1 ${
                        serviceFee > 0
                          ? 'bg-fuchsia-600/20 border-fuchsia-500/50 text-fuchsia-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Tag size={12} /> Fee: ₱{serviceFee}
                    </button>

                    <button
                      onClick={() => handleOpenFeeModal('delivery')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition flex items-center justify-center gap-1 ${
                        deliveryFee > 0
                          ? 'bg-fuchsia-600/20 border-fuchsia-500/50 text-fuchsia-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Truck size={12} /> Del: ₱{deliveryFee}
                    </button>
                  </div>

                  {/* Customer Information Drawer */}
                  <div>
                    <button
                      onClick={() => setShowCustomerFields(!showCustomerFields)}
                      className="text-[11px] font-bold text-fuchsia-400 hover:underline flex items-center gap-1"
                    >
                      <User size={12} /> {customer.name ? `Customer: ${customer.name}` : '+ Attach Customer Info'}
                    </button>

                    {showCustomerFields && (
                      <div className="mt-2 space-y-2 p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs">
                        <input
                          type="text"
                          placeholder="Customer Name"
                          value={customer.name}
                          onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100"
                        />
                        <input
                          type="text"
                          placeholder="Phone Number"
                          value={customer.phone}
                          onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-100"
                        />
                      </div>
                    )}
                  </div>

                  {/* Payment Method Selector */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => setPaymentMethod('cash')}
                      className={`py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        paymentMethod === 'cash'
                          ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <DollarSign size={14} /> Cash
                    </button>
                    <button
                      onClick={() => setPaymentMethod('gcash')}
                      className={`py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        paymentMethod === 'gcash'
                          ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <CreditCard size={14} /> GCash
                    </button>
                  </div>

                  {/* Cash or GCash Input Fields */}
                  {paymentMethod === 'cash' ? (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-400 font-semibold">
                        <span>Cash Tendered:</span>
                        {parsedCash > 0 && <span>Change: ₱{changeDue.toFixed(2)}</span>}
                      </div>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono font-bold text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-xs text-slate-400 font-semibold block">GCash Reference No.</label>
                      <input
                        type="text"
                        placeholder="e.g. 1002345678"
                        value={gcashRefNumber}
                        onChange={(e) => setGcashRefNumber(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  {/* Right Sidebar - Cart & Total */}
                <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col h-full">
                  {/* Header */}
                  <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                    <h2 className="font-bold text-sm text-white flex items-center gap-2">
                      <ShoppingCart size={16} className="text-fuchsia-500" />
                      Current Order
                    </h2>
                    {cart.length > 0 && (
                      <button
                        onClick={() => setCart([])}
                        className="text-[10px] text-red-400 hover:text-red-300 font-bold uppercase transition"
                      >
                        Clear Cart
                      </button>
                    )}
                  </div>

                  {/* Cart Items List */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {cart.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                        <ShoppingCart size={32} className="mb-2 opacity-30" />
                        <p>Cart is empty</p>
                        <p className="text-[10px] text-slate-600">Select items from catalog to build order</p>
                      </div>
                    ) : (
                      cart.map((item) => (
                        <div
                          key={item.id}
                          className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/60 flex justify-between items-center text-xs"
                        >
                          <div className="flex-1 min-w-0 pr-2">
                            <p className="font-bold text-slate-200 truncate">{item.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              ₱{item.price.toFixed(2)} × {item.quantity}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                              className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
                            >
                              -
                            </button>
                            <span className="font-mono text-xs text-white px-1">{item.quantity}</span>
                            <button
                              onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                              className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Sidebar Controls & Total */}
                  <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-3">
                    {/* Discount & Fee Quick Action Buttons */}
                    <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                      <button
                        onClick={() => {
                          const val = prompt('Enter discount amount (₱):', discountAmount.toString());
                          if (val !== null) setDiscountAmount(parseFloat(val) || 0);
                        }}
                        className="py-1.5 bg-slate-900 border border-slate-800 hover:border-fuchsia-500 rounded-lg text-slate-300 font-medium"
                      >
                        % Disc: ₱{discountAmount}
                      </button>
                      <button
                        onClick={() => {
                          const val = prompt('Enter service fee (₱):', serviceFee.toString());
                          if (val !== null) setServiceFee(parseFloat(val) || 0);
                        }}
                        className="py-1.5 bg-slate-900 border border-slate-800 hover:border-fuchsia-500 rounded-lg text-slate-300 font-medium"
                      >
                        🏷️ Fee: ₱{serviceFee}
                      </button>
                      <button
                        onClick={() => {
                          const val = prompt('Enter delivery fee (₱):', deliveryFee.toString());
                          if (val !== null) setDeliveryFee(parseFloat(val) || 0);
                        }}
                        className="py-1.5 bg-slate-900 border border-slate-800 hover:border-fuchsia-500 rounded-lg text-slate-300 font-medium"
                      >
                        🚚 Del: ₱{deliveryFee}
                      </button>
                    </div>

                    {/* Customer Info Toggle */}
                    <button
                      onClick={() => setShowCustomerFields(!showCustomerFields)}
                      className="text-xs text-fuchsia-400 hover:text-fuchsia-300 font-bold flex items-center gap-1"
                    >
                      👤 {showCustomerFields ? 'Hide Customer Info' : '+ Attach Customer Info'}
                    </button>

                    {showCustomerFields && (
                      <div className="space-y-1.5 pt-1">
                        <input
                          type="text"
                          placeholder="Customer Name"
                          value={customer.name}
                          onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
                        />
                        <input
                          type="text"
                          placeholder="Phone Number"
                          value={customer.phone}
                          onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
                        />
                      </div>
                    )}

                    {/* Calculation Breakdown */}
                    <div className="pt-2 border-t border-slate-800/80 space-y-1 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Subtotal</span>
                        <span className="font-mono">₱{subtotal.toFixed(2)}</span>
                      </div>
                      {discountAmount > 0 && (
                        <div className="flex justify-between text-fuchsia-400">
                          <span>Discount</span>
                          <span className="font-mono">-₱{discountAmount.toFixed(2)}</span>
                        </div>
                      )}
                      {serviceFee > 0 && (
                        <div className="flex justify-between text-slate-400">
                          <span>Service Fee</span>
                          <span className="font-mono">+₱{serviceFee.toFixed(2)}</span>
                        </div>
                      )}
                      {deliveryFee > 0 && (
                        <div className="flex justify-between text-slate-400">
                          <span>Delivery Fee</span>
                          <span className="font-mono">+₱{deliveryFee.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-extrabold text-white pt-1 border-t border-slate-800/50">
                        <span>NET TOTAL</span>
                        <span className="font-mono text-base text-fuchsia-400">₱{netSales.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Complete Payment Button */}
                    <button
                      type="button"
                      onClick={() => setIsPaymentModalOpen(true)}
                      disabled={cart.length === 0}
                      className={`w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition shadow-lg ${
                        cart.length > 0
                          ? 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white shadow-fuchsia-600/30'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      COMPLETE PAYMENT (₱{netSales.toFixed(2)})
                    </button>
                  </div>
                </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Inventory Tab */}
          {activeTab === 'inventory' && (
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold">Inventory Management</h2>
                  <p className="text-xs text-slate-400">Track stock levels, costs, and product barcodes</p>
                </div>
                <button
                  onClick={() => handleOpenProductModal()}
                  className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-2 self-start sm:self-auto shadow-md shadow-fuchsia-600/30"
                >
                  <Plus size={16} /> Add Product
                </button>
              </div>

              {/* Table Container */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="p-3.5">Product</th>
                        <th className="p-3.5">Barcode</th>
                        <th className="p-3.5">Price</th>
                        <th className="p-3.5">Cost</th>
                        <th className="p-3.5">Stock</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-xs">
                      {products.map((p) => {
                        const isLow = p.stock <= p.lowStockThreshold;
                        return (
                          <tr key={p.id} className="hover:bg-slate-850/50 transition">
                            <td className="p-3.5 font-bold text-slate-200">
                              {p.name}
                              <span className="block text-[10px] font-normal text-slate-500">{p.category || 'General'}</span>
                            </td>
                            <td className="p-3.5 font-mono text-slate-400">{p.barcode}</td>
                            <td className="p-3.5 font-mono text-emerald-400 font-bold">₱{p.price.toFixed(2)}</td>
                            <td className="p-3.5 font-mono text-slate-400">₱{p.cost.toFixed(2)}</td>
                            <td className="p-3.5 font-mono">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isLow ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {p.stock} {p.unit}
                              </span>
                            </td>
                            <td className="p-3.5 text-right space-x-2">
                              <button
                                onClick={() => handleOpenProductModal(p)}
                                className="p-1.5 text-slate-400 hover:text-fuchsia-400 hover:bg-slate-800 rounded-lg transition"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(p.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

         {/* 3. Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6 min-w-0">
            {/* Header & Filter Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg sm:text-xl font-bold">Business Analytics</h2>
                <p className="text-xs text-slate-400">Sales performance and financial metrics</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Time Range Selector */}
                <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex items-center gap-1 text-xs font-semibold">
                  {(['daily', 'weekly', 'monthly', 'all'] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => setTimeFilter(range)}
                      className={`px-3 py-1.5 rounded-lg capitalize transition ${
                        timeFilter === range
                          ? 'bg-blue-600 text-white font-bold shadow'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      {range === 'all' ? 'All Time' : range}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setIsExportModalOpen(true)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-2 border border-slate-700"
                >
                  <Mail size={14} /> Export Report
                </button>
              </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {/* Total Revenue */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <p className="text-xs text-slate-400 font-semibold mb-1">Total Sales Revenue</p>
                <p className="text-2xl font-black font-mono text-emerald-400">
                  ₱{(totalSalesVal || 0).toFixed(2)}
                </p>
              </div>

              {/* Total GCash Sales */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <p className="text-xs text-slate-400 font-semibold mb-1">Total GCash Sales</p>
                <p className="text-2xl font-black font-mono text-blue-400">
                  ₱{(totalGCashSalesVal || 0).toFixed(2)}
                </p>
              </div>

              {/* Gross Profit */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <p className="text-xs text-slate-400 font-semibold mb-1">Gross Profit</p>
                <p className="text-2xl font-black font-mono text-fuchsia-400">
                  ₱{(grossProfit || 0).toFixed(2)}
                </p>
              </div>

              {/* Total Orders */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <p className="text-xs text-slate-400 font-semibold mb-1">Total Orders</p>
                <p className="text-2xl font-black font-mono text-white">
                  {filteredTransactions.length}
                </p>
              </div>

              {/* Inventory Capital Value */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <p className="text-xs text-slate-400 font-semibold mb-1">Inventory Capital Value</p>
                <p className="text-2xl font-black font-mono text-amber-400">
                  ₱{(totalInventoryCapital || 0).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Transaction Logs */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
              <h3 className="text-sm font-bold text-slate-100 mb-4 capitalize">
                Recent Sales Activity ({timeFilter})
              </h3>
              <div className="space-y-2">
                {filteredTransactions.map((trx) => {
                  const netSalesVal = Number(trx.netSales ?? (trx as any).netsales ?? 0);
                  const itemsCount = Array.isArray(trx.items) ? trx.items.length : 0;
                  const payment = trx.paymentMethod || (trx as any).paymentmethod || 'CASH';

                  return (
                    <div
                      key={trx.id}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-fuchsia-400">{trx.id}</span>
                        <p className="text-[10px] text-slate-500">
                          {trx.timestamp
                            ? new Date(trx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : 'N/A'}{' '}
                          • {itemsCount} items
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-white">
                          ₱{netSalesVal.toFixed(2)}
                        </span>
                        <span
                          className={`block text-[10px] uppercase font-bold ${
                            payment.toLowerCase() === 'gcash' ? 'text-blue-400' : 'text-slate-400'
                          }`}
                        >
                          {payment}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

          {/* 4. Ledger Tab */}
          {activeTab === 'ledger' && (
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold">Utang Customer Ledger</h2>
                  <p className="text-xs text-slate-400">Track informal credit balances and customer debts</p>
                </div>

                <div className="flex gap-2">
                  {(['all', 'utang', 'paid'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setLedgerFilter(filter)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition ${
                        ledgerFilter === filter
                          ? 'bg-fuchsia-600 text-white'
                          : 'bg-slate-900 border border-slate-800 text-slate-400'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ledger Entries List */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {ledger
                  .filter((entry) => {
                    if (ledgerFilter === 'utang') return entry.status === 'unpaid';
                    if (ledgerFilter === 'paid') return entry.status === 'paid';
                    return true;
                  })
                  .map((entry) => (
                    <div key={entry.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-sm text-slate-100">{entry.customerName}</h3>
                          <p className="text-xs text-slate-400">{entry.phone}</p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            entry.status === 'unpaid' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                          }`}
                        >
                          {entry.status}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 bg-slate-950 p-2 rounded-lg border border-slate-800">
                        {entry.description}
                      </p>

                      <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Balance Due</span>
                          <span className="font-mono font-bold text-sm text-amber-400">₱{entry.amount.toFixed(2)}</span>
                        </div>

                        {entry.status === 'unpaid' && (
                          <button
                            onClick={() =>
                              setLedger((prev) =>
                                prev.map((l) => (l.id === entry.id ? { ...l, status: 'paid' } : l))
                              )
                            }
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                          >
                            Mark Paid
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* 5. Settings Tab */}
          {activeTab === 'settings' && (
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto max-w-2xl mx-auto w-full min-w-0">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
                <div className="p-3 bg-fuchsia-600/20 text-fuchsia-400 rounded-xl">
                  <Sliders size={22} />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold">Hardware & Scanner Settings</h2>
                  <p className="text-xs text-slate-400">Configure default capture preferences</p>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                <div>
                  <h3 className="font-semibold text-slate-100 mb-1 flex items-center gap-2 text-sm">
                    <ShoppingCart size={16} className="text-fuchsia-400" /> POS Checkout Scanner
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">Primary scanner device for cart scanning.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'hardware', label: 'Hardware Gun', desc: 'USB/Bluetooth scanner gun' },
                      { id: 'camera', label: 'Device Camera', desc: 'Built-in camera viewfinder' },
                      { id: 'manual', label: 'Manual Search', desc: 'Search or key barcode manually' },
                    ].map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setPosScanMethod(option.id as ScanMethod)}
                        className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                          posScanMethod === option.id
                            ? 'bg-fuchsia-600/10 border-fuchsia-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-xs text-slate-200">{option.label}</span>
                          {posScanMethod === option.id && <Check size={16} className="text-fuchsia-400" />}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-tight">{option.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {deferredPrompt && (
                  <div className="pt-4 border-t border-slate-800">
                    <h3 className="font-semibold text-slate-100 mb-1 flex items-center gap-2 text-sm">
                      <Download size={16} className="text-fuchsia-400" /> Web App Installation
                    </h3>
                    <p className="text-xs text-slate-400 mb-3">Install IÑaki POS as a desktop or mobile application.</p>
                    <button
                      onClick={handleInstallApp}
                      className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-2"
                    >
                      <Download size={14} /> Install IÑAKI POS Application
                    </button>
                  </div>
                )}
              </div>

                  {/* Display & Appearance Settings */}
              <div className="mt-6 rounded-2xl bg-slate-900/60 border border-slate-800 p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Sun size={18} className="text-fuchsia-400" />
                  <h3 className="text-sm font-bold text-slate-100">Display Theme</h3>
                </div>
                <p className="text-xs text-slate-400 mb-4">Choose visual color appearance for the system</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
                  {/* Dark Mode Card */}
                  <button
                    type="button"
                    onClick={() => handleThemeChange('dark')}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                      theme === 'dark'
                        ? 'bg-fuchsia-950/30 border-fuchsia-500 text-white shadow-md shadow-fuchsia-900/20'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Moon size={18} className={theme === 'dark' ? 'text-fuchsia-400' : 'text-slate-500'} />
                      <div>
                        <p className="text-xs font-bold text-slate-100">Dark Mode</p>
                        <p className="text-[11px] text-slate-400">Low-glare dark UI</p>
                      </div>
                    </div>
                    {theme === 'dark' && <Check size={16} className="text-fuchsia-400" />}
                  </button>

                  {/* Light Mode Card */}
                  <button
                    type="button"
                    onClick={() => handleThemeChange('light')}
                    className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                      theme === 'light'
                        ? 'bg-fuchsia-950/30 border-fuchsia-500 text-white shadow-md shadow-fuchsia-900/20'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Sun size={18} className={theme === 'light' ? 'text-fuchsia-400' : 'text-slate-500'} />
                      <div>
                        <p className="text-xs font-bold text-slate-100">Light Mode</p>
                        <p className="text-[11px] text-slate-400">High-contrast bright UI</p>
                      </div>
                    </div>
                    {theme === 'light' && <Check size={16} className="text-fuchsia-400" />}
                  </button>
                </div>
              </div>
            </div>
          )}
         
        </main>
      </div>

       {/* Large Font Checkout & Payment Modal */}
          {isPaymentModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-150">
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h2 className="text-lg font-bold text-white uppercase tracking-wider">Checkout Payment</h2>
                  <button
                    onClick={() => setIsPaymentModalOpen(false)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800"
                  >
                    ✕
                  </button>
                </div>

                {/* Payment Method Selector */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-2 rounded-lg font-bold text-xs uppercase transition ${
                      paymentMethod === 'cash' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    💵 Cash
                  </button>
                  <button
                    onClick={() => setPaymentMethod('gcash')}
                    className={`py-2 rounded-lg font-bold text-xs uppercase transition ${
                      paymentMethod === 'gcash' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    📱 GCash
                  </button>
                </div>

                {/* Large Numbers Display Area */}
                <div className="space-y-4 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                  {/* Net Total Display */}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-semibold text-sm">Net Total:</span>
                    <span className="text-2xl font-black font-mono text-emerald-400">
                      ₱{netSales.toFixed(2)}
                    </span>
                  </div>

                  {/* Cash Tendered Input Field */}
                  {paymentMethod === 'cash' ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                        Cash Tendered
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-500 font-mono">
                          ₱
                        </span>
                        <input
                          type="number"
                          step="any"
                          autoFocus
                          placeholder="0.00"
                          value={cashReceived}
                          onChange={(e) => setCashReceived(e.target.value)}
                          className="w-full pl-9 pr-4 py-3 bg-slate-900 border-2 border-fuchsia-500/50 focus:border-fuchsia-500 rounded-xl text-3xl font-black font-mono text-white outline-none"
                        />
                      </div>

                      {/* Quick Cash Buttons */}
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        {[netSales, 100, 500, 1000].map((amount) => (
                          <button
                            key={amount}
                            onClick={() => setCashReceived(amount.toString())}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold py-1.5 rounded-lg border border-slate-700"
                          >
                            ₱{amount}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* GCash Ref Input */
                    <div>
                      <label className="block text-xs font-bold text-slate-300 uppercase mb-1">
                        GCash Reference #
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 10029384"
                        value={gcashRefNumber}
                        onChange={(e) => setGcashRefNumber(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-lg font-mono text-white outline-none focus:border-blue-500"
                      />
                    </div>
                  )}

                  {/* Change Due Display */}
                  {paymentMethod === 'cash' && (
                    <div className="flex justify-between items-center border-t border-slate-800 pt-3">
                      <span className="text-slate-400 font-semibold text-sm">Change:</span>
                      <span
                        className={`text-3xl font-black font-mono ${
                          parsedCash >= netSales ? 'text-fuchsia-400' : 'text-red-400'
                        }`}
                      >
                        ₱{changeDue.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Dynamic Receipt Preview (Appears when cash inputted is sufficient) */}
                {(paymentMethod === 'gcash' || parsedCash >= netSales) && (
                  <div className="bg-white text-slate-900 p-4 rounded-2xl shadow-inner text-xs font-mono max-h-48 overflow-y-auto space-y-1 animate-in fade-in duration-200">
                    <div className="text-center font-bold text-sm border-b pb-1 border-slate-200">
                      IÑAKI SARI-SARI STORE
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>{new Date().toLocaleDateString()}</span>
                      <span>{new Date().toLocaleTimeString()}</span>
                    </div>
                    <div className="border-b border-dashed border-slate-300 py-1 space-y-1">
                      {cart.map((item) => (
                        <div key={item.id} className="flex justify-between">
                          <span>{item.name} x{item.quantity}</span>
                          <span>₱{(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-1 space-y-0.5">
                      <div className="flex justify-between font-bold">
                        <span>TOTAL:</span>
                        <span>₱{netSales.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span>PAYMENT ({paymentMethod.toUpperCase()}):</span>
                        <span>₱{(paymentMethod === 'cash' ? parsedCash : netSales).toFixed(2)}</span>
                      </div>
                      {paymentMethod === 'cash' && (
                        <div className="flex justify-between text-[10px] font-bold">
                          <span>CHANGE:</span>
                          <span>₱{changeDue.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <button
                    disabled={paymentMethod === 'cash' && parsedCash < netSales}
                    onClick={() => handleCheckout('bt_print')}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold py-3 rounded-xl transition flex items-center justify-center gap-1 shadow-lg shadow-blue-600/30"
                  >
                    <span>Bluetooth</span>
                  </button>

                  <button
                    disabled={paymentMethod === 'cash' && parsedCash < netSales}
                    onClick={() => handleCheckout('standard_print')}
                    className="bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 text-white text-xs font-bold py-3 rounded-xl transition shadow-lg shadow-fuchsia-600/30"
                  >
                    Print
                  </button>

                  <button
                    disabled={paymentMethod === 'cash' && parsedCash < netSales}
                    onClick={() => handleCheckout('close')}
                    className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-bold py-3 rounded-xl transition border border-slate-700"
                  >
                    Complete
                  </button>
                </div>

              </div>
            </div>
          )}

      {/* --- OVERLAY MODALS --- */}

      {/* Fee / Discount Setter Modal */}
      {activeFeeModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xs p-5 shadow-2xl">
            <h3 className="text-sm font-bold capitalize mb-3 text-slate-100">Set {activeFeeModal} Amount</h3>
            <input
              type="number"
              placeholder="0.00"
              value={feeInputValue}
              onChange={(e) => setFeeInputValue(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-slate-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setActiveFeeModal(null)}
                className="flex-1 bg-slate-800 text-slate-300 py-2 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyFeeModal}
                className="flex-1 bg-fuchsia-600 text-white py-2 rounded-xl text-xs font-semibold"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setIsInlineScanning(false);
                setIsModalOpen(false);
              }}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X size={18} />
            </button>

            <h3 className="text-base sm:text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
              <Package size={18} className="text-fuchsia-400" />
              {editingProduct ? 'Edit Product' : 'Add Product'}
            </h3>

            <form onSubmit={handleSaveProduct} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Coke Mismo 300ml"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Selling Price (SRP) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Cost (Puhunan)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formCost}
                    onChange={(e) => setFormCost(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Initial Stock</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Low Stock</label>
                  <input
                    type="number"
                    placeholder="5"
                    value={formLowStock}
                    onChange={(e) => setFormLowStock(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Unit</label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                  >
                    <option value="pcs">pcs</option>
                    <option value="pack">pack</option>
                    <option value="box">box</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Barcode Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Barcode code"
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                  />
                  <button
                    type="button"
                    onClick={() => setIsInlineScanning((prev) => !prev)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border ${
                      isInlineScanning
                        ? 'bg-rose-600/20 text-rose-400 border-rose-500/30'
                        : 'bg-fuchsia-600/20 text-fuchsia-400 border-fuchsia-500/30'
                    }`}
                  >
                    <Camera size={14} /> Scan
                  </button>
                </div>

                {/* Integrated Working Camera Scanner Component */}
                <CameraScanner
                  isOpen={isInlineScanning}
                  onClose={() => setIsInlineScanning(false)}
                  onScan={(scannedBarcode) => {
                    setFormBarcode(scannedBarcode);
                    setIsInlineScanning(false);
                  }}
                />
              </div>

              <button
                type="submit"
                className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition shadow-md shadow-fuchsia-600/30"
              >
                SAVE PRODUCT
              </button>
            </form>
          </div>
        </div>
      )}

          <CameraScanner
        isOpen={isPosCameraOpen}
        onClose={() => setIsPosCameraOpen(false)}
        onScan={(scannedBarcode) => {
          // 1. Find the matching product in your products list
          const foundProduct = products.find(
            (product) => product.barcode === scannedBarcode || product.id === scannedBarcode
          );

          if (foundProduct) {
            // 2. Automatically add the product to the shopping cart
            addToCart(foundProduct); // Replace with your actual cart function name if different
          } else {
            // 3. Fallback: If product isn't found, populate search bar so you can see what failed
            setSearchQuery(scannedBarcode);
            alert(`No product found with barcode: ${scannedBarcode}`);
          }

          setIsPosCameraOpen(false);
        }}
      />

      {/* Export Report Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl relative">
            <button
              onClick={() => setIsExportModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>

            <h3 className="text-base font-bold text-slate-100 mb-4">Export Analytics Report</h3>

            <div className="flex border-b border-slate-800 mb-4 text-xs font-bold">
              {[
                { id: 'sales', label: 'SALES REPORT' },
                { id: 'movement', label: 'INV. MOVEMENT' },
                { id: 'capital', label: 'INV. CAPITAL' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setExportTab(tab.id as any)}
                  className={`flex-1 pb-2 border-b-2 transition ${
                    exportTab === tab.id
                      ? 'border-fuchsia-500 text-fuchsia-400'
                      : 'border-transparent text-slate-400'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Recipient Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 text-slate-500" size={16} />
                  <input
                    type="email"
                    value={exportEmail}
                    onChange={(e) => setExportEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                  />
                </div>
              </div>

              <button
                onClick={() => {
                  alert(`Report (${exportTab.toUpperCase()}) exported successfully to ${exportEmail}!`);
                  setIsExportModalOpen(false);
                }}
                className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition shadow-md shadow-fuchsia-600/30"
              >
                EXPORT NOW
              </button>
            </div>
          </div>
        </div>
      )}

{/* Printable Receipt Modal */}
{receiptData && (
  <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:p-0 print:bg-white print:static print:block overflow-y-auto">
    {/* Thermal Print Stylesheet for 58mm Continuous Roll */}
    <style>{`
      @media print {
        @page {
          size: 58mm auto;
          margin: 0mm !important;
        }
        html, body {
          width: 58mm !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #000000 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        /* Hide non-receipt screen elements */
        body * {
          visibility: hidden;
        }

        /* Force receipt to render in a single continuous column */
        #printable-receipt,
        #printable-receipt * {
          visibility: visible !important;
          color: #000000 !important;
        }

        #printable-receipt {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 58mm !important;
          max-width: 58mm !important;
          padding: 2mm 2mm 12mm 2mm !important;
          margin: 0 !important;
          box-sizing: border-box !important;
          background: #ffffff !important;
          display: block !important;
          float: none !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }

        .print-hide,
        .print-hide * {
          display: none !important;
          visibility: hidden !important;
        }
      }
    `}</style>

    <div
      id="printable-receipt"
      className="bg-white text-black p-4 rounded-2xl w-full max-w-[280px] shadow-2xl font-mono text-[11px] leading-tight print:shadow-none print:w-[58mm] print:max-w-[58mm] print:rounded-none print:text-black print:p-0 mx-auto"
    >
      {/* Header */}
      <div className="text-center pb-2 border-b border-dashed border-gray-400 space-y-0.5">
       <img
          src="/Inaki.png"
          alt="IÑAKI Logo"
          className="h-8 w-8 mx-auto rounded-lg object-cover mb-1 border border-gray-200 print:border-none"
        />
        <h2 className="font-extrabold text-xs tracking-wider uppercase text-black">IÑAKI STORE</h2>
        <p className="text-[9px] text-gray-600 print:text-black">{new Date(receiptData.timestamp).toLocaleString('en-PH')}</p>
        <p className="text-[9px] font-bold text-gray-800 print:text-black">Receipt #: {receiptData.id}</p>
      </div>

      {/* Item List */}
      <div className="py-2 border-b border-dashed border-gray-400 space-y-1">
        {receiptData.items.map((item) => (
          <div key={item.id} className="flex justify-between items-start">
            <div className="pr-1 min-w-0 flex-1">
              <p className="font-semibold truncate text-[10px] text-black">{item.name}</p>
              <p className="text-[9px] text-gray-600 print:text-black">
                {item.quantity} x P{item.price.toFixed(2)}
              </p>
            </div>
            <span className="font-bold whitespace-nowrap text-[10px] text-black">
              P{(item.price * item.quantity).toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {/* Fees & Summary */}
      <div className="py-2 border-b border-dashed border-gray-400 space-y-0.5 text-[10px]">
        {receiptData.discount > 0 && (
          <div className="flex justify-between text-gray-800 print:text-black">
            <span>DISCOUNT:</span>
            <span>-P{receiptData.discount.toFixed(2)}</span>
          </div>
        )}
        {receiptData.serviceFee > 0 && (
          <div className="flex justify-between text-gray-800 print:text-black">
            <span>SERVICE FEE:</span>
            <span>+P{receiptData.serviceFee.toFixed(2)}</span>
          </div>
        )}
        {receiptData.deliveryFee > 0 && (
          <div className="flex justify-between text-gray-800 print:text-black">
            <span>DELIVERY FEE:</span>
            <span>+P{receiptData.deliveryFee.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-xs pt-0.5 text-black">
          <span>TOTAL:</span>
          <span>P{receiptData.netSales.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-gray-800 print:text-black uppercase pt-0.5 text-[9px]">
          <span>PAYMENT:</span>
          <span className="font-bold">{receiptData.paymentMethod}</span>
        </div>

        {receiptData.paymentMethod === 'cash' && (
          <>
            <div className="flex justify-between text-gray-800 print:text-black uppercase text-[9px]">
              <span>RECEIVED:</span>
              <span>P{(receiptData.cashReceived || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-900 print:text-black uppercase font-bold text-[9px]">
              <span>CHANGE:</span>
              <span>P{(receiptData.changeDue || 0).toFixed(2)}</span>
            </div>
          </>
        )}

        {receiptData.paymentMethod === 'gcash' && receiptData.gcashRefNumber && (
          <div className="flex justify-between text-gray-800 print:text-black uppercase text-[9px]">
            <span>REF NO:</span>
            <span>{receiptData.gcashRefNumber}</span>
          </div>
        )}
      </div>

      {/* Customer Info */}
      {receiptData.customer && (
        <div className="py-1.5 border-b border-dashed border-gray-400 text-[9px] space-y-0.5 text-black">
          <p className="font-bold">Customer Info:</p>
          {receiptData.customer.name && <p>Name: {receiptData.customer.name}</p>}
          {receiptData.customer.phone && <p>Phone: {receiptData.customer.phone}</p>}
          {receiptData.customer.address && <p>Address: {receiptData.customer.address}</p>}
          {receiptData.customer.notes && <p>Notes: {receiptData.customer.notes}</p>}
        </div>
      )}

      {/* Footer */}
      <div className="pt-2 text-center text-[9px] space-y-0.5 text-black">
        <p className="font-bold uppercase tracking-wider">Maraming Salamat Po!</p>
        <p className="text-gray-600 print:text-black">Please Come Again</p>
      </div>

      {/* Paper Feed Buffer for Thermal Cut */}
      <div className="h-4 print:h-8" />

    {/* Screen Control Buttons */}
<div className="mt-3 flex flex-col sm:flex-row gap-2 print:hidden print-hide">
  {/* Direct Bluetooth Print */}
  <button
    onClick={handleBluetoothPrint}
    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 px-3 rounded-xl font-sans font-bold flex items-center justify-center gap-1.5 text-xs transition"
  >
    <Bluetooth size={14} /> Direct BT Print
  </button>

  {/* Standard Browser System Print */}
  <button
    onClick={() => window.print()}
    className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white py-2 px-3 rounded-xl font-sans font-bold flex items-center justify-center gap-1 text-xs transition"
  >
    <Printer size={14} /> Print
  </button>

  {/* Close Modal */}
  <button
    onClick={() => setReceiptData(null)}
    className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-2 rounded-xl font-sans font-semibold text-xs transition"
  >
    Close
  </button>
</div>
    </div>

  </div>
)}



    </div>
  );
}

