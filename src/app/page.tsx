'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { db, LocalProduct } from '@/lib/db';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Barcode,
  Check,
  Search,
  Package,
  Zap,
  Store,
  Wifi,
  Receipt,
  Smartphone,
  Edit3,
  PlusCircle,
  X,
  Banknote,
  Camera,
  Printer,
  Hash,
  Settings,
  Sliders
} from 'lucide-react';

interface CartItem extends LocalProduct {
  quantity: number;
}

interface CompletedSale {
  id: string;
  items: CartItem[];
  totalAmount: number;
  paymentMethod: 'cash' | 'gcash';
  cashReceived?: number;
  changeDue?: number;
  gcashRefNumber?: string;
  timestamp: string;
}

type ScanMethod = 'hardware' | 'camera' | 'manual';

const SAMPLE_PRODUCTS: LocalProduct[] = [
  { id: '1', name: 'Lucky Me Pancit Canton Extra Hot', price: 15.00, stock: 48, barcode: '480001602201' },
  { id: '2', name: 'San Mig Coffee 3-in-1 Original', price: 8.50, stock: 120, barcode: '480001111222' },
  { id: '3', name: 'Coca-Cola Original 230ml Solo', price: 18.00, stock: 32, barcode: '480005553331' },
  { id: '4', name: 'Century Tuna Flakes in Oil 180g', price: 42.00, stock: 24, barcode: '480008884442' },
  { id: '5', name: 'Piattos Cheese Large 85g', price: 38.00, stock: 15, barcode: '480009995553' },
  { id: '6', name: 'Bear Brand Powdered Milk 33g', price: 16.00, stock: 60, barcode: '480007776664' },
];

export default function PosDashboard() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'pos' | 'inventory' | 'eload' | 'settings'>('pos');
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  
  // Scanner Settings State
  const [posScanMethod, setPosScanMethod] = useState<ScanMethod>('hardware');
  const [inventoryScanMethod, setInventoryScanMethod] = useState<ScanMethod>('camera');

  // Checkout & Payment State
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gcash'>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [gcashRefNumber, setGcashRefNumber] = useState('');
  const [loading, setLoading] = useState(false);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<LocalProduct | null>(null);
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formStock, setFormStock] = useState('');
  const [formBarcode, setFormBarcode] = useState('');

  // Camera & Target Context ('pos' vs 'inventory')
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<'pos' | 'inventory'>('pos');
  const [receiptData, setReceiptData] = useState<CompletedSale | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // E-Load Form State
  const [loadNumber, setLoadNumber] = useState('');
  const [loadAmount, setLoadAmount] = useState('50');
  const [telco, setTelco] = useState<'Globe' | 'Smart' | 'DITO'>('Globe');

  // Load scanner settings on initial render
  useEffect(() => {
    setMounted(true);
    const savedPosMethod = localStorage.getItem('posScanMethod') as ScanMethod;
    const savedInvMethod = localStorage.getItem('inventoryScanMethod') as ScanMethod;
    if (savedPosMethod) setPosScanMethod(savedPosMethod);
    if (savedInvMethod) setInventoryScanMethod(savedInvMethod);

    async function loadProducts() {
      try {
        const { data } = await supabase.from('products').select('*');
        if (data && data.length > 0) {
          setProducts(data);
          await db.products.bulkPut(data);
          return;
        }
      } catch {
        // Fallback to Dexie
      }

      const localData = await db.products.toArray();
      if (localData.length > 0) {
        setProducts(localData);
      } else {
        setProducts(SAMPLE_PRODUCTS);
        await db.products.bulkPut(SAMPLE_PRODUCTS);
      }
    }

    loadProducts();
  }, []);

  // Persist Settings
  const handleUpdatePosMethod = (method: ScanMethod) => {
    setPosScanMethod(method);
    localStorage.setItem('posScanMethod', method);
  };

  const handleUpdateInventoryMethod = (method: ScanMethod) => {
    setInventoryScanMethod(method);
    localStorage.setItem('inventoryScanMethod', method);
  };

  // Hardware Scanner Global Buffer Listener
  useEffect(() => {
    let barcodeBuffer = '';
    let timeoutId: NodeJS.Timeout;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'Enter') {
        if (barcodeBuffer.length > 2) {
          if (isModalOpen) {
            setFormBarcode(barcodeBuffer.trim());
          } else {
            handleScanCode(barcodeBuffer.trim());
          }
          barcodeBuffer = '';
        }
      } else if (e.key.length === 1) {
        barcodeBuffer += e.key;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          barcodeBuffer = '';
        }, 100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products, isModalOpen]);

  // Camera Barcode Detector Stream
  useEffect(() => {
    if (!isCameraOpen) return;
    let stream: MediaStream | null = null;
    let intervalId: NodeJS.Timeout;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if ('BarcodeDetector' in window) {
          const detector = new (window as any).BarcodeDetector({
            formats: ['qr_code', 'ean_13', 'code_128', 'ean_8', 'upc_a'],
          });

          intervalId = setInterval(async () => {
            if (videoRef.current && videoRef.current.readyState === 4) {
              try {
                const barcodes = await detector.detect(videoRef.current);
                if (barcodes.length > 0) {
                  const scannedCode = barcodes[0].rawValue;
                  if (cameraTarget === 'inventory') {
                    setFormBarcode(scannedCode);
                  } else {
                    handleScanCode(scannedCode);
                  }
                  setIsCameraOpen(false);
                }
              } catch (err) {
                console.error('Barcode detection error:', err);
              }
            }
          }, 300);
        }
      } catch (err) {
        alert('Could not open device camera. Ensure permissions are granted.');
        setIsCameraOpen(false);
      }
    }

    startCamera();

    return () => {
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (intervalId) clearInterval(intervalId);
    };
  }, [isCameraOpen, cameraTarget]);

  if (!mounted) {
    return <div className="h-screen bg-slate-900" />;
  }

  // --- Cart Calculations ---
  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const numCashReceived = parseFloat(cashReceived) || 0;
  const changeDue = numCashReceived - totalAmount;

  const handleScanCode = (code: string) => {
    const found = products.find((p) => p.barcode === code);
    if (found) {
      addToCart(found);
    } else {
      alert(`Barcode "${code}" not found in inventory.`);
    }
  };

  const addToCart = (product: LocalProduct) => {
    setCart((prev) => {
      const existing = prev.find((item) => (item.id && item.id === product.id) || item.barcode === product.barcode);
      if (existing) {
        return prev.map((item) =>
          ((item.id && item.id === product.id) || item.barcode === product.barcode)
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    handleScanCode(barcodeInput.trim());
    setBarcodeInput('');
  };

  const updateQuantity = (id: string | undefined, barcode: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if ((id && item.id === id) || item.barcode === barcode) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // --- Product Management ---
  const openAddModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormPrice('');
    setFormStock('');
    setFormBarcode('');
    setIsModalOpen(true);
  };

  const openEditModal = (p: LocalProduct) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormPrice(p.price.toString());
    setFormStock(p.stock.toString());
    setFormBarcode(p.barcode || '');
    setIsModalOpen(true);
  };

  const openCameraScanner = (target: 'pos' | 'inventory') => {
    setCameraTarget(target);
    setIsCameraOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPrice) return;

    const priceNum = parseFloat(formPrice) || 0;
    const stockNum = parseInt(formStock, 10) || 0;

    const productPayload = {
      name: formName.trim(),
      price: priceNum,
      stock: stockNum,
      barcode: formBarcode.trim(),
    };

    try {
      if (editingProduct && editingProduct.id) {
        const updatedProduct: LocalProduct = { ...editingProduct, ...productPayload };
        await supabase.from('products').update(productPayload).eq('id', editingProduct.id);
        await db.products.put(updatedProduct);
        setProducts((prev) => prev.map((p) => (p.id === editingProduct.id ? updatedProduct : p)));
      } else {
        let newProduct: LocalProduct = { id: crypto.randomUUID(), ...productPayload };
        const { data, error } = await supabase.from('products').insert([productPayload]).select().single();
        if (!error && data) newProduct = data;
        await db.products.put(newProduct);
        setProducts((prev) => [...prev, newProduct]);
      }
      setIsModalOpen(false);
    } catch {
      const fallbackProduct: LocalProduct = {
        id: editingProduct?.id || crypto.randomUUID(),
        ...productPayload,
      };
      await db.products.put(fallbackProduct);
      setProducts((prev) =>
        editingProduct
          ? prev.map((p) => (p.id === editingProduct.id ? fallbackProduct : p))
          : [...prev, fallbackProduct]
      );
      setIsModalOpen(false);
    }
  };

  // --- Checkout Handler ---
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true);

    const saleRecord: CompletedSale = {
      id: `TX-${Date.now().toString().slice(-6)}`,
      items: [...cart],
      totalAmount,
      paymentMethod,
      cashReceived: paymentMethod === 'cash' ? numCashReceived : undefined,
      changeDue: paymentMethod === 'cash' ? changeDue : undefined,
      gcashRefNumber: paymentMethod === 'gcash' ? gcashRefNumber.trim() : undefined,
      timestamp: new Date().toLocaleString(),
    };

    try {
      await supabase.from('sales').insert([
        {
          total_amount: totalAmount,
          payment_method: paymentMethod,
          gcash_ref_number: paymentMethod === 'gcash' ? gcashRefNumber.trim() : null,
        },
      ]);
    } catch {
      console.log('Saved transaction locally.');
    } finally {
      setLoading(false);
      setReceiptData(saleRecord);
      setCart([]);
      setCashReceived('');
      setGcashRefNumber('');
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery)
  );

  const isCheckoutDisabled =
    loading ||
    cart.length === 0 ||
    (paymentMethod === 'cash' && (numCashReceived < totalAmount || !cashReceived)) ||
    (paymentMethod === 'gcash' && !gcashRefNumber.trim());

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden print:bg-white print:text-black">
      {/* Sidebar Navigation */}
      <aside className="w-20 lg:w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between p-4 print:hidden">
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-500/30">
              <Store size={22} />
            </div>
            <div className="hidden lg:block">
              <h1 className="font-bold text-lg leading-none text-white">Peddlr POS</h1>
              <span className="text-xs text-blue-400 font-medium">Store Terminal</span>
            </div>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('pos')}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition font-medium ${
                activeTab === 'pos'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <ShoppingCart size={20} />
              <span className="hidden lg:inline">POS Counter</span>
            </button>

            <button
              onClick={() => setActiveTab('inventory')}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition font-medium ${
                activeTab === 'inventory'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <Package size={20} />
              <span className="hidden lg:inline">Inventory</span>
            </button>

            <button
              onClick={() => setActiveTab('eload')}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition font-medium ${
                activeTab === 'eload'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <Zap size={20} />
              <span className="hidden lg:inline">E-Loading</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition font-medium ${
                activeTab === 'settings'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <Settings size={20} />
              <span className="hidden lg:inline">Settings</span>
            </button>
          </nav>
        </div>

        <div className="px-3 py-2.5 bg-slate-900 rounded-xl border border-slate-800 hidden lg:flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wifi size={16} className="text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400">System Ready</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">v1.4</span>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-900 overflow-hidden print:hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-800 px-6 flex items-center justify-between gap-4 bg-slate-950/40">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-2.5 text-slate-500" size={18} />
              <input
                type="text"
                placeholder="Search items or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Direct POS Scan Action based on Settings */}
            {posScanMethod === 'camera' && (
              <button
                onClick={() => openCameraScanner('pos')}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-2 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-blue-600/20"
              >
                <Camera size={16} /> Scan via Camera
              </button>
            )}

            {(posScanMethod === 'hardware' || posScanMethod === 'manual') && (
              <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-2">
                <div className="relative">
                  <Barcode className="absolute left-3 top-2.5 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder={posScanMethod === 'hardware' ? 'Hardware Scanner Ready...' : 'Enter barcode...'}
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    className="bg-slate-800/80 border border-slate-700/60 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500 w-36 lg:w-48"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-3 py-2 rounded-xl transition shadow-md shadow-blue-600/20"
                >
                  Scan
                </button>
              </form>
            )}

            <button
              onClick={openAddModal}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-3 py-2 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
            >
              <PlusCircle size={18} />
              <span className="hidden sm:inline">Add Product</span>
            </button>
          </div>
        </header>

        {/* POS Grid View */}
        {activeTab === 'pos' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Store size={20} className="text-blue-400" /> Inventory Catalog
              </h2>
              <span className="text-xs bg-slate-800 border border-slate-700 px-3 py-1 rounded-full text-slate-400 font-mono">
                Scanner Mode: <strong className="text-blue-400 uppercase">{posScanMethod}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map((product) => (
                <div
                  key={product.id || product.barcode}
                  onClick={() => addToCart(product)}
                  className="bg-slate-800/50 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 p-4 rounded-2xl cursor-pointer transition flex flex-col justify-between group shadow-sm hover:shadow-lg"
                >
                  <div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1">
                      {product.barcode || 'NO BARCODE'}
                    </span>
                    <h3 className="font-semibold text-slate-200 group-hover:text-blue-400 transition text-sm line-clamp-2">
                      {product.name}
                    </h3>
                  </div>

                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Stock: {product.stock}</span>
                      <p className="text-lg font-bold text-emerald-400">₱{product.price.toFixed(2)}</p>
                    </div>
                    <button className="p-2 bg-slate-700 group-hover:bg-blue-600 text-white rounded-xl transition">
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* E-Load Form View */}
        {activeTab === 'eload' && (
          <div className="flex-1 p-6 max-w-xl mx-auto w-full">
            <div className="bg-slate-800/60 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl">
                  <Smartphone size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold">E-Load Station</h2>
                  <p className="text-xs text-slate-400">Direct top-up to mobile accounts</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-2 block">Network Provider</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['Globe', 'Smart', 'DITO'] as const).map((provider) => (
                      <button
                        key={provider}
                        onClick={() => setTelco(provider)}
                        className={`py-3 font-bold rounded-xl border text-sm transition ${
                          telco === provider
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                            : 'bg-slate-800 border-slate-700 text-slate-300'
                        }`}
                      >
                        {provider}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1 block">Phone Number</label>
                  <input
                    type="text"
                    placeholder="09XXXXXXXXX"
                    value={loadNumber}
                    onChange={(e) => setLoadNumber(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 font-mono text-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-2 block">Amount</label>
                  <div className="grid grid-cols-4 gap-2">
                    {['20', '50', '100', '200'].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setLoadAmount(amt)}
                        className={`py-2 rounded-xl text-sm font-semibold border ${
                          loadAmount === amt
                            ? 'bg-slate-100 text-slate-900 border-white'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        ₱{amt}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (!loadNumber) return alert('Please input phone number.');
                    alert(`Loaded ₱${loadAmount} to ${loadNumber} (${telco})`);
                    setLoadNumber('');
                  }}
                  className="w-full mt-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3.5 rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                >
                  <Zap size={18} /> Top-Up Load
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Inventory Master List View */}
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
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-2 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
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

        {/* Scanner Settings View */}
        {activeTab === 'settings' && (
          <div className="flex-1 p-6 overflow-y-auto max-w-2xl mx-auto w-full">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
              <div className="p-3 bg-blue-600/20 text-blue-400 rounded-xl">
                <Sliders size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold">Scanner Configuration</h2>
                <p className="text-xs text-slate-400">Set default hardware or camera devices for scanning items</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* POS Scanner Preference */}
              <div className="bg-slate-800/50 border border-slate-800 rounded-2xl p-5">
                <h3 className="font-semibold text-slate-100 mb-1 flex items-center gap-2">
                  <ShoppingCart size={18} className="text-blue-400" /> POS Checkout Scanning Device
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Choose how products are scanned when adding items to customer cart at checkout.
                </p>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'hardware', label: 'Hardware Scanner', desc: 'USB or Bluetooth Handheld Gun' },
                    { id: 'camera', label: 'Device Camera', desc: 'Built-in Mobile or Webcam' },
                    { id: 'manual', label: 'Manual Entry', desc: 'Type Barcode or Search Item' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => handleUpdatePosMethod(option.id as ScanMethod)}
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

              {/* Inventory Scanner Preference */}
              <div className="bg-slate-800/50 border border-slate-800 rounded-2xl p-5">
                <h3 className="font-semibold text-slate-100 mb-1 flex items-center gap-2">
                  <Package size={18} className="text-emerald-400" /> Inventory Addition Scanning Device
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Choose how barcodes are captured when registering or updating product inventory.
                </p>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'hardware', label: 'Hardware Scanner', desc: 'Auto-fill form via physical scanner' },
                    { id: 'camera', label: 'Device Camera', desc: 'Capture barcode using device camera' },
                    { id: 'manual', label: 'Manual Key-in', desc: 'Type barcode numbers manually' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => handleUpdateInventoryMethod(option.id as ScanMethod)}
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

      {/* Right Shopping Cart Panel */}
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

        {/* Checkout Controls */}
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

          {/* Dynamic Payment Input (Cash vs GCash) */}
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

      {/* Device Camera Scanner Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl relative">
            <button
              onClick={() => setIsCameraOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-lg transition"
            >
              <X size={20} />
            </button>

            <h3 className="text-md font-bold text-slate-100 mb-3 flex items-center gap-2">
              <Camera size={18} className="text-blue-400" />
              {cameraTarget === 'inventory' ? 'Scan Barcode for Inventory' : 'Camera Checkout Scanner'}
            </h3>

            <div className="relative bg-black rounded-xl overflow-hidden aspect-square flex items-center justify-center border border-slate-800">
              <video ref={videoRef} className="w-full h-full object-cover" />
              <div className="absolute inset-8 border-2 border-emerald-400/80 rounded-lg pointer-events-none animate-pulse" />
            </div>

            <p className="text-xs text-slate-400 text-center mt-3">
              Point your camera directly at the item barcode.
            </p>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
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
                  {inventoryScanMethod === 'camera' && (
                    <button
                      type="button"
                      onClick={() => openCameraScanner('inventory')}
                      className="bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1 transition"
                      title="Scan via Camera"
                    >
                      <Camera size={16} /> Scan
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
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

      {/* Printable Thermal Receipt Modal */}
      {receiptData && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:p-0 print:bg-white print:static print:inset-auto print:block">
          <div className="bg-white text-black p-6 rounded-2xl w-full max-w-xs shadow-2xl font-mono text-xs print:shadow-none print:w-full print:max-w-none print:p-0">
            {/* Store Header */}
            <div className="text-center pb-3 border-b border-dashed border-gray-400 space-y-1">
              <h2 className="font-bold text-base tracking-wider">PEDDLR STORE</h2>
              <p className="text-[10px] text-gray-600">Sari-Sari & Retail POS Terminal</p>
              <p className="text-[10px] text-gray-500">{receiptData.timestamp}</p>
              <p className="text-[10px] font-bold text-gray-700">{receiptData.id}</p>
            </div>

            {/* Receipt Items */}
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

            {/* Receipt Totals */}
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

            {/* Receipt Footer */}
            <div className="text-center pt-3 text-[10px] text-gray-500 space-y-1">
              <p>Maraming Salamat Po!</p>
              <p>Please come again.</p>
            </div>

            {/* Action Buttons (Hidden when printing) */}
            <div className="mt-5 flex gap-2 print:hidden">
              <button
                onClick={handlePrintReceipt}
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