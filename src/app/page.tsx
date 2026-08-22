'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'lucide-react';

import {
  Product,
  CartItem,
  ScanMethod,
  PaymentMethod,
  ActiveTab,
  ReceiptData,
} from '@/types/pos';

const initialProducts: Product[] = [
  { id: '1', name: 'San Mig Coffee 3-in-1 Original', barcode: '4800016644021', price: 12.00, stock: 45 },
  { id: '2', name: 'Lucky Me! Instant Pancit Canton Extra Hot', barcode: '4800016021020', price: 15.50, stock: 32 },
  { id: '3', name: 'Coca-Cola 1.5L PET', barcode: '4800000000012', price: 75.00, stock: 18 },
  { id: '4', name: 'Datu Puti Vinegar 200ml', barcode: '4800011000111', price: 18.00, stock: 24 },
  { id: '5', name: 'Silver Swan Soy Sauce 200ml', barcode: '4800011000222', price: 19.00, stock: 15 },
  { id: '6', name: 'Bear Brand Fortified Powdered Milk 33g', barcode: '4800016000333', price: 16.00, stock: 50 },
];

export default function POSSystem() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('inventory');
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [posScanMethod, setPosScanMethod] = useState<ScanMethod>('hardware');
  const [inventoryScanMethod, setInventoryScanMethod] = useState<ScanMethod>('camera');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [gcashRefNumber, setGcashRefNumber] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Form Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formStock, setFormStock] = useState('');
  const [formBarcode, setFormBarcode] = useState('');

  // POS Checkout Overlay Camera State
  const [isPosCameraOpen, setIsPosCameraOpen] = useState(false);
  const posVideoRef = useRef<HTMLVideoElement | null>(null);

  // Inline Modal Camera State
  const [isInlineScanning, setIsInlineScanning] = useState(false);
  const inlineVideoRef = useRef<HTMLVideoElement | null>(null);
  const [scannedFeedback, setScannedFeedback] = useState<string | null>(null);

  // Receipt Modal State
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  // Physical Scanner Gun Listener Buffer
  const barcodeBuffer = useRef<string>('');
  const lastKeyTime = useRef<number>(0);

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cashVal = parseFloat(cashReceived) || 0;
  const changeDue = cashVal - totalAmount;

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

      if (isModalOpen) {
        setFormBarcode(trimmedCode);
        setScannedFeedback(`Scanned Code: ${trimmedCode}`);
        setIsInlineScanning(false);
        setTimeout(() => setScannedFeedback(null), 4000);
      } else if (activeTab === 'pos') {
        const found = products.find((p) => p.barcode === trimmedCode);
        if (found) {
          addToCart(found);
          setScannedFeedback(`Added ${found.name}`);
          setTimeout(() => setScannedFeedback(null), 2000);
        } else {
          alert(`Product with barcode "${trimmedCode}" not found.`);
        }
      }
    },
    [isModalOpen, activeTab, products, addToCart]
  );

  // Hardware Scanner Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';

      if (isInput && !isModalOpen) return;

      const currentTime = Date.now();
      if (currentTime - lastKeyTime.current > 80) {
        barcodeBuffer.current = '';
      }
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

  // Inline Modal Camera Stream & Detector
  useEffect(() => {
    let stream: MediaStream | null = null;
    let animFrameId: number;
    let active = true;

    if (isInlineScanning) {
      navigator.mediaDevices
        ?.getUserMedia({ video: { facingMode: 'environment' } })
        .then((s) => {
          if (!active) return;
          stream = s;
          if (inlineVideoRef.current) {
            inlineVideoRef.current.srcObject = s;
            inlineVideoRef.current.play();

            if ('BarcodeDetector' in window) {
              const barcodeDetector = new (window as any).BarcodeDetector({
                formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
              });

              const detect = async () => {
                if (inlineVideoRef.current && inlineVideoRef.current.readyState === 4) {
                  try {
                    const barcodes = await barcodeDetector.detect(inlineVideoRef.current);
                    if (barcodes.length > 0 && active) {
                      const code = barcodes[0].rawValue;
                      handleBarcodeScanned(code);
                      return;
                    }
                  } catch (err) {
                    console.error('Inline scanner error:', err);
                  }
                }
                if (active) animFrameId = requestAnimationFrame(detect);
              };
              animFrameId = requestAnimationFrame(detect);
            }
          }
        })
        .catch((err) => {
          console.error('Camera access error:', err);
          alert('Could not open camera.');
          setIsInlineScanning(false);
        });
    }

    return () => {
      active = false;
      if (animFrameId) cancelAnimationFrame(animFrameId);
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
  }, [isInlineScanning, handleBarcodeScanned]);

  // POS Checkout Camera Stream
  useEffect(() => {
    let stream: MediaStream | null = null;
    let animFrameId: number;
    let active = true;

    if (isPosCameraOpen) {
      navigator.mediaDevices
        ?.getUserMedia({ video: { facingMode: 'environment' } })
        .then((s) => {
          if (!active) return;
          stream = s;
          if (posVideoRef.current) {
            posVideoRef.current.srcObject = s;
            posVideoRef.current.play();

            if ('BarcodeDetector' in window) {
              const barcodeDetector = new (window as any).BarcodeDetector({
                formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
              });

              const detect = async () => {
                if (posVideoRef.current && posVideoRef.current.readyState === 4) {
                  try {
                    const barcodes = await barcodeDetector.detect(posVideoRef.current);
                    if (barcodes.length > 0 && active) {
                      handleBarcodeScanned(barcodes[0].rawValue);
                      setIsPosCameraOpen(false);
                      return;
                    }
                  } catch (err) {
                    console.error('POS camera scan error:', err);
                  }
                }
                if (active) animFrameId = requestAnimationFrame(detect);
              };
              animFrameId = requestAnimationFrame(detect);
            }
          }
        })
        .catch((err) => {
          console.error('POS camera error:', err);
          alert('Could not open camera.');
          setIsPosCameraOpen(false);
        });
    }

    return () => {
      active = false;
      if (animFrameId) cancelAnimationFrame(animFrameId);
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
  }, [isPosCameraOpen, handleBarcodeScanned]);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormPrice('');
    setFormStock('');
    setFormBarcode('');
    setIsInlineScanning(false);
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormName(product.name);
    setFormPrice(product.price.toString());
    setFormStock(product.stock.toString());
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
      stock: parseInt(formStock, 10) || 0,
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

      const receipt: ReceiptData = {
        id: `INV-${Date.now().toString().slice(-6)}`,
        timestamp: new Date().toLocaleString('en-PH', { dateStyle: 'short', timeStyle: 'short' }),
        items: [...cart],
        totalAmount,
        paymentMethod,
        cashReceived: paymentMethod === 'cash' ? cashVal : undefined,
        changeDue: paymentMethod === 'cash' ? changeDue : undefined,
        gcashRefNumber: paymentMethod === 'gcash' ? gcashRefNumber : undefined,
      };

      setReceiptData(receipt);
      setCart([]);
      setCashReceived('');
      setGcashRefNumber('');
      setLoading(false);
    }, 600);
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery)
  );

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-4 print:hidden">
        <div>
          <div className="flex items-center gap-3 px-2 py-4 border-b border-slate-800 mb-6">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-600/30">
              <Store size={22} />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight">PEDDLR POS</h1>
              <p className="text-[11px] text-slate-400">Retail & Inventory</p>
            </div>
          </div>

          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveTab('pos')}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition ${
                activeTab === 'pos'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
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
          <p className="font-semibold text-slate-300">Scanner Mode:</p>
          <p className="capitalize">POS: <span className="text-blue-400">{posScanMethod}</span></p>
          <p className="capitalize">Stock: <span className="text-emerald-400">{inventoryScanMethod}</span></p>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-950 overflow-hidden">
        {activeTab === 'pos' && (
          <div className="flex-1 flex flex-col p-6 overflow-hidden">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-3 text-slate-500" size={18} />
                <input
                  type="text"
                  placeholder="Search item name or barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {posScanMethod === 'camera' && (
                <button
                  onClick={() => setIsPosCameraOpen(true)}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow-md shadow-blue-600/20"
                >
                  <Camera size={16} /> Open Camera Scanner
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-4 rounded-2xl flex flex-col justify-between cursor-pointer transition group hover:shadow-lg hover:shadow-blue-900/10"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                          {product.barcode || 'NO CODE'}
                        </span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${product.stock > 0 ? 'bg-slate-800 text-slate-300' : 'bg-rose-950 text-rose-400'}`}>
                          {product.stock} left
                        </span>
                      </div>
                      <h3 className="font-semibold text-xs text-slate-200 group-hover:text-white transition line-clamp-2">
                        {product.name}
                      </h3>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-sm font-bold text-emerald-400">₱{product.price.toFixed(2)}</span>
                      <span className="p-1.5 bg-blue-600/10 text-blue-400 group-hover:bg-blue-600 group-hover:text-white rounded-lg transition">
                        <Plus size={14} />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">Stock Ledger</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Inventory Scanner Preference:{' '}
                  <span className="text-emerald-400 uppercase font-semibold">{inventoryScanMethod}</span>
                </p>
              </div>
              <button
                onClick={openAddModal}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
              >
                <PlusCircle size={16} /> Add Product
              </button>
            </div>

            <div className="bg-slate-800/40 border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-4">Item Description</th>
                    <th className="p-4">Barcode</th>
                    <th className="p-4">Price</th>
                    <th className="p-4">Stock Quantity</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {products.map((p) => (
                    <tr key={p.id || p.barcode} className="hover:bg-slate-800/30">
                      <td className="p-4 font-medium text-slate-100">{p.name}</td>
                      <td className="p-4 font-mono text-xs text-slate-400">{p.barcode || '—'}</td>
                      <td className="p-4 font-bold text-emerald-400">₱{p.price.toFixed(2)}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs font-semibold">
                          {p.stock} units
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-1.5 bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white rounded-lg transition"
                          title="Edit Product"
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

        {activeTab === 'settings' && (
          <div className="flex-1 p-6 overflow-y-auto max-w-2xl mx-auto w-full">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
              <div className="p-3 bg-blue-600/20 text-blue-400 rounded-xl">
                <Sliders size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold">Scanner Configuration</h2>
                <p className="text-xs text-slate-400">Set default scanning behavior for POS and Stock entry</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-slate-800/50 border border-slate-800 rounded-2xl p-5">
                <h3 className="font-semibold text-slate-100 mb-1 flex items-center gap-2">
                  <ShoppingCart size={18} className="text-blue-400" /> POS Checkout Scanning Device
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Select the active method used when adding items at checkout.
                </p>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'hardware', label: 'Hardware Gun', desc: 'USB or Bluetooth Handheld Scanner' },
                    { id: 'camera', label: 'Device Camera', desc: 'Webcam or Mobile Camera' },
                    { id: 'manual', label: 'Manual Entry', desc: 'Search or enter barcode manually' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setPosScanMethod(option.id as ScanMethod)}
                      className={`p-4 rounded-xl border text-left transition flex flex-col justify-between ${
                        posScanMethod === option.id
                          ? 'bg-blue-600/10 border-blue-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-xs text-slate-200">{option.label}</span>
                          {posScanMethod === option.id && <Check size={16} className="text-blue-400" />}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-tight">{option.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-800/50 border border-slate-800 rounded-2xl p-5">
                <h3 className="font-semibold text-slate-100 mb-1 flex items-center gap-2">
                  <Package size={18} className="text-emerald-400" /> Stock Entry Scanning Device
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Select default barcode capturing behavior when creating or editing items.
                </p>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'hardware', label: 'Hardware Gun', desc: 'Auto-fill form via physical scanner' },
                    { id: 'camera', label: 'Device Camera', desc: 'Scan barcode via camera button' },
                    { id: 'manual', label: 'Manual Key-in', desc: 'Type barcode numbers manually' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setInventoryScanMethod(option.id as ScanMethod)}
                      className={`p-4 rounded-xl border text-left transition flex flex-col justify-between ${
                        inventoryScanMethod === option.id
                          ? 'bg-emerald-600/10 border-emerald-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-xs text-slate-200">{option.label}</span>
                          {inventoryScanMethod === option.id && <Check size={16} className="text-emerald-400" />}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-tight">{option.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Cart Summary Panel */}
      <aside className="w-96 bg-slate-950 border-l border-slate-800 flex flex-col justify-between p-6 print:hidden">
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
            <div className="flex items-center gap-2">
              <Receipt className="text-blue-400" size={20} />
              <h2 className="font-bold text-slate-100">Order Summary</h2>
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

          <div className="space-y-3 max-h-[calc(100vh-420px)] overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <div className="text-center py-12 text-slate-600">
                <ShoppingCart size={36} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">Cart is empty</p>
                <p className="text-xs">Scan or click items to add</p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id || item.barcode}
                  className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="font-medium text-xs text-slate-200 truncate">{item.name}</p>
                    <p className="text-xs font-bold text-emerald-400 mt-0.5">
                      ₱{(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg p-1">
                    <button
                      onClick={() => updateQuantity(item.id, item.barcode, -1)}
                      className="p-1 text-slate-400 hover:text-white"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-xs font-bold px-1">{item.quantity}</span>
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
        </div>

        <div className="border-t border-slate-800 pt-4 space-y-4">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal</span>
              <span>₱{totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-slate-100 pt-2 border-t border-slate-800/80">
              <span>Total Amount</span>
              <span className="text-emerald-400">₱{totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Payment Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['cash', 'gcash'] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`py-2 text-xs font-semibold rounded-xl border uppercase transition ${
                    paymentMethod === method
                      ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/30'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {method === 'gcash' ? 'GCash' : 'Cash'}
                </button>
              ))}
            </div>
          </div>

          {paymentMethod === 'cash' && (
            <div className="space-y-2">
              <div className="relative">
                <Banknote className="absolute left-3 top-2.5 text-slate-500" size={16} />
                <input
                  type="number"
                  placeholder="Cash Received (₱)"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              {cashReceived !== '' && (
                <div className="flex justify-between items-center text-xs px-1 font-semibold">
                  <span className="text-slate-400">Change Due:</span>
                  <span
                    className={`font-mono text-sm ${
                      changeDue >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {changeDue >= 0 ? `₱${changeDue.toFixed(2)}` : 'Insufficient Cash'}
                  </span>
                </div>
              )}
            </div>
          )}

          {paymentMethod === 'gcash' && (
            <div className="relative">
              <Hash className="absolute left-3 top-2.5 text-slate-500" size={16} />
              <input
                type="text"
                placeholder="GCash Ref / Trans. No."
                value={gcashRefNumber}
                onChange={(e) => setGcashRefNumber(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono placeholder-slate-500"
              />
            </div>
          )}

          <button
            onClick={handleCheckout}
            disabled={isCheckoutDisabled}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-600/25 disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none"
          >
            <Check size={18} /> {loading ? 'Processing...' : 'Complete Sale'}
          </button>
        </div>
      </aside>

      {/* Add / Edit Product Modal with Embedded Scanner */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setIsInlineScanning(false);
                setIsModalOpen(false);
              }}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg transition"
            >
              <X size={20} />
            </button>

            <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
              <Package size={20} className="text-blue-400" />
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </h3>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. San Mig Coffee 3-in-1"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    Price (₱) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    Initial Stock
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* Barcode Section with Inline Live Camera Viewfinder */}
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">
                  Barcode Number
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Scan or enter barcode"
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setIsInlineScanning((prev) => !prev)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border ${
                      isInlineScanning
                        ? 'bg-rose-600/20 text-rose-400 border-rose-500/30 hover:bg-rose-600 hover:text-white'
                        : 'bg-blue-600/20 text-blue-400 border-blue-500/30 hover:bg-blue-600 hover:text-white'
                    }`}
                  >
                    <Camera size={16} />
                    {isInlineScanning ? 'Close' : 'Scan'}
                  </button>
                </div>

                {/* Live Camera Viewfinder */}
                {isInlineScanning && (
                  <div className="mt-3 relative bg-black rounded-xl overflow-hidden aspect-video border-2 border-blue-500 shadow-inner flex flex-col items-center justify-center">
                    <video
                      ref={inlineVideoRef}
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-4 border-2 border-dashed border-emerald-400/80 rounded-lg pointer-events-none animate-pulse flex items-end justify-center pb-2">
                      <span className="bg-slate-950/90 text-emerald-400 text-[10px] px-2 py-0.5 rounded font-mono border border-emerald-500/30">
                        Point camera at item barcode
                      </span>
                    </div>
                  </div>
                )}

                {scannedFeedback && (
                  <p className="text-[11px] text-emerald-400 mt-2 flex items-center gap-1 font-semibold bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg">
                    <CheckCircle2 size={13} /> {scannedFeedback}
                  </p>
                )}
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsInlineScanning(false);
                    setIsModalOpen(false);
                  }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-sm font-semibold transition shadow-md shadow-blue-600/30"
                >
                  {editingProduct ? 'Update Product' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POS Terminal Overlay Camera Modal */}
      {isPosCameraOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[60] p-4 print:hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl relative">
            <button
              onClick={() => setIsPosCameraOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg transition"
            >
              <X size={20} />
            </button>

            <h3 className="text-md font-bold text-slate-100 mb-3 flex items-center gap-2">
              <Camera size={18} className="text-blue-400" />
              Camera Checkout Scanner
            </h3>

            <div className="relative bg-black rounded-xl overflow-hidden aspect-square flex items-center justify-center border border-slate-800">
              <video ref={posVideoRef} playsInline muted className="w-full h-full object-cover" />
              <div className="absolute inset-8 border-2 border-emerald-400/80 rounded-lg pointer-events-none animate-pulse" />
            </div>

            <p className="text-xs text-slate-400 text-center mt-3">
              Point camera directly at the item barcode.
            </p>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {receiptData && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:p-0 print:bg-white print:static print:inset-auto print:block">
          <div className="bg-white text-black p-6 rounded-2xl w-full max-w-xs shadow-2xl font-mono text-xs print:shadow-none print:w-full print:max-w-none print:p-0">
            <div className="text-center pb-3 border-b border-dashed border-gray-400 space-y-1">
              <h2 className="font-bold text-base tracking-wider">PEDDLR STORE</h2>
              <p className="text-[10px] text-gray-600">Sari-Sari & Retail POS Terminal</p>
              <p className="text-[10px] text-gray-500">{receiptData.timestamp}</p>
              <p className="text-[10px] font-bold text-gray-700">{receiptData.id}</p>
            </div>

            <div className="py-3 border-b border-dashed border-gray-400 space-y-1.5">
              {receiptData.items.map((item) => (
                <div key={item.id || item.barcode} className="flex justify-between items-start">
                  <div className="pr-2">
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-[10px] text-gray-600">
                      {item.quantity} x ₱{item.price.toFixed(2)}
                    </p>
                  </div>
                  <span className="font-bold text-right">
                    ₱{(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="py-3 border-b border-dashed border-gray-400 space-y-1">
              <div className="flex justify-between font-bold text-sm">
                <span>TOTAL:</span>
                <span>₱{receiptData.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-700 uppercase">
                <span>Payment Mode:</span>
                <span>{receiptData.paymentMethod}</span>
              </div>

              {receiptData.paymentMethod === 'cash' && (
                <>
                  <div className="flex justify-between text-gray-700">
                    <span>Cash Tendered:</span>
                    <span>₱{receiptData.cashReceived?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-gray-900">
                    <span>Change:</span>
                    <span>₱{receiptData.changeDue?.toFixed(2)}</span>
                  </div>
                </>
              )}

              {receiptData.paymentMethod === 'gcash' && receiptData.gcashRefNumber && (
                <div className="flex justify-between text-gray-700 pt-1 border-t border-gray-200">
                  <span>GCash Ref No:</span>
                  <span className="font-bold">{receiptData.gcashRefNumber}</span>
                </div>
              )}
            </div>

            <div className="text-center pt-3 text-[10px] text-gray-500 space-y-1">
              <p>Maraming Salamat Po!</p>
              <p>Please come again.</p>
            </div>

            <div className="mt-5 flex gap-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl font-sans font-bold flex items-center justify-center gap-1 text-xs"
              >
                <Printer size={14} /> Print Receipt
              </button>
              <button
                onClick={() => setReceiptData(null)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-2 rounded-xl font-sans font-semibold text-xs"
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