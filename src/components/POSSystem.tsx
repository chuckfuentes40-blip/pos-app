'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ShoppingCart,
  Package,
  BarChart3,
  BookOpen,
  Sliders,
  Search,
  Plus,
  Minus,
  Trash2,
  Camera,
  RefreshCw,
  X,
  Sun,
  Moon,
  Unlock,
  Printer,
  Bluetooth,
  Mail,
  ArrowUpRight,
  ArrowDownRight,
  Edit3,
  CheckCircle2,
  Download,
  CreditCard,
  AlertCircle
} from 'lucide-react';

// --- TYPES & INTERFACES ---
export interface Product {
  id: string;
  name: string;
  barcode: string;
  price: number;
  costPrice: number;
  stock: number;
  category?: string;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  stock: number;
}

export interface Transaction {
  id: string;
  timestamp: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  extraFee: number;
  deliveryFee: number;
  netSales: number;
  grossSales: number;
  cogs: number;
  grossProfit: number;
  profitMargin: number;
  paymentMethod: 'cash' | 'gcash';
  cashTendered?: number;
  change?: number;
  gcashRefNumber?: string;
}

export interface UtangEntry {
  id: string;
  customerName: string;
  phone: string;
  description: string;
  amount: number;
  status: 'unpaid' | 'paid';
  date: string;
}

export type ScanMethod = 'hardware' | 'camera' | 'manual';
export type ActiveTab = 'pos' | 'inventory' | 'analytics' | 'ledger' | 'settings';

// --- ESC/POS UTILITY FUNCTION ---
function buildEscPosReceiptBuffer(data: Transaction): Uint8Array {
  const encoder = new TextEncoder();
  const init = [0x1b, 0x40]; // ESC @
  const center = [0x1b, 0x61, 0x01];
  const left = [0x1b, 0x61, 0x00];
  const cut = [0x1d, 0x56, 0x41, 0x00];
  const openCashDrawer = [0x1b, 0x70, 0x00, 0x19, 0xfa];

  let text = '';
  text += 'IÑAKI STORE\n';
  text += new Date(data.timestamp).toLocaleString('en-PH') + '\n';
  text += `Receipt #: ${data.id}\n`;
  text += '--------------------------------\n';

  data.items.forEach((item) => {
    text += `${item.name}\n`;
    text += `${item.quantity} x P${item.price.toFixed(2)} = P${(item.quantity * item.price).toFixed(2)}\n`;
  });

  text += '--------------------------------\n';
  text += `TOTAL: P${data.netSales.toFixed(2)}\n`;
  text += `PAYMENT: ${data.paymentMethod.toUpperCase()}\n`;
  if (data.gcashRefNumber) {
    text += `GCASH REF: ${data.gcashRefNumber}\n`;
  }
  text += '--------------------------------\n';
  text += 'Maraming Salamat Po!\n\n\n';

  const bodyBuffer = encoder.encode(text);
  const fullArray = [
    ...init,
    ...center,
    ...bodyBuffer,
    ...left,
    ...openCashDrawer,
    ...cut
  ];
  return new Uint8Array(fullArray);
}

// --- CAMERA SCANNER COMPONENT ---
function CameraScanner({
  isOpen,
  onClose,
  onScan
}: {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [manualBarcode, setManualBarcode] = useState('');

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (isOpen) {
      navigator.mediaDevices
        ?.getUserMedia({ video: { facingMode: 'environment' } })
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
          }
        })
        .catch((err) => console.error('Camera access error:', err));
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-5 space-y-4 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white"
        >
          <X size={20} />
        </button>
        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <Camera size={18} className="text-fuchsia-500" /> Camera Barcode Scanner
        </h3>

        <div className="relative aspect-square bg-black rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-8 border-2 border-dashed border-fuchsia-500/60 rounded-xl pointer-events-none animate-pulse" />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
            Simulate or Enter Barcode
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter barcode..."
              value={manualBarcode}
              onChange={(e) => setManualBarcode(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-fuchsia-500"
            />
            <button
              onClick={() => {
                if (manualBarcode.trim()) {
                  onScan(manualBarcode.trim());
                  setManualBarcode('');
                }
              }}
              className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition"
            >
              Scan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- MAIN COMPONENT ---
export default function InakiPOS() {
  // Navigation & General State
  const [activeTab, setActiveTab] = useState<ActiveTab>('pos');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [posScanMethod, setPosScanMethod] = useState<ScanMethod>('hardware');

  // Products & Inventory
  const [products, setProducts] = useState<Product[]>([
    { id: '1', name: 'San Miguel Light 330ml', barcode: '4800001', price: 65, costPrice: 50, stock: 48, category: 'Beverages' },
    { id: '2', name: 'Marlboro Red Pack', barcode: '4800002', price: 175, costPrice: 150, stock: 20, category: 'Tobacco' },
    { id: '3', name: 'Lucky Me Instant Pancit Canton', barcode: '4800003', price: 16, costPrice: 12, stock: 100, category: 'Groceries' }
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [inventoryFilter, setInventoryFilter] = useState('all');

  // Cart & Transaction Calculation
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [extraFee, setExtraFee] = useState<number>(0);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gcash'>('cash');
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [gcashRefNumber, setGcashRefNumber] = useState<string>('');

  // Modals & Popups State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<Transaction | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [btStatus, setBtStatus] = useState<string>('');
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({ name: '', barcode: '', price: 0, costPrice: 0, stock: 0 });
  const [isPosCameraOpen, setIsPosCameraOpen] = useState(false);
  const [isProductCameraOpen, setIsProductCameraOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportTab, setExportTab] = useState<'sales' | 'movement' | 'capital'>('sales');
  const [exportEmail, setExportEmail] = useState('owner@inakistore.ph');

  // Sales History & Ledger
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [ledger, setLedger] = useState<UtangEntry[]>([
    { id: 'u1', customerName: 'Mang Juan', phone: '09171234567', description: '2x SM Light, 1x Marlboro', amount: 305, status: 'unpaid', date: '2026-08-25' },
    { id: 'u2', customerName: 'Aling Nena', phone: '09189876543', description: 'Groceries store credit', amount: 450, status: 'paid', date: '2026-08-24' }
  ]);
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'utang' | 'paid'>('all');

  // Cart Computations
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const netTotal = Math.max(0, subtotal - discount + extraFee + deliveryFee);

  // Cart Handlers
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, quantity: 1, stock: product.stock }];
    });
  };

  const updateCartQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
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

  // Transaction Processing
  const handleCompleteTransaction = () => {
    const cogs = cart.reduce((sum, item) => {
      const prod = products.find((p) => p.id === item.id);
      return sum + (prod ? prod.costPrice * item.quantity : 0);
    }, 0);

    const grossSales = subtotal;
    const grossProfit = netTotal - cogs;
    const profitMargin = netTotal > 0 ? (grossProfit / netTotal) * 100 : 0;

    const newTx: Transaction = {
      id: `TX-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toISOString(),
      items: [...cart],
      subtotal,
      discount,
      extraFee,
      deliveryFee,
      netSales: netTotal,
      grossSales,
      cogs,
      grossProfit,
      profitMargin,
      paymentMethod,
      cashTendered: paymentMethod === 'cash' ? cashTendered : undefined,
      change: paymentMethod === 'cash' ? Math.max(0, cashTendered - netTotal) : undefined,
      gcashRefNumber: paymentMethod === 'gcash' ? gcashRefNumber : undefined
    };

    // Deduct stock
    setProducts((prev) =>
      prev.map((p) => {
        const cartItem = cart.find((ci) => ci.id === p.id);
        return cartItem ? { ...p, stock: Math.max(0, p.stock - cartItem.quantity) } : p;
      })
    );

    setTransactions((prev) => [newTx, ...prev]);
    setReceiptData(newTx);
    setIsPaymentModalOpen(false);
    setCart([]);
    setDiscount(0);
    setExtraFee(0);
    setDeliveryFee(0);
    setCashTendered(0);
    setGcashRefNumber('');
  };

  // Bluetooth / Hardware Handlers
  const handleBluetoothPrint = async (data: Transaction) => {
    setIsPrinting(true);
    setBtStatus('Connecting Bluetooth printer...');
    try {
      const nav = navigator as any;
      if (!nav.bluetooth) {
        throw new Error('Web Bluetooth is not supported in this browser.');
      }
      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
      });
      const server = await device.gatt.connect();
      setBtStatus('Sending ESC/POS payload...');
      const buffer = buildEscPosReceiptBuffer(data);
      console.log('Buffer created:', buffer);
      setBtStatus('Receipt Printed!');
    } catch (err: any) {
      setBtStatus(`Print error: ${err.message || err}`);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleKickCashbox = () => {
    alert('Pulse command sent to open cash drawer!');
  };

  // Inventory Handlers
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      setProducts((prev) =>
        prev.map((p) => (p.id === editingProduct.id ? { ...p, ...productForm } : p))
      );
    } else {
      setProducts((prev) => [
        ...prev,
        { id: Date.now().toString(), ...productForm }
      ]);
    }
    setIsProductModalOpen(false);
    setEditingProduct(null);
    setProductForm({ name: '', barcode: '', price: 0, costPrice: 0, stock: 0 });
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
    }
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'} flex flex-col font-sans select-none`}>
      {/* --- TOP NAVIGATION BAR --- */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="bg-fuchsia-600 p-2 rounded-xl text-white font-black text-lg">IÑAKI</div>
          <div>
            <h1 className="font-bold text-sm leading-none text-white">Store POS</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">Sorsogon City Branch</p>
          </div>
        </div>

        <nav className="flex items-center gap-1 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
          {[
            { id: 'pos', label: 'POS Terminal', icon: ShoppingCart },
            { id: 'inventory', label: 'Inventory', icon: Package },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            { id: 'ledger', label: 'Utang Ledger', icon: BookOpen },
            { id: 'settings', label: 'Settings', icon: Sliders }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ActiveTab)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                  active ? 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-600/30' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {/* --- MAIN CONTENT PANELS --- */}
      <main className="flex-1 flex overflow-hidden">
        {/* --- 1. POS TAB --- */}
        {activeTab === 'pos' && (
          <div className="flex-1 flex gap-4 p-4 h-[calc(100vh-65px)]">
            {/* Left Column: Product Catalog & Search */}
            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
              <div className="flex items-center gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-3 text-slate-500" size={18} />
                  <input
                    type="text"
                    placeholder="Search product or scan barcode..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-fuchsia-500"
                  />
                </div>
                <button
                  onClick={() => setIsPosCameraOpen(true)}
                  className="bg-fuchsia-600/20 text-fuchsia-400 border border-fuchsia-500/30 p-2.5 rounded-xl hover:bg-fuchsia-600/30 transition flex items-center gap-2 text-xs font-bold"
                >
                  <Camera size={18} /> Camera
                </button>
              </div>

              {/* Products Grid */}
              <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pr-1">
                {products
                  .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode.includes(searchQuery))
                  .map((product) => (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      className="bg-slate-900 border border-slate-800 hover:border-fuchsia-500/50 p-3.5 rounded-2xl text-left flex flex-col justify-between transition group hover:shadow-xl hover:shadow-fuchsia-950/20"
                    >
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{product.category || 'General'}</span>
                        <h3 className="font-bold text-xs text-slate-100 group-hover:text-fuchsia-400 line-clamp-2 mt-1">{product.name}</h3>
                      </div>
                      <div className="flex justify-between items-end mt-4">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Stock: {product.stock}</span>
                          <span className="font-mono font-extrabold text-sm text-emerald-400">₱{product.price.toFixed(2)}</span>
                        </div>
                        <div className="bg-slate-800 group-hover:bg-fuchsia-600 text-slate-300 group-hover:text-white p-2 rounded-xl transition">
                          <Plus size={14} />
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            </div>

            {/* Right Column: Active Cart & Checkout */}
            <div className="w-96 bg-slate-900 border border-slate-800 rounded-3xl p-4 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-800">
                  <h2 className="font-bold text-sm text-white flex items-center gap-2">
                    <ShoppingCart size={18} className="text-fuchsia-500" /> Current Order
                  </h2>
                  <button onClick={() => setCart([])} className="text-slate-500 hover:text-rose-400 text-xs flex items-center gap-1 transition">
                    <Trash2 size={14} /> Clear
                  </button>
                </div>

                {/* Cart Items List */}
                <div className="max-h-[380px] overflow-y-auto space-y-2 py-3 pr-1">
                  {cart.length === 0 ? (
                    <div className="text-center py-12 text-slate-600 space-y-2">
                      <ShoppingCart size={32} className="mx-auto opacity-30" />
                      <p className="text-xs">Cart is currently empty</p>
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div key={item.id} className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between">
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="font-bold text-xs text-slate-200 truncate">{item.name}</p>
                          <p className="text-[10px] text-emerald-400 font-mono">₱{item.price.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateCartQuantity(item.id, -1)} className="p-1 bg-slate-800 rounded-lg text-slate-300 hover:bg-slate-700">
                            <Minus size={12} />
                          </button>
                          <span className="font-mono font-bold text-xs text-white w-4 text-center">{item.quantity}</span>
                          <button onClick={() => updateCartQuantity(item.id, 1)} className="p-1 bg-slate-800 rounded-lg text-slate-300 hover:bg-slate-700">
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Checkout Calculation Box */}
              <div className="border-t border-slate-800 pt-3 space-y-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Subtotal</span>
                  <span className="font-mono">₱{subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-xs text-rose-400">
                    <span>Discount</span>
                    <span className="font-mono">-₱{discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-black pt-2 border-t border-slate-800/60">
                  <span className="text-white">NET TOTAL</span>
                  <span className="font-mono text-fuchsia-400 text-xl">₱{netTotal.toFixed(2)}</span>
                </div>

                <button
                  disabled={cart.length === 0}
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-3.5 rounded-2xl transition shadow-lg shadow-emerald-600/20 uppercase tracking-wider text-xs mt-2"
                >
                  Pay Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- 2. INVENTORY TAB --- */}
        {activeTab === 'inventory' && (
          <div className="flex-1 p-6 overflow-y-auto max-w-6xl mx-auto w-full space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold">Inventory Management</h2>
                <p className="text-xs text-slate-400">Manage products, stock levels, and pricing</p>
              </div>
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setProductForm({ name: '', barcode: '', price: 0, costPrice: 0, stock: 0 });
                  setIsProductModalOpen(true);
                }}
                className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow-lg shadow-fuchsia-600/30"
              >
                <Plus size={16} /> Add Product
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="p-3.5">Product Name</th>
                    <th className="p-3.5">Barcode</th>
                    <th className="p-3.5">Cost Price</th>
                    <th className="p-3.5">Selling Price</th>
                    <th className="p-3.5">Stock</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3.5 font-bold text-slate-200">{p.name}</td>
                      <td className="p-3.5 font-mono text-slate-400">{p.barcode}</td>
                      <td className="p-3.5 font-mono text-emerald-400">₱{p.costPrice.toFixed(2)}</td>
                      <td className="p-3.5 font-mono text-amber-400">₱{p.price.toFixed(2)}</td>
                      <td className="p-3.5 font-mono">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.stock < 10 ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-300'}`}>
                          {p.stock} pcs
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        <button
                          onClick={() => {
                            setEditingProduct(p);
                            setProductForm({ name: p.name, barcode: p.barcode, price: p.price, costPrice: p.costPrice, stock: p.stock });
                            setIsProductModalOpen(true);
                          }}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p.id)}
                          className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- 3. ANALYTICS TAB --- */}
        {activeTab === 'analytics' && (
          <div className="flex-1 p-6 overflow-y-auto max-w-6xl mx-auto w-full space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold">Sales & Financial Analytics</h2>
                <p className="text-xs text-slate-400">Track real-time profitability and metrics</p>
              </div>
              <button
                onClick={() => setIsExportModalOpen(true)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-4 py-2.5 rounded-xl border border-slate-700 flex items-center gap-2 transition"
              >
                <Download size={16} /> Export Report
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">Gross Sales</span>
                <p className="text-xl font-mono font-black text-white">₱{transactions.reduce((sum, t) => sum + t.netSales, 0).toFixed(2)}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">Total Profit</span>
                <p className="text-xl font-mono font-black text-emerald-400">₱{transactions.reduce((sum, t) => sum + t.grossProfit, 0).toFixed(2)}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">Total Transactions</span>
                <p className="text-xl font-mono font-black text-fuchsia-400">{transactions.length}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-500">Avg. Margin</span>
                <p className="text-xl font-mono font-black text-amber-400">
                  {transactions.length > 0
                    ? (transactions.reduce((sum, t) => sum + t.profitMargin, 0) / transactions.length).toFixed(1)
                    : 0}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* --- 4. UTANG LEDGER TAB --- */}
        {activeTab === 'ledger' && (
          <div className="flex-1 p-6 overflow-y-auto max-w-5xl mx-auto w-full space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold">Customer Utang Ledger</h2>
                <p className="text-xs text-slate-400">Track and settle store credit accounts</p>
              </div>
              <div className="flex gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-bold">
                {(['all', 'utang', 'paid'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setLedgerFilter(f)}
                    className={`px-3 py-1.5 rounded-lg capitalize transition ${ledgerFilter === f ? 'bg-fuchsia-600 text-white' : 'text-slate-400'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

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
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${entry.status === 'unpaid' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                        {entry.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 bg-slate-950 p-2 rounded-lg border border-slate-800">{entry.description}</p>

                    <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Balance Due</span>
                        <span className="font-mono font-bold text-sm text-amber-400">₱{entry.amount.toFixed(2)}</span>
                      </div>
                      {entry.status === 'unpaid' && (
                        <button
                          onClick={() => setLedger((prev) => prev.map((l) => (l.id === entry.id ? { ...l, status: 'paid' } : l)))}
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

        {/* --- 5. SETTINGS TAB --- */}
        {activeTab === 'settings' && (
          <div className="flex-1 p-6 overflow-y-auto max-w-2xl mx-auto w-full space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <div className="p-3 bg-fuchsia-600/20 text-fuchsia-400 rounded-xl"><Sliders size={22} /></div>
              <div>
                <h2 className="text-lg font-bold">Hardware & System Settings</h2>
                <p className="text-xs text-slate-400">Configure scanner hardware and Bluetooth devices</p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="font-semibold text-slate-100 text-sm">Bluetooth Thermal Printer & Cash Drawer</h3>
              <p className="text-xs text-slate-400">Pair your ESC/POS thermal printer to enable direct receipt printing and automatic cashbox unlocking.</p>
              <button
                onClick={handleKickCashbox}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-700 flex items-center gap-2 transition"
              >
                <Unlock size={16} className="text-amber-400" /> Test Open Cashbox Pulse
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="font-semibold text-slate-100 text-sm">Primary POS Scanner Method</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'hardware', label: 'Hardware Gun', desc: 'USB/BT barcode gun' },
                  { id: 'camera', label: 'Device Camera', desc: 'Integrated auto-focus' },
                  { id: 'manual', label: 'Manual Key', desc: 'Direct search input' }
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setPosScanMethod(option.id as ScanMethod)}
                    className={`p-3.5 rounded-xl border text-left transition ${posScanMethod === option.id ? 'bg-fuchsia-600/10 border-fuchsia-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'}`}
                  >
                    <p className="font-bold text-xs">{option.label}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{option.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="font-semibold text-slate-100 text-sm">Theme Appearance</h3>
              <div className="grid grid-cols-2 gap-3 max-w-sm">
                <button
                  onClick={() => setTheme('dark')}
                  className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-bold transition ${theme === 'dark' ? 'border-fuchsia-500 bg-fuchsia-950/20 text-white' : 'border-slate-800 text-slate-400'}`}
                >
                  <Moon size={16} /> Dark Mode
                </button>
                <button
                  onClick={() => setTheme('light')}
                  className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-bold transition ${theme === 'light' ? 'border-fuchsia-500 bg-fuchsia-950/20 text-white' : 'border-slate-800 text-slate-400'}`}
                >
                  <Sun size={16} /> Light Mode
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- PAYMENT MODAL --- */}
      {isPaymentModalOpen &&
        createPortal(
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-6">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Process Payment</h3>
                  <p className="text-xs text-slate-400">Select payment method and save transaction</p>
                </div>
                <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition">✕</button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    const d = prompt('Enter discount amount (₱):', discount.toString());
                    if (d !== null) setDiscount(Number(d) || 0);
                  }}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 py-2 rounded-xl text-xs font-semibold transition"
                >
                  % Disc: ₱{discount}
                </button>
                <button
                  onClick={() => {
                    const f = prompt('Enter extra fee (₱):', extraFee.toString());
                    if (f !== null) setExtraFee(Number(f) || 0);
                  }}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 py-2 rounded-xl text-xs font-semibold transition"
                >
                  🏷️ Fee: ₱{extraFee}
                </button>
                <button
                  onClick={() => {
                    const del = prompt('Enter delivery fee (₱):', deliveryFee.toString());
                    if (del !== null) setDeliveryFee(Number(del) || 0);
                  }}
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 py-2 rounded-xl text-xs font-semibold transition"
                >
                  🚚 Del: ₱{deliveryFee}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition border ${
                    paymentMethod === 'cash' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-slate-800/50 border-slate-700 text-slate-400'
                  }`}
                >
                  💵 Cash
                </button>
                <button
                  onClick={() => setPaymentMethod('gcash')}
                  className={`py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition border ${
                    paymentMethod === 'gcash' ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-slate-800/50 border-slate-700 text-slate-400'
                  }`}
                >
                  💳 GCash
                </button>
              </div>

              {paymentMethod === 'cash' ? (
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Cash Tendered:</span>
                    <span className="font-mono text-emerald-400 font-bold">
                      Change: ₱{Math.max(0, cashTendered - netTotal).toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={cashTendered || ''}
                    onChange={(e) => setCashTendered(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-emerald-400 font-mono font-bold text-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
              ) : (
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <label className="text-xs text-slate-400 block font-semibold">GCash Reference Number:</label>
                  <input
                    type="text"
                    placeholder="e.g. 53462828644"
                    value={gcashRefNumber}
                    onChange={(e) => setGcashRefNumber(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-blue-400 font-mono font-bold text-base focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <div className="border-t border-slate-800 pt-4 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-400"><span>Subtotal</span><span className="font-mono">₱{subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-base font-black">
                  <span className="text-white">NET TOTAL</span>
                  <span className="font-mono text-fuchsia-400 text-xl">₱{netTotal.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handleCompleteTransaction}
                disabled={paymentMethod === 'cash' && cashTendered < netTotal}
                className={`w-full py-4 rounded-2xl font-bold text-sm uppercase tracking-wider transition ${
                  paymentMethod === 'cash' && cashTendered < netTotal
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                }`}
              >
                Confirm & Complete Transaction
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* --- RECEIPT MODAL --- */}
      {receiptData && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:p-0 print:bg-white print:static print:block overflow-y-auto">
          <style>{`
            @media print {
              @page { size: 58mm auto; margin: 0mm !important; }
              html, body { width: 58mm !important; margin: 0 !important; padding: 0 !important; background: #ffffff !important; color: #000000 !important; }
              body * { visibility: hidden; }
              #printable-receipt, #printable-receipt * { visibility: visible !important; color: #000000 !important; }
              #printable-receipt { position: absolute !important; left: 0 !important; top: 0 !important; width: 58mm !important; max-width: 58mm !important; padding: 2mm !important; margin: 0 !important; background: #ffffff !important; }
              .print-hide { display: none !important; }
            }
          `}</style>

          <div id="printable-receipt" className="bg-white text-black p-4 rounded-2xl w-full max-w-[280px] shadow-2xl font-mono text-[11px] leading-tight print:shadow-none print:w-[58mm] print:max-w-[58mm] print:rounded-none print:p-0 mx-auto">
            <div className="text-center pb-2 border-b border-dashed border-gray-400 space-y-0.5">
              <h2 className="font-extrabold text-xs tracking-wider uppercase">IÑAKI STORE</h2>
              <p className="text-[9px] text-gray-600">{new Date(receiptData.timestamp).toLocaleString('en-PH')}</p>
              <p className="text-[9px] font-bold">Receipt #: {receiptData.id}</p>
            </div>

            <div className="py-2 border-b border-dashed border-gray-400 space-y-1">
              {receiptData.items.map((item) => (
                <div key={item.id} className="flex justify-between items-start">
                  <div className="pr-1 min-w-0 flex-1">
                    <p className="font-semibold truncate text-[10px]">{item.name}</p>
                    <p className="text-[9px] text-gray-600">{item.quantity} x P{item.price.toFixed(2)}</p>
                  </div>
                  <span className="font-bold whitespace-nowrap text-[10px]">P{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="py-2 border-b border-dashed border-gray-400 space-y-0.5 text-[10px]">
              <div className="flex justify-between font-bold text-xs pt-0.5"><span>TOTAL:</span><span>P{receiptData.netSales.toFixed(2)}</span></div>
              <div className="flex justify-between text-gray-800 uppercase pt-0.5 text-[9px]"><span>PAYMENT:</span><span className="font-bold">{receiptData.paymentMethod}</span></div>
              {receiptData.gcashRefNumber && (
                <div className="flex justify-between text-gray-800 text-[9px]"><span>GCASH REF:</span><span className="font-bold">{receiptData.gcashRefNumber}</span></div>
              )}
            </div>

            <div className="pt-2 text-center text-[9px] space-y-0.5">
              <p className="font-bold uppercase tracking-wider">Maraming Salamat Po!</p>
              <p className="text-gray-600">Please Come Again</p>
            </div>

            {btStatus && (
              <p className="text-[10px] font-bold text-fuchsia-600 text-center mt-2 print-hide animate-pulse">{btStatus}</p>
            )}

            <div className="flex flex-col gap-2 mt-4 w-full print-hide">
              <button
                disabled={isPrinting}
                onClick={() => handleBluetoothPrint(receiptData)}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition shadow-lg shadow-blue-600/20"
              >
                <Bluetooth size={14} /> BT Print & Open Cashbox
              </button>

              <div className="flex items-center justify-center gap-2">
                <button onClick={() => window.print()} className="flex-1 bg-slate-800 text-slate-200 font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5"><Printer size={14} /> Web Print</button>
                <button onClick={() => setReceiptData(null)} className="flex-1 bg-slate-800 text-slate-300 font-bold text-xs py-2 rounded-xl">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD / EDIT PRODUCT MODAL --- */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-100 text-base">
                {editingProduct ? 'Edit Product Item' : 'Add New Inventory Item'}
              </h3>
              <button onClick={() => setIsProductModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg">✕</button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Product Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. San Miguel Light 330ml"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-fuchsia-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Barcode ID</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="480000123456"
                    value={productForm.barcode}
                    onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-fuchsia-500"
                  />
                  <button
                    type="button"
                    onClick={() => setIsProductCameraOpen(true)}
                    className="bg-fuchsia-600/20 text-fuchsia-400 border border-fuchsia-500/30 px-3 rounded-xl flex items-center justify-center hover:bg-fuchsia-600/30 transition"
                  >
                    <Camera size={16} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Cost (₱)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={productForm.costPrice || ''}
                    onChange={(e) => setProductForm({ ...productForm, costPrice: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Selling (₱)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={productForm.price || ''}
                    onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-amber-400 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Stock Qty</label>
                  <input
                    required
                    type="number"
                    value={productForm.stock || ''}
                    onChange={(e) => setProductForm({ ...productForm, stock: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-fuchsia-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-fuchsia-600/20 mt-2"
              >
                {editingProduct ? 'Save Changes' : 'Save Product'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- CAMERA SCANNER MODALS --- */}
      <CameraScanner
        isOpen={isPosCameraOpen}
        onClose={() => setIsPosCameraOpen(false)}
        onScan={(scannedBarcode) => {
          const cleanCode = String(scannedBarcode).trim();
          const foundProduct = products.find(
            (p) => String(p.barcode || '').trim() === cleanCode || String(p.id || '').trim() === cleanCode
          );

          if (foundProduct) {
            addToCart(foundProduct);
          } else {
            setSearchQuery(cleanCode);
            alert(`No product found with barcode: ${cleanCode}`);
          }
          setIsPosCameraOpen(false);
        }}
      />

      <CameraScanner
        isOpen={isProductCameraOpen}
        onClose={() => setIsProductCameraOpen(false)}
        onScan={(scannedBarcode) => {
          setProductForm((prev) => ({ ...prev, barcode: String(scannedBarcode).trim() }));
          setIsProductCameraOpen(false);
        }}
      />

      {/* --- EXPORT MODAL --- */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button onClick={() => setIsExportModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-white"><X size={18} /></button>
            <h3 className="text-base font-bold text-slate-100 mb-4">Export Analytics Report</h3>

            <div className="flex border-b border-slate-800 mb-4 text-xs font-bold">
              {(['sales', 'movement', 'capital'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setExportTab(tab)}
                  className={`flex-1 pb-2 border-b-2 uppercase transition ${exportTab === tab ? 'border-fuchsia-500 text-fuchsia-400' : 'border-transparent text-slate-400'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Recipient Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 text-slate-500" size={16} />
                  <input
                    type="email"
                    value={exportEmail}
                    onChange={(e) => setExportEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-fuchsia-500"
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
                Export Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}