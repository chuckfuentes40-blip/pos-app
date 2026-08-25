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
  X,
  Mail,
  Download,
  Sun,
  Moon,
  Check,
  RefreshCw,
  DollarSign,
  TrendingUp,
  Edit,
  Printer
} from 'lucide-react';

// --- TYPES & INTERFACES ---
export type ScanMethod = 'hardware' | 'camera' | 'manual';

export interface Product {
  id: string;
  name: string;
  barcode?: string;
  category?: string;
  costPrice?: number;
  price: number;
  stock: number;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface LedgerEntry {
  id: string;
  customerName: string;
  phone: string;
  description: string;
  amount: number;
  status: 'unpaid' | 'paid';
}

export interface ReceiptData {
  id: string;
  timestamp: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  serviceFee: number;
  deliveryFee: number;
  netSales: number;
  paymentMethod: string;
  cashReceived?: number;
  changeDue?: number;
  gcashRefNumber?: string;
  customer?: {
    name?: string;
    phone?: string;
    address?: string;
    notes?: string;
  };
}

// --- CAMERA SCANNER MODAL COMPONENT ---
interface CameraScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({ isOpen, onClose, onScan }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }
    startCamera();
    return () => stopCamera();
  }, [isOpen]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        detectBarcode();
      }
    } catch (err: any) {
      setCameraError('Camera access denied or unavailable. Ensure HTTPS or local environment.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const detectBarcode = async () => {
    if ('BarcodeDetector' in window) {
      try {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['code_128', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e'],
        });

        const interval = setInterval(async () => {
          if (!videoRef.current || !streamRef.current) {
            clearInterval(interval);
            return;
          }
          try {
            const barcodes = await barcodeDetector.detect(videoRef.current);
            if (barcodes.length > 0) {
              clearInterval(interval);
              onScan(barcodes[0].rawValue);
            }
          } catch (e) {
            // Frame detection pass
          }
        }, 300);
      } catch (e) {
        console.warn('Native BarcodeDetector initialization failed:', e);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-5 shadow-2xl space-y-4 relative">
        <div className="flex justify-between items-center pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-fuchsia-400" />
            <h3 className="font-bold text-sm text-slate-100">Scan Product Barcode</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="relative aspect-square w-full bg-black rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
          {cameraError ? (
            <div className="p-4 text-center space-y-2">
              <p className="text-xs text-rose-400">{cameraError}</p>
              <button
                onClick={startCamera}
                className="bg-slate-800 text-slate-200 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 mx-auto"
              >
                <RefreshCw size={12} /> Retry Camera
              </button>
            </div>
          ) : (
            <>
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              <div className="absolute inset-x-6 top-1/2 h-0.5 bg-rose-500 shadow-[0_0_8px_#f43f5e] animate-pulse" />
              <div className="absolute inset-10 border-2 border-fuchsia-500/40 rounded-xl pointer-events-none" />
            </>
          )}
        </div>

        <div className="space-y-2 pt-2 border-t border-slate-800">
          <label className="text-[11px] text-slate-400 block">Or key code manually:</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Barcode digits..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
            />
            <button
              onClick={() => {
                if (manualCode.trim()) onScan(manualCode.trim());
              }}
              className="bg-fuchsia-600 text-white font-bold px-3 py-2 rounded-xl text-xs"
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- MAIN POS SYSTEM COMPONENT ---
export default function POSSystem() {
  // Navigation & Theme
  const [activeTab, setActiveTab] = useState<'pos' | 'inventory' | 'analytics' | 'ledger' | 'settings'>('pos');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Sample Inventory State
  const [products, setProducts] = useState<Product[]>([
    { id: '1', name: 'San Miguel Light 330ml', barcode: '4800001', category: 'Beverages', costPrice: 45, price: 60, stock: 48 },
    { id: '2', name: 'Sammies Potato Chips 100g', barcode: '4800002', category: 'Snacks', costPrice: 20, price: 35, stock: 15 },
    { id: '3', name: 'Instant Noodles Seafood 70g', barcode: '4800003', category: 'Grocery', costPrice: 12, price: 18, stock: 5 },
  ]);

  // Cart & POS State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [posScanMethod, setPosScanMethod] = useState<ScanMethod>('hardware');

  // Payment & Financial Calculations
  const [discount, setDiscount] = useState<number>(0);
  const [extraFee, setExtraFee] = useState<number>(0);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gcash'>('cash');
  const [customer, setCustomer] = useState<{ name?: string; phone?: string; address?: string; notes?: string }>({});

  // Modals & UI Controls
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPosCameraOpen, setIsPosCameraOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [activeFeeModal, setActiveFeeModal] = useState<'discount' | 'fee' | 'delivery' | null>(null);
  const [feeInputValue, setFeeInputValue] = useState('');

  // Add / Edit Product Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    barcode: '',
    category: 'General',
    costPrice: 0,
    price: 0,
    stock: 0,
  });

  // Export Analytics Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportTab, setExportTab] = useState<'sales' | 'movement' | 'capital'>('sales');
  const [exportEmail, setExportEmail] = useState('manager@inaki-store.ph');

  // Ledger State
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'utang' | 'paid'>('all');
  const [ledger, setLedger] = useState<LedgerEntry[]>([
    { id: 'l1', customerName: 'Juan Dela Cruz', phone: '09171234567', description: '2x SM Light, 1x Chips', amount: 155, status: 'unpaid' },
    { id: 'l2', customerName: 'Maria Santos', phone: '09189876543', description: 'Grocery items', amount: 320, status: 'paid' },
  ]);

  // PWA Prompt
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // Financial Calculations
  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const netTotal = Math.max(0, subtotal - discount + extraFee + deliveryFee);

  // Cart Functions
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
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

  // Product Add / Edit Handlers
  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductForm({ name: '', barcode: '', category: 'General', costPrice: 0, price: 0, stock: 0 });
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod: Product) => {
    setEditingProduct(prod);
    setProductForm({
      name: prod.name,
      barcode: prod.barcode || '',
      category: prod.category || 'General',
      costPrice: prod.costPrice || 0,
      price: prod.price,
      stock: prod.stock,
    });
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      setProducts((prev) =>
        prev.map((p) => (p.id === editingProduct.id ? { ...p, ...productForm } : p))
      );
    } else {
      const newEntry: Product = {
        id: `prod_${Date.now()}`,
        ...productForm,
      };
      setProducts((prev) => [newEntry, ...prev]);
    }
    setIsProductModalOpen(false);
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
    }
  };

  // Payment Execution
  const handleCompleteTransaction = () => {
    const receipt: ReceiptData = {
      id: `INV-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toISOString(),
      items: [...cart],
      subtotal,
      discount,
      serviceFee: extraFee,
      deliveryFee,
      netSales: netTotal,
      paymentMethod,
      cashReceived: paymentMethod === 'cash' ? cashTendered : netTotal,
      changeDue: paymentMethod === 'cash' ? Math.max(0, cashTendered - netTotal) : 0,
      customer,
    };

    // Deduct stock levels
    setProducts((prev) =>
      prev.map((p) => {
        const cartMatch = cart.find((c) => c.id === p.id);
        if (cartMatch) {
          return { ...p, stock: Math.max(0, p.stock - cartMatch.quantity) };
        }
        return p;
      })
    );

    setReceiptData(receipt);
    setCart([]);
    setDiscount(0);
    setExtraFee(0);
    setDeliveryFee(0);
    setCashTendered(0);
    setCustomer({});
    setIsPaymentModalOpen(false);
  };

  // Print Handlers
  const handleBluetoothPrint = async () => {
    alert('Connecting to Bluetooth Thermal Printer...');
  };

  const handleThemeChange = (selectedTheme: 'dark' | 'light') => {
    setTheme(selectedTheme);
  };

  const handleInstallApp = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => setDeferredPrompt(null));
    }
  };

  const handleApplyFeeModal = () => {
    const val = Number(feeInputValue) || 0;
    if (activeFeeModal === 'discount') setDiscount(val);
    if (activeFeeModal === 'fee') setExtraFee(val);
    if (activeFeeModal === 'delivery') setDeliveryFee(val);
    setActiveFeeModal(null);
    setFeeInputValue('');
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchQuery))
  );

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'} flex flex-col font-sans`}>
      {/* Top Header Navigation */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <img src="/Inaki.png" alt="IÑAKI Logo" className="h-8 w-8 rounded-lg object-cover border border-slate-700" />
          <h1 className="font-black text-lg tracking-wide text-white">IÑAKI <span className="text-fuchsia-500">POS</span></h1>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
          {[
            { id: 'pos', label: 'POS', icon: ShoppingCart },
            { id: 'inventory', label: 'Inventory', icon: Package },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            { id: 'ledger', label: 'Utang Ledger', icon: BookOpen },
            { id: 'settings', label: 'Settings', icon: Sliders },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition ${
                  activeTab === tab.id ? 'bg-fuchsia-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main View Area */}
      <main className="flex-1 flex overflow-hidden">
        {/* --- 1. POS TAB --- */}
        {activeTab === 'pos' && (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Product Selection Area */}
            <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto min-w-0">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 text-slate-500" size={16} />
                  <input
                    type="text"
                    placeholder="Search name or barcode..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-fuchsia-500"
                  />
                </div>
                <button
                  onClick={() => setIsPosCameraOpen(true)}
                  className="bg-fuchsia-600/20 text-fuchsia-400 border border-fuchsia-500/30 px-3.5 rounded-xl flex items-center gap-1.5 text-xs font-bold hover:bg-fuchsia-600/30 transition"
                >
                  <Camera size={16} /> Camera
                </button>
              </div>

              {/* Product Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="bg-slate-900 border border-slate-800 hover:border-fuchsia-500/50 rounded-2xl p-3.5 text-left transition flex flex-col justify-between space-y-2 group"
                  >
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{product.category}</p>
                      <h3 className="font-bold text-xs text-slate-200 group-hover:text-fuchsia-400 transition line-clamp-2">{product.name}</h3>
                    </div>
                    <div className="flex justify-between items-end pt-2 border-t border-slate-800/60">
                      <span className="font-mono font-bold text-sm text-amber-400">₱{product.price.toFixed(2)}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${product.stock > 10 ? 'bg-slate-800 text-slate-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        {product.stock} left
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Cart Panel */}
            <div className="w-full lg:w-96 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col h-[50vh] lg:h-auto">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                <h2 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                  <ShoppingCart size={16} className="text-fuchsia-400" /> Current Cart
                </h2>
                <span className="bg-fuchsia-600/20 text-fuchsia-400 text-xs font-bold px-2 py-0.5 rounded-md">
                  {cart.reduce((a, b) => a + b.quantity, 0)} Items
                </span>
              </div>

              {/* Cart List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2">
                    <ShoppingCart size={32} />
                    <p className="text-xs">Cart is empty</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="font-bold text-xs text-slate-200 truncate">{item.name}</p>
                        <p className="text-[10px] font-mono text-amber-400">₱{item.price.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-slate-900 rounded-lg border border-slate-800">
                          <button onClick={() => updateQuantity(item.id, -1)} className="p-1 text-slate-400 hover:text-white"><Minus size={12} /></button>
                          <span className="font-mono text-xs font-bold px-2">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)} className="p-1 text-slate-400 hover:text-white"><Plus size={12} /></button>
                        </div>
                        <button onClick={() => removeFromCart(item.id)} className="text-slate-500 hover:text-rose-400 p-1"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Cart Summary Footer */}
              <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-3">
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-400"><span>Subtotal</span><span className="font-mono">₱{subtotal.toFixed(2)}</span></div>
                  {discount > 0 && <div className="flex justify-between text-rose-400"><span>Discount</span><span className="font-mono">-₱{discount.toFixed(2)}</span></div>}
                  <div className="flex justify-between font-black text-sm text-white pt-1 border-t border-slate-800">
                    <span>NET TOTAL</span>
                    <span className="font-mono text-fuchsia-400 text-lg">₱{netTotal.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  disabled={cart.length === 0}
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-3.5 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-600/20"
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
                <p className="text-xs text-slate-400">Manage stock, cost prices, and barcode IDs</p>
              </div>
              <button
                onClick={handleOpenAddProduct}
                className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-fuchsia-600/30"
              >
                <Plus size={16} /> Add Product
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="p-3.5">Product</th>
                    <th className="p-3.5">Barcode</th>
                    <th className="p-3.5">Cost</th>
                    <th className="p-3.5">Price</th>
                    <th className="p-3.5">Stock</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3.5 font-bold text-white">{p.name}</td>
                      <td className="p-3.5 font-mono text-slate-400">{p.barcode || 'N/A'}</td>
                      <td className="p-3.5 font-mono text-emerald-400">₱{(p.costPrice || 0).toFixed(2)}</td>
                      <td className="p-3.5 font-mono text-amber-400">₱{p.price.toFixed(2)}</td>
                      <td className="p-3.5 font-mono font-bold">{p.stock}</td>
                      <td className="p-3.5 text-right space-x-2">
                        <button onClick={() => handleOpenEditProduct(p)} className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"><Edit size={14} /></button>
                        <button onClick={() => handleDeleteProduct(p.id)} className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg"><Trash2 size={14} /></button>
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
          <div className="flex-1 p-6 overflow-y-auto max-w-5xl mx-auto w-full space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold">Sales & Profit Analytics</h2>
                <p className="text-xs text-slate-400">Real-time revenue performance metrics</p>
              </div>
              <button
                onClick={() => setIsExportModalOpen(true)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5"
              >
                <Download size={14} /> Export Report
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
                <span className="text-slate-400 text-xs block">Total Sales</span>
                <span className="font-mono text-2xl font-bold text-emerald-400">₱1,250.00</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
                <span className="text-slate-400 text-xs block">Estimated Profit</span>
                <span className="font-mono text-2xl font-bold text-fuchsia-400">₱420.00</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
                <span className="text-slate-400 text-xs block">Transactions</span>
                <span className="font-mono text-2xl font-bold text-amber-400">14</span>
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
                <p className="text-xs text-slate-400">Configure scanner hardware and visual theme</p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="font-semibold text-slate-100 text-sm">Primary POS Scanner Method</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'hardware', label: 'Hardware Gun', desc: 'USB/BT barcode gun' },
                  { id: 'camera', label: 'Device Camera', desc: 'Integrated viewfinder' },
                  { id: 'manual', label: 'Manual Key', desc: 'Direct search input' },
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

              {deferredPrompt && (
                <div className="pt-4 border-t border-slate-800">
                  <button onClick={handleInstallApp} className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-2">
                    <Download size={14} /> Install Web App
                  </button>
                </div>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="font-semibold text-slate-100 text-sm">Theme Appearance</h3>
              <div className="grid grid-cols-2 gap-3 max-w-sm">
                <button
                  onClick={() => handleThemeChange('dark')}
                  className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-bold transition ${theme === 'dark' ? 'border-fuchsia-500 bg-fuchsia-950/20 text-white' : 'border-slate-800 text-slate-400'}`}
                >
                  <Moon size={16} /> Dark Mode
                </button>
                <button
                  onClick={() => handleThemeChange('light')}
                  className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-bold transition ${theme === 'light' ? 'border-fuchsia-500 bg-fuchsia-950/20 text-white' : 'border-slate-800 text-slate-400'}`}
                >
                  <Sun size={16} /> Light Mode
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- PAYMENT POP-UP MODAL --- */}
      {isPaymentModalOpen &&
        createPortal(
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-6">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Process Payment</h3>
                  <p className="text-xs text-slate-400">Select payment method and complete order</p>
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

              {paymentMethod === 'cash' && (
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
                Confirm & Generate Receipt
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* --- PRINTABLE RECEIPT MODAL --- */}
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
            </div>

            <div className="pt-2 text-center text-[9px] space-y-0.5">
              <p className="font-bold uppercase tracking-wider">Maraming Salamat Po!</p>
              <p className="text-gray-600">Please Come Again</p>
            </div>

            <div className="flex items-center justify-center gap-2 mt-5 w-full print-hide">
              <button onClick={handleBluetoothPrint} className="bg-blue-600 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5"><Wifi size={14} /> BT Print</button>
              <button onClick={() => window.print()} className="bg-fuchsia-600 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-1.5"><Printer size={14} /> Print</button>
              <button onClick={() => setReceiptData(null)} className="bg-slate-800 text-slate-300 font-bold text-xs px-4 py-2.5 rounded-xl">Close</button>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Barcode ID</label>
                  <input
                    type="text"
                    placeholder="480000123456"
                    value={productForm.barcode}
                    onChange={(e) => setProductForm({ ...productForm, barcode: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-fuchsia-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="Beverages"
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-fuchsia-500"
                  />
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
                {editingProduct ? 'Save Product Changes' : 'Add to Inventory'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- CAMERA SCANNER MODAL --- */}
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

      {/* --- EXPORT REPORT MODAL --- */}
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