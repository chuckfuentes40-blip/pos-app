'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  PlusCircle,
  Edit3,
  Sliders,
  ShoppingCart,
  Package,
  Check,
  Receipt,
  Trash2,
  Minus,
  Plus,
  Banknote,
  Hash,
  X,
  Camera,
  Printer,
  Search,
  Store,
  CheckCircle2,
  BarChart3,
  TrendingUp,
  DollarSign,
  Calendar,
  Download,
  ChevronDown,
  ChevronUp,
  User,
  Phone,
  MapPin,
  FileText,
  Percent,
  Truck,
  Tag,
  Mail,
  AlertTriangle,
} from 'lucide-react';

export interface Product {
  id: string;
  name: string;
  barcode: string;
  price: number;
  cost: number;
  stock: number;
  lowStockLevel: number;
  unit: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface CustomerDetails {
  name: string;
  phone: string;
  address: string;
  notes: string;
}

export interface SaleRecord {
  id: string;
  timestamp: string;
  items: CartItem[];
  grossSales: number;
  discount: number;
  serviceFee: number;
  deliveryFee: number;
  netSales: number;
  costOfGoodsSold: number;
  profit: number;
  paymentMethod: 'cash' | 'gcash';
  cashReceived?: number;
  changeDue?: number;
  gcashRefNumber?: string;
  customer?: CustomerDetails;
}

export type ScanMethod = 'hardware' | 'camera' | 'manual';
export type PaymentMethod = 'cash' | 'gcash';
export type ActiveTab = 'pos' | 'inventory' | 'analytics' | 'settings';

const initialProducts: Product[] = [
  { id: '1', name: 'San Mig Coffee 3-in-1 Original', barcode: '4800016644021', price: 12.00, cost: 9.50, stock: 45, lowStockLevel: 10, unit: 'pcs' },
  { id: '2', name: 'Lucky Me! Instant Pancit Canton Extra Hot', barcode: '4800016021020', price: 15.50, cost: 12.00, stock: 32, lowStockLevel: 15, unit: 'pcs' },
  { id: '3', name: '555 Tuna Afritada 155g', barcode: '4800016005551', price: 25.00, cost: 19.50, stock: 8, lowStockLevel: 10, unit: 'pcs' },
  { id: '4', name: 'Coca-Cola 1.5L PET', barcode: '4800000000012', price: 75.00, cost: 62.00, stock: 18, lowStockLevel: 5, unit: 'pcs' },
  { id: '5', name: 'Datu Puti Vinegar 200ml', barcode: '4800011000111', price: 18.00, cost: 13.50, stock: 24, lowStockLevel: 8, unit: 'pcs' },
  { id: '6', name: 'Silver Swan Soy Sauce 200ml', barcode: '4800011000222', price: 19.00, cost: 14.50, stock: 15, lowStockLevel: 5, unit: 'pcs' },
];

const playScanBeep = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1760, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  } catch (err) {
    console.error('Audio context error:', err);
  }
};

export default function POSSystem() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('pos');
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [salesHistory, setSalesHistory] = useState<SaleRecord[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [posScanMethod, setPosScanMethod] = useState<ScanMethod>('hardware');
  const [scanStatus, setScanStatus] = useState<'WAITING' | 'SCANNED'>('WAITING');

  const [discount, setDiscount] = useState<number>(0);
  const [serviceFee, setServiceFee] = useState<number>(0);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [gcashRefNumber, setGcashRefNumber] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const [activeFeeModal, setActiveFeeModal] = useState<'discount' | 'service' | 'delivery' | null>(null);
  const [feeInputValue, setFeeInputValue] = useState<string>('');

  const [showCustomerDetails, setShowCustomerDetails] = useState<boolean>(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerDetails>({
    name: '',
    phone: '',
    address: '',
    notes: '',
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCost, setFormCost] = useState('');
  const [formStock, setFormStock] = useState('');
  const [formLowStock, setFormLowStock] = useState('');
  const [formUnit, setFormUnit] = useState('pcs');
  const [formBarcode, setFormBarcode] = useState('');

  const [isPosCameraOpen, setIsPosCameraOpen] = useState(false);
  const posVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isInlineScanning, setIsInlineScanning] = useState(false);
  const inlineVideoRef = useRef<HTMLVideoElement | null>(null);

  const [receiptData, setReceiptData] = useState<SaleRecord | null>(null);

  const [analyticsRange, setAnalyticsRange] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [showNetSalesBreakdown, setShowNetSalesBreakdown] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportTab, setExportTab] = useState<'sales' | 'movement' | 'capital'>('sales');
  const [exportEmail, setExportEmail] = useState('juan.delacruz@gmail.com');

  const barcodeBuffer = useRef<string>('');
  const lastKeyTime = useRef<number>(0);

  const grossSubtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );
  const totalCost = useMemo(
    () => cart.reduce((sum, item) => sum + item.cost * item.quantity, 0),
    [cart]
  );
  const grandTotal = Math.max(0, grossSubtotal - discount + serviceFee + deliveryFee);
  const cashVal = parseFloat(cashReceived) || 0;
  const changeDue = cashVal - grandTotal;

  const isCheckoutDisabled =
    cart.length === 0 ||
    loading ||
    (paymentMethod === 'cash' && (cashReceived === '' || changeDue < 0)) ||
    (paymentMethod === 'gcash' && !gcashRefNumber.trim());

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id || item.barcode === product.barcode);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id || item.barcode === product.barcode
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  }, []);

  const handleBarcodeScanned = useCallback(
    (code: string) => {
      const trimmedCode = code.trim();
      if (!trimmedCode) return;

      playScanBeep();
      setScanStatus('SCANNED');
      setTimeout(() => setScanStatus('WAITING'), 1500);

      if (isModalOpen) {
        setFormBarcode(trimmedCode);
        setIsInlineScanning(false);
      } else if (activeTab === 'pos') {
        const found = products.find((p) => p.barcode === trimmedCode);
        if (found) {
          addToCart(found);
        } else {
          alert(`Product with barcode "${trimmedCode}" not found.`);
        }
      }
    },
    [isModalOpen, activeTab, products, addToCart]
  );

  // Add declaration at the top of your file to prevent TypeScript errors
declare global {
  interface Window {
    BarcodeDetector?: any;
  }
}

// Add this frame-detection hook inside your POS component
useEffect(() => {
  if (!isScannerOpen || !posVideoRef.current) return;

  let animationFrameId: number;
  let detector: any = null;

  // Initialize native BarcodeDetector (Supported in Chrome/WebView Android)
  if ('BarcodeDetector' in window) {
    try {
      detector = new window.BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39']
      });
    } catch (e) {
      console.error('BarcodeDetector initialization failed:', e);
    }
  } else {
    console.warn('Native BarcodeDetector API is not supported in this browser.');
  }

  let isProcessingFrame = false;

  const scanVideoFrame = async () => {
    if (posVideoRef.current && detector && posVideoRef.current.readyState === 4) {
      if (!isProcessingFrame) {
        isProcessingFrame = true;
        try {
          const barcodes = await detector.detect(posVideoRef.current);
          if (barcodes.length > 0 && barcodes[0].rawValue) {
            const scannedCode = barcodes[0].rawValue.trim();
            
            // Audio beep confirmation
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            osc.connect(audioCtx.destination);
            osc.frequency.value = 1040;
            osc.start();
            osc.stop(audioCtx.currentTime + 0.1);

            // Execute item scan logic
            handleBarcodeScanned(scannedCode);

            // Close scanner upon successful match
            closeScanner();
            return;
          }
        } catch (err) {
          console.error('Frame scan error:', err);
        } finally {
          isProcessingFrame = false;
        }
      }
    }
    animationFrameId = requestAnimationFrame(scanVideoFrame);
  };

  if (detector) {
    animationFrameId = requestAnimationFrame(scanVideoFrame);
  }

  return () => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
  };
}, [isScannerOpen, handleBarcodeScanned, closeScanner]);

  // Keyboard barcode scanner listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';
      if (isInput && !isModalOpen) return;

      const currentTime = Date.now();
      if (currentTime - lastKeyTime.current > 80) barcodeBuffer.current = '';
      lastKeyTime.current = currentTime;

      if (e.key === 'Enter') {
        if (barcodeBuffer.current.length > 2) {
          e.preventDefault();
          handleBarcodeScanned(barcodeBuffer.current);
          barcodeBuffer.current = '';
        }
      } else if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleBarcodeScanned, isModalOpen]);

  // Camera initialization for POS Terminal overlay
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    if (isPosCameraOpen && posVideoRef.current) {
      navigator.mediaDevices
        .getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })
        .catch(() => navigator.mediaDevices.getUserMedia({ video: true }))
        .then((stream) => {
          if (!stream) return;
          activeStream = stream;
          if (posVideoRef.current) {
            posVideoRef.current.srcObject = stream;
            posVideoRef.current.play().catch((err) => console.error('Play error:', err));
          }
        })
        .catch((err) => {
          console.error('Camera access error:', err);
          alert('Unable to access camera. Please check tablet camera permissions.');
        });
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isPosCameraOpen]);

  // Camera initialization for Product Form scanner
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    if (isInlineScanning && inlineVideoRef.current) {
      navigator.mediaDevices
        .getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })
        .catch(() => navigator.mediaDevices.getUserMedia({ video: true }))
        .then((stream) => {
          if (!stream) return;
          activeStream = stream;
          if (inlineVideoRef.current) {
            inlineVideoRef.current.srcObject = stream;
            inlineVideoRef.current.play().catch((err) => console.error('Play error:', err));
          }
        })
        .catch((err) => {
          console.error('Inline camera error:', err);
          alert('Unable to access camera. Please check tablet camera permissions.');
        });
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isInlineScanning]);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormPrice('');
    setFormCost('');
    setFormStock('');
    setFormLowStock('5');
    setFormUnit('pcs');
    setFormBarcode('');
    setIsInlineScanning(false);
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormName(product.name);
    setFormPrice(product.price.toString());
    setFormCost(product.cost.toString());
    setFormStock(product.stock.toString());
    setFormLowStock(product.lowStockLevel.toString());
    setFormUnit(product.unit || 'pcs');
    setFormBarcode(product.barcode || '');
    setIsInlineScanning(false);
    setIsModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formPrice) return;

    const newProd: Product = {
      id: editingProduct ? editingProduct.id : Date.now().toString(),
      name: formName,
      price: parseFloat(formPrice) || 0,
      cost: parseFloat(formCost) || 0,
      stock: parseInt(formStock, 10) || 0,
      lowStockLevel: parseInt(formLowStock, 10) || 0,
      unit: formUnit || 'pcs',
      barcode: formBarcode,
    };

    if (editingProduct) {
      setProducts((prev) => prev.map((p) => (p.id === editingProduct.id ? newProd : p)));
    } else {
      setProducts((prev) => [...prev, newProd]);
    }

    setIsInlineScanning(false);
    setIsModalOpen(false);
  };

  const updateQuantity = (id: string, barcode: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id || item.barcode === barcode) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleApplyFeeModal = () => {
    const val = parseFloat(feeInputValue) || 0;
    if (activeFeeModal === 'discount') setDiscount(val);
    if (activeFeeModal === 'service') setServiceFee(val);
    if (activeFeeModal === 'delivery') setDeliveryFee(val);
    setActiveFeeModal(null);
    setFeeInputValue('');
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setLoading(true);

    setTimeout(() => {
      setProducts((prev) =>
        prev.map((p) => {
          const itemInCart = cart.find((c) => c.id === p.id || c.barcode === p.barcode);
          return itemInCart ? { ...p, stock: Math.max(0, p.stock - itemInCart.quantity) } : p;
        })
      );

      const netSales = grandTotal;
      const profit = netSales - totalCost;

      const record: SaleRecord = {
        id: `INV-${Date.now().toString().slice(-6)}`,
        timestamp: new Date().toISOString(),
        items: [...cart],
        grossSales: grossSubtotal,
        discount,
        serviceFee,
        deliveryFee,
        netSales,
        costOfGoodsSold: totalCost,
        profit,
        paymentMethod,
        cashReceived: paymentMethod === 'cash' ? cashVal : undefined,
        changeDue: paymentMethod === 'cash' ? changeDue : undefined,
        gcashRefNumber: paymentMethod === 'gcash' ? gcashRefNumber : undefined,
        customer: customerInfo.name ? { ...customerInfo } : undefined,
      };

      setSalesHistory((prev) => [record, ...prev]);
      setReceiptData(record);

      setCart([]);
      setDiscount(0);
      setServiceFee(0);
      setDeliveryFee(0);
      setCashReceived('');
      setGcashRefNumber('');
      setCustomerInfo({ name: '', phone: '', address: '', notes: '' });
      setShowCustomerDetails(false);
      setLoading(false);
    }, 500);
  };

  const filteredSales = useMemo(() => {
    const now = new Date();
    return salesHistory.filter((sale) => {
      const saleDate = new Date(sale.timestamp);
      if (analyticsRange === 'today') {
        return saleDate.toDateString() === now.toDateString();
      }
      if (analyticsRange === 'week') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return saleDate >= oneWeekAgo;
      }
      if (analyticsRange === 'month') {
        return saleDate.getMonth() === now.getMonth() && saleDate.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [salesHistory, analyticsRange]);

  const analyticsMetrics = useMemo(() => {
    const transactionCount = filteredSales.length;
    const grossSalesSum = filteredSales.reduce((sum, s) => sum + s.grossSales, 0);
    const discountSum = filteredSales.reduce((sum, s) => sum + s.discount, 0);
    const serviceFeeSum = filteredSales.reduce((sum, s) => sum + s.serviceFee, 0);
    const deliveryFeeSum = filteredSales.reduce((sum, s) => sum + s.deliveryFee, 0);
    const netSalesSum = filteredSales.reduce((sum, s) => sum + s.netSales, 0);
    const copsSum = filteredSales.reduce((sum, s) => sum + s.costOfGoodsSold, 0);
    const profitSum = filteredSales.reduce((sum, s) => sum + s.profit, 0);
    const avgBasketSize = transactionCount > 0 ? netSalesSum / transactionCount : 0;
    const margin = netSalesSum > 0 ? (profitSum / netSalesSum) * 100 : 0;

    return {
      transactionCount,
      grossSalesSum,
      discountSum,
      serviceFeeSum,
      deliveryFeeSum,
      netSalesSum,
      copsSum,
      profitSum,
      avgBasketSize,
      margin,
    };
  }, [filteredSales]);

  const inventoryCapital = useMemo(() => {
    return products.reduce(
      (acc, p) => {
        acc.totalCost += p.cost * p.stock;
        acc.totalSRP += p.price * p.stock;
        acc.totalItems += p.stock;
        return acc;
      },
      { totalCost: 0, totalSRP: 0, totalItems: 0 }
    );
  }, [products]);

  const filteredProductsList = products.filter(
    (p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode.includes(searchQuery)
  );

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Navigation Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-4 print:hidden">
        <div>
          <div className="flex items-center gap-3 px-2 py-4 border-b border-slate-800 mb-6">
            <div className="p-2.5 bg-fuchsia-600 text-white rounded-xl shadow-lg shadow-fuchsia-600/30">
              <Store size={22} />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight">PEDDLR STORE</h1>
              <p className="text-[11px] text-slate-400">Retail & Analytics</p>
            </div>
          </div>

          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveTab('pos')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition ${
                activeTab === 'pos'
                  ? 'bg-fuchsia-600 text-white shadow-md shadow-fuchsia-600/20'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <ShoppingCart size={18} /> POS Terminal
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition ${
                activeTab === 'inventory'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <Package size={18} /> Stock Ledger
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition ${
                activeTab === 'analytics'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <BarChart3 size={18} /> Analytics & Reports
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition ${
                activeTab === 'settings'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <Sliders size={18} /> Hardware Settings
            </button>
          </nav>
        </div>

        <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-[11px] text-slate-400 space-y-1">
          <p className="font-semibold text-slate-300">Scanner Status:</p>
          <p className="flex items-center gap-1.5 font-bold">
            <span
              className={`w-2 h-2 rounded-full ${
                scanStatus === 'SCANNED' ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
              }`}
            />
            {scanStatus}
          </p>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-950 overflow-hidden">
        {/* POS Tab */}
        {activeTab === 'pos' && (
          <div className="flex-1 flex flex-col p-6 overflow-hidden">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-3 text-slate-500" size={18} />
                <input
                  type="text"
                  placeholder="Search item name or barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                />
              </div>

              {posScanMethod === 'camera' && (
                <button
                  onClick={() => setIsPosCameraOpen(true)}
                  className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow-md shadow-fuchsia-600/20"
                >
                  <Camera size={16} /> Open Camera Scanner
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredProductsList.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="bg-slate-900 border border-slate-800 hover:border-fuchsia-500/50 p-4 rounded-2xl flex flex-col justify-between cursor-pointer transition group hover:shadow-lg hover:shadow-fuchsia-900/10"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                          {product.barcode || 'NO CODE'}
                        </span>
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            product.stock <= product.lowStockLevel
                              ? 'bg-rose-950 text-rose-400 border border-rose-800/40'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {product.stock} left
                        </span>
                      </div>
                      <h3 className="font-semibold text-xs text-slate-200 group-hover:text-white transition line-clamp-2">
                        {product.name}
                      </h3>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold text-emerald-400">₱{product.price.toFixed(2)}</span>
                        <span className="text-[10px] text-slate-500 block">Cost: ₱{product.cost.toFixed(2)}</span>
                      </div>
                      <span className="p-1.5 bg-fuchsia-600/10 text-fuchsia-400 group-hover:bg-fuchsia-600 group-hover:text-white rounded-lg transition">
                        <Plus size={14} />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Inventory Stock Ledger Tab */}
        {activeTab === 'inventory' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">Stock Ledger & Inventory</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Capital Value: <span className="text-emerald-400 font-bold">₱{inventoryCapital.totalCost.toFixed(2)}</span> |
                  SRP Value: <span className="text-fuchsia-400 font-bold">₱{inventoryCapital.totalSRP.toFixed(2)}</span>
                </p>
              </div>
              <button
                onClick={openAddModal}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
              >
                <PlusCircle size={16} /> Add Product
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-4">Item Description</th>
                    <th className="p-4">Barcode</th>
                    <th className="p-4">Price (SRP)</th>
                    <th className="p-4">Cost (Puhunan)</th>
                    <th className="p-4">Stock</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/30">
                      <td className="p-4 font-medium text-slate-100">
                        {p.name}
                        {p.stock <= p.lowStockLevel && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
                            <AlertTriangle size={10} /> Low Stock
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-mono text-xs text-slate-400">{p.barcode || '—'}</td>
                      <td className="p-4 font-bold text-emerald-400">₱{p.price.toFixed(2)}</td>
                      <td className="p-4 font-mono text-slate-400">₱{p.cost.toFixed(2)}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs font-semibold">
                          {p.stock} {p.unit}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-1.5 bg-slate-800 hover:bg-fuchsia-600 text-slate-300 hover:text-white rounded-lg transition"
                        >
                          <Edit3 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Analytics & Reports Tab */}
        {activeTab === 'analytics' && (
          <div className="flex-1 p-6 overflow-y-auto max-w-5xl mx-auto w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-2xl font-black text-slate-100">Reports & Analytics</h2>
                <p className="text-xs text-slate-400">Sales performance, profit margins, and cost insights</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
                  {(['today', 'week', 'month', 'all'] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => setAnalyticsRange(range)}
                      className={`px-3 py-1.5 rounded-lg capitalize font-semibold transition ${
                        analyticsRange === range
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setIsExportModalOpen(true)}
                  className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl transition flex items-center gap-2 shadow-md shadow-fuchsia-600/20"
                >
                  <Download size={15} /> Export Report
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-purple-900/30 border border-purple-800/40 p-4 rounded-2xl flex flex-col justify-between">
                <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">
                  Transaction Count
                </span>
                <p className="text-3xl font-black text-white mt-2">{analyticsMetrics.transactionCount}</p>
              </div>

              <div className="bg-purple-900/30 border border-purple-800/40 p-4 rounded-2xl flex flex-col justify-between">
                <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">
                  Avg. Basket Size
                </span>
                <p className="text-3xl font-black text-white mt-2">
                  ₱{analyticsMetrics.avgBasketSize.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-purple-900/40 border border-purple-800/50 rounded-2xl overflow-hidden">
                <div
                  onClick={() => setShowNetSalesBreakdown((prev) => !prev)}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-purple-800/20 transition"
                >
                  <div>
                    <span className="text-xs font-bold text-purple-300 uppercase tracking-wider block">
                      NET SALES
                    </span>
                    <span className="text-xs text-fuchsia-400 font-semibold underline flex items-center gap-1 mt-0.5">
                      CLICK ME {showNetSalesBreakdown ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </span>
                  </div>
                  <span className="text-2xl font-black text-white">
                    ₱{analyticsMetrics.netSalesSum.toFixed(2)}
                  </span>
                </div>

                {showNetSalesBreakdown && (
                  <div className="bg-slate-950/80 border-t border-purple-800/40 p-4 text-xs space-y-2 font-mono">
                    <p className="font-sans font-bold text-slate-300 mb-2">Summary Breakdown</p>
                    <div className="flex justify-between text-slate-400">
                      <span>Gross Sales:</span>
                      <span className="text-slate-200">₱{analyticsMetrics.grossSalesSum.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Service Fee:</span>
                      <span className="text-slate-200">+₱{analyticsMetrics.serviceFeeSum.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Delivery Fee:</span>
                      <span className="text-slate-200">+₱{analyticsMetrics.deliveryFeeSum.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Sales Discount:</span>
                      <span className="text-rose-400">-₱{analyticsMetrics.discountSum.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-purple-900/30 border border-purple-800/40 p-4 rounded-2xl flex items-center justify-between">
                <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                  Cost of Product Sold (Puhunan)
                </span>
                <span className="text-xl font-bold text-slate-200">
                  ₱{analyticsMetrics.copsSum.toFixed(2)}
                </span>
              </div>

              <div className="bg-purple-900/30 border border-purple-800/40 p-4 rounded-2xl flex items-center justify-between">
                <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                  Margin (%)
                </span>
                <span className="text-xl font-bold text-emerald-400">
                  {analyticsMetrics.margin.toFixed(1)}%
                </span>
              </div>

              <div className="bg-fuchsia-950/60 border border-fuchsia-800/60 p-5 rounded-2xl flex items-center justify-between shadow-lg shadow-fuchsia-950/30">
                <span className="text-sm font-black text-fuchsia-300 uppercase tracking-wider">
                  ESTIMATED NET PROFIT
                </span>
                <span className="text-3xl font-black text-emerald-400">
                  ₱{analyticsMetrics.profitSum.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Hardware Settings Tab */}
        {activeTab === 'settings' && (
          <div className="flex-1 p-6 overflow-y-auto max-w-2xl mx-auto w-full">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
              <div className="p-3 bg-fuchsia-600/20 text-fuchsia-400 rounded-xl">
                <Sliders size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold">Hardware & Scanner Settings</h2>
                <p className="text-xs text-slate-400">Configure default capture device preferences</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h3 className="font-semibold text-slate-100 mb-1 flex items-center gap-2">
                  <ShoppingCart size={18} className="text-fuchsia-400" /> POS Checkout Scanner
                </h3>
                <p className="text-xs text-slate-400 mb-4">Primary method used when adding items at cart.</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'hardware', label: 'Hardware Gun', desc: 'USB/Bluetooth barcode gun' },
                    { id: 'camera', label: 'Device Camera', desc: 'Webcam or camera viewfinder' },
                    { id: 'manual', label: 'Manual Key-in', desc: 'Search or enter barcode manually' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setPosScanMethod(option.id as ScanMethod)}
                      className={`p-4 rounded-xl border text-left transition flex flex-col justify-between ${
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
            </div>
          </div>
        )}
      </main>

      {/* Order Summary Sidebar */}
      <aside className="w-96 bg-slate-950 border-l border-slate-800 flex flex-col justify-between p-5 print:hidden overflow-y-auto">
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Receipt className="text-fuchsia-400" size={20} />
              <h2 className="font-bold text-slate-100 text-sm">Cart Items</h2>
            </div>
            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
              >
                <Trash2 size={12} /> Clear
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <div className="text-center py-8 text-slate-600">
                <ShoppingCart size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-xs font-medium">No items in cart</p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="font-medium text-slate-200 truncate">{item.name}</p>
                    <p className="text-[11px] text-slate-400">
                      ₱{item.price.toFixed(2)} × {item.quantity} ={' '}
                      <span className="font-bold text-emerald-400">₱{(item.price * item.quantity).toFixed(2)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg p-1">
                    <button
                      onClick={() => updateQuantity(item.id, item.barcode, -1)}
                      className="p-1 text-slate-400 hover:text-white"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="font-bold px-1">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.barcode, 1)}
                      className="p-1 text-slate-400 hover:text-white"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase">GRAND TOTAL:</span>
            <span className="text-2xl font-black text-emerald-400">₱{grandTotal.toFixed(2)}</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-[11px]">
            <button
              onClick={() => {
                setFeeInputValue(discount ? discount.toString() : '');
                setActiveFeeModal('discount');
              }}
              className={`p-2 rounded-xl border font-semibold flex flex-col items-center justify-center gap-1 transition ${
                discount > 0
                  ? 'bg-purple-600/20 text-purple-300 border-purple-500/40'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Tag size={14} /> Discount {discount > 0 && `(₱${discount})`}
            </button>
            <button
              onClick={() => {
                setFeeInputValue(serviceFee ? serviceFee.toString() : '');
                setActiveFeeModal('service');
              }}
              className={`p-2 rounded-xl border font-semibold flex flex-col items-center justify-center gap-1 transition ${
                serviceFee > 0
                  ? 'bg-purple-600/20 text-purple-300 border-purple-500/40'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Percent size={14} /> Service Fee {serviceFee > 0 && `(₱${serviceFee})`}
            </button>
            <button
              onClick={() => {
                setFeeInputValue(deliveryFee ? deliveryFee.toString() : '');
                setActiveFeeModal('delivery');
              }}
              className={`p-2 rounded-xl border font-semibold flex flex-col items-center justify-center gap-1 transition ${
                deliveryFee > 0
                  ? 'bg-purple-600/20 text-purple-300 border-purple-500/40'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
              }`}
            >
              <Truck size={14} /> Delivery Fee {deliveryFee > 0 && `(₱${deliveryFee})`}
            </button>
          </div>

          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50">
            <button
              onClick={() => setShowCustomerDetails((prev) => !prev)}
              className="w-full bg-purple-900/40 p-3 text-left font-bold text-xs text-purple-200 flex items-center justify-between"
            >
              <span>Customer's Details and Notes</span>
              {showCustomerDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showCustomerDetails && (
              <div className="p-3 space-y-2">
                <input
                  type="text"
                  placeholder="Customer's name"
                  value={customerInfo.name}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <input
                  type="text"
                  placeholder="Customer's number"
                  value={customerInfo.phone}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <input
                  type="text"
                  placeholder="Customer's address"
                  value={customerInfo.address}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
                <textarea
                  placeholder="Notes"
                  rows={2}
                  value={customerInfo.notes}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            )}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(['cash', 'gcash'] as const).map((method) => (
              <button
                key={method}
                onClick={() => setPaymentMethod(method)}
                className={`py-2 text-xs font-semibold rounded-xl border uppercase transition ${
                  paymentMethod === method
                    ? 'bg-fuchsia-600 text-white border-fuchsia-500 shadow-md shadow-fuchsia-600/30'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                {method === 'gcash' ? 'GCash' : 'Cash'}
              </button>
            ))}
          </div>

          {paymentMethod === 'cash' && (
            <div className="space-y-1">
              <input
                type="number"
                placeholder="Cash Received (₱)"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500 font-mono"
              />
              {cashReceived !== '' && (
                <div className="flex justify-between items-center text-xs px-1 font-semibold">
                  <span className="text-slate-400">Change:</span>
                  <span className={`font-mono ${changeDue >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {changeDue >= 0 ? `₱${changeDue.toFixed(2)}` : 'Insufficient'}
                  </span>
                </div>
              )}
            </div>
          )}

          {paymentMethod === 'gcash' && (
            <input
              type="text"
              placeholder="GCash Ref Number"
              value={gcashRefNumber}
              onChange={(e) => setGcashRefNumber(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500 font-mono"
            />
          )}

          <button
            onClick={handleCheckout}
            disabled={isCheckoutDisabled}
            className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition shadow-lg shadow-fuchsia-600/25 disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none"
          >
            <Check size={16} /> {loading ? 'Processing...' : 'CONFIRM SALE'}
          </button>
        </div>
      </aside>

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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setIsInlineScanning(false);
                setIsModalOpen(false);
              }}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X size={20} />
            </button>

            <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
              <Package size={20} className="text-fuchsia-400" />
              {editingProduct ? 'Edit Product' : 'Add Product'}
            </h3>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Coke Mismo 300ml"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Initial Stocks</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Low Stock Level</label>
                  <input
                    type="number"
                    placeholder="5"
                    value={formLowStock}
                    onChange={(e) => setFormLowStock(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Unit</label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
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
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
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
                    <Camera size={16} /> Scan
                  </button>
                </div>

                {isInlineScanning && (
                  <div className="mt-3 bg-black rounded-xl overflow-hidden aspect-video border-2 border-fuchsia-500 flex items-center justify-center relative">
                    <video
                      ref={inlineVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition shadow-md shadow-fuchsia-600/30"
              >
                SAVE PRODUCT
              </button>
            </form>
          </div>
        </div>
      )}

      {/* POS Camera Overlay */}
      {isPosCameraOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl relative">
            <button
              onClick={() => setIsPosCameraOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>
            <h3 className="text-md font-bold mb-3 flex items-center gap-2">
              <Camera size={18} className="text-fuchsia-400" /> Camera Scanner
            </h3>
            <div className="relative bg-black rounded-xl overflow-hidden aspect-square border border-slate-800">
              <video
                ref={posVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-8 border-2 border-emerald-400/80 rounded-lg pointer-events-none animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {/* Export Report Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setIsExportModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>

            <h3 className="text-lg font-bold text-slate-100 mb-4">Export Analytics Report</h3>

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

            <div className="space-y-4">
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
                className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition shadow-md shadow-fuchsia-600/30"
              >
                EXPORT NOW
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Thermal Receipt Modal with Amount Received & Change */}
      {receiptData && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:p-0 print:bg-white print:static">
          <div className="bg-white text-black p-6 rounded-2xl w-full max-w-xs shadow-2xl font-mono text-xs print:shadow-none print:w-full">
            <div className="text-center pb-3 border-b border-dashed border-gray-400 space-y-1">
              <h2 className="font-bold text-base tracking-wider">PEDDLR STORE</h2>
              <p className="text-[10px] text-gray-500">{new Date(receiptData.timestamp).toLocaleString('en-PH')}</p>
              <p className="text-[10px] font-bold text-gray-700">{receiptData.id}</p>
            </div>

            <div className="py-3 border-b border-dashed border-gray-400 space-y-1.5">
              {receiptData.items.map((item) => (
                <div key={item.id} className="flex justify-between items-start">
                  <div className="pr-2">
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-[10px] text-gray-600">
                      {item.quantity} x ₱{item.price.toFixed(2)}
                    </p>
                  </div>
                  <span className="font-bold">₱{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Calculations & Detailed Payment Section */}
            <div className="py-3 border-b border-dashed border-gray-400 space-y-1">
              {receiptData.discount > 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>DISCOUNT:</span>
                  <span>-₱{receiptData.discount.toFixed(2)}</span>
                </div>
              )}
              {receiptData.serviceFee > 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>SERVICE FEE:</span>
                  <span>+₱{receiptData.serviceFee.toFixed(2)}</span>
                </div>
              )}
              {receiptData.deliveryFee > 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>DELIVERY FEE:</span>
                  <span>+₱{receiptData.deliveryFee.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm pt-1">
                <span>TOTAL:</span>
                <span>₱{receiptData.netSales.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-700 uppercase pt-1">
                <span>PAYMENT MODE:</span>
                <span className="font-bold">{receiptData.paymentMethod}</span>
              </div>

              {receiptData.paymentMethod === 'cash' && (
                <>
                  <div className="flex justify-between text-gray-700 uppercase">
                    <span>AMOUNT RECEIVED:</span>
                    <span>₱{(receiptData.cashReceived || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-800 uppercase font-bold">
                    <span>CHANGE:</span>
                    <span>₱{(receiptData.changeDue || 0).toFixed(2)}</span>
                  </div>
                </>
              )}

              {receiptData.paymentMethod === 'gcash' && receiptData.gcashRefNumber && (
                <div className="flex justify-between text-gray-700 uppercase">
                  <span>REF NO:</span>
                  <span>{receiptData.gcashRefNumber}</span>
                </div>
              )}
            </div>

            {receiptData.customer && (
              <div className="py-2 border-b border-dashed border-gray-400 text-[10px] space-y-0.5">
                <p className="font-bold">Customer Info:</p>
                {receiptData.customer.name && <p>Name: {receiptData.customer.name}</p>}
                {receiptData.customer.phone && <p>Phone: {receiptData.customer.phone}</p>}
                {receiptData.customer.address && <p>Address: {receiptData.customer.address}</p>}
                {receiptData.customer.notes && <p>Notes: {receiptData.customer.notes}</p>}
              </div>
            )}

            <div className="mt-4 flex gap-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex-1 bg-fuchsia-600 text-white py-2 rounded-xl font-sans font-bold flex items-center justify-center gap-1 text-xs"
              >
                <Printer size={14} /> Print
              </button>
              <button
                onClick={() => setReceiptData(null)}
                className="bg-gray-200 text-gray-800 px-3 py-2 rounded-xl font-sans font-semibold text-xs"
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