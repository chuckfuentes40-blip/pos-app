import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ShoppingCart, Package, BarChart3, BookOpen, Settings,
  Camera, Plus, Trash2, Edit3, Printer, Bluetooth, X, Mail,
  Search, RefreshCw, CheckCircle, Clock, DollarSign, UserCheck,
  AlertCircle, Download, Volume2, VolumeX, Pause, Play, ChevronRight,
  Filter, Tag, ArrowUpRight, ArrowDownRight, UserPlus, FileSpreadsheet
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// ==========================================
// 1. SUPABASE CLIENT & INITIAL CONSTANTS
// ==========================================
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://your-supabase-url.supabase.co';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'your-anon-key';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DEFAULT_SETTINGS = {
  storeName: 'IÑAKI STORE',
  storeAddress: '123 Barangay Street, Manila, Philippines',
  contactNumber: '+63 912 345 6789',
  receiptFooter: 'Maraming Salamat Po!\nPlease Come Again',
  paperWidth: '58mm', // '58mm' or '80mm'
  soundEnabled: true,
  autoPulseDrawer: true
};

// ==========================================
// 2. AUDIO SYNTHESIZER UTILITY (Web Audio API)
// ==========================================
const playAudioFeedback = (type, enabled = true) => {
  if (!enabled) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'beep') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.50, ctx.currentTime); // C6
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16); // G5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(180, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {
    console.warn('Audio synthesis failed:', e);
  }
};

// ==========================================
// 3. CSV EXPORT UTILITY
// ==========================================
const exportToCSV = (data, filename) => {
  if (!data || !data.length) {
    alert('No data available to export.');
    return;
  }
  const headers = Object.keys(data[0]);
  const csvRows = [];
  csvRows.push(headers.join(','));

  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header];
      const escaped = ('' + (val ?? '')).replace(/"/g, '\\"');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// ==========================================
// 4. THERMAL RECEIPT & HARDWARE BUFFER BUILDER
// ==========================================
const buildThermalReceiptBuffer = (data, settings = DEFAULT_SETTINGS) => {
  const encoder = new TextEncoder();
  const parts = [];

  const lineCharLength = settings.paperWidth === '80mm' ? 48 : 32;
  const separator = '-'.repeat(lineCharLength) + '\n';

  const formatLine = (left, right) => {
    const spaceCount = lineCharLength - (left.length + right.length);
    if (spaceCount < 1) {
      return left.substring(0, lineCharLength - right.length - 1) + ' ' + right + '\n';
    }
    return left + ' '.repeat(spaceCount) + right + '\n';
  };

  // Initialize & Center Align
  parts.push(new Uint8Array([0x1B, 0x40])); // Reset ESC @
  parts.push(new Uint8Array([0x1B, 0x61, 0x01])); // ESC a 1 (Center)

  // Header Title
  parts.push(new Uint8Array([0x1B, 0x21, 0x30])); // Double height + width
  parts.push(encoder.encode(`${settings.storeName}\n`));
  parts.push(new Uint8Array([0x1B, 0x21, 0x00])); // Normal size
  
  if (settings.storeAddress) parts.push(encoder.encode(`${settings.storeAddress}\n`));
  if (settings.contactNumber) parts.push(encoder.encode(`Tel: ${settings.contactNumber}\n`));
  parts.push(encoder.encode(`${new Date(data.timestamp || data.created_at).toLocaleString('en-PH')}\n`));
  parts.push(encoder.encode(`Receipt #: ${data.id}\n`));
  parts.push(encoder.encode(separator));

  // Align Left for Itemized List
  parts.push(new Uint8Array([0x1B, 0x61, 0x00]));
  data.items.forEach((item) => {
    const itemName = item.name.length > lineCharLength ? item.name.substring(0, lineCharLength) : item.name;
    parts.push(encoder.encode(`${itemName}\n`));
    const qtyPrice = `  ${item.quantity} x P${Number(item.price).toFixed(2)}`;
    const total = `P${(item.quantity * item.price).toFixed(2)}`;
    parts.push(encoder.encode(formatLine(qtyPrice, total)));
  });

  parts.push(encoder.encode(separator));

  // Financial Breakdown
  parts.push(encoder.encode(formatLine('Subtotal:', `P${Number(data.subtotal || data.netSales).toFixed(2)}`)));
  if (data.discount > 0) parts.push(encoder.encode(formatLine('Discount:', `-P${Number(data.discount).toFixed(2)}`)));
  if (data.extraFee > 0) parts.push(encoder.encode(formatLine('Extra Fee:', `P${Number(data.extraFee).toFixed(2)}`)));
  if (data.deliveryFee > 0) parts.push(encoder.encode(formatLine('Delivery Fee:', `P${Number(data.deliveryFee).toFixed(2)}`)));
  
  parts.push(encoder.encode(separator));
  
  // Emphasized Net Total
  parts.push(new Uint8Array([0x1B, 0x21, 0x20])); // Bold text
  parts.push(encoder.encode(formatLine('NET TOTAL:', `P${Number(data.netSales).toFixed(2)}`)));
  parts.push(new Uint8Array([0x1B, 0x21, 0x00])); // Normal text

  // Payment Particulars
  parts.push(encoder.encode(formatLine('Payment Method:', String(data.paymentMethod).toUpperCase())));
  if (data.paymentMethod === 'cash') {
    parts.push(encoder.encode(formatLine('Cash Tendered:', `P${Number(data.cashTendered || 0).toFixed(2)}`)));
    parts.push(encoder.encode(formatLine('Change:', `P${Number(data.change || 0).toFixed(2)}`)));
  } else if (data.gcashRefNumber) {
    parts.push(encoder.encode(formatLine('GCash Ref #:', String(data.gcashRefNumber))));
  }

  parts.push(encoder.encode(separator));

  // Footer Alignment Center
  parts.push(new Uint8Array([0x1B, 0x61, 0x01]));
  parts.push(encoder.encode(`${settings.receiptFooter}\n\n\n`));

  // Hardware Trigger: Cash Drawer Pulse (Pin 2 / Pin 5)
  if (settings.autoPulseDrawer) {
    parts.push(new Uint8Array([0x1B, 0x70, 0x00, 0x19, 0xFA]));
  }

  // Paper Cut (GS V 0)
  parts.push(new Uint8Array([0x1D, 0x56, 0x00]));

  // Binary Output Assembly
  const totalLength = parts.reduce((acc, p) => acc + p.length, 0);
  const combinedBuffer = new Uint8Array(totalLength);
  let offset = 0;
  parts.forEach((p) => {
    combinedBuffer.set(p, offset);
    offset += p.length;
  });

  return combinedBuffer;
};

// ==========================================
// 5. CAMERA SCANNER COMPONENT MODAL
// ==========================================
function CameraScanner({ isOpen, onClose, onScan, soundEnabled }) {
  const videoRef = useRef(null);
  const [inputCode, setInputCode] = useState('');
  const [cameraError, setCameraError] = useState(null);

  useEffect(() => {
    let stream = null;
    if (isOpen) {
      setCameraError(null);
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
          .then((s) => {
            stream = s;
            if (videoRef.current) {
              videoRef.current.srcObject = s;
            }
          })
          .catch((err) => {
            console.error('Camera stream access failed:', err);
            setCameraError('Camera access denied or unavailable.');
          });
      } else {
        setCameraError('MediaDevices API not supported on this device.');
      }
    }
    return () => {
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (inputCode.trim()) {
      playAudioFeedback('beep', soundEnabled);
      onScan(inputCode.trim());
      setInputCode('');
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-fuchsia-400" />
            <h3 className="font-bold text-white text-sm">Scan Barcode ID</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition">
            <X size={18} />
          </button>
        </div>

        <div className="relative bg-black rounded-2xl overflow-hidden aspect-video flex items-center justify-center border border-slate-800">
          {cameraError ? (
            <div className="text-center p-4 space-y-2">
              <AlertCircle size={28} className="text-amber-500 mx-auto" />
              <p className="text-xs text-slate-400">{cameraError}</p>
            </div>
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-fuchsia-500 shadow-[0_0_12px_#d946ef] animate-pulse" />
            </>
          )}
        </div>

        <form onSubmit={handleManualSubmit} className="space-y-2">
          <label className="text-xs text-slate-400 block font-semibold">Manual Input / Barcode Gun</label>
          <div className="flex gap-2">
            <input
              type="text"
              autoFocus
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="Type code and hit enter..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-fuchsia-500"
            />
            <button type="submit" className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold px-4 rounded-xl transition shadow-md shadow-fuchsia-600/30">
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ==========================================
// 6. NEW UTANG ENTRY MODAL COMPONENT
// ==========================================
function AddUtangModal({ isOpen, onClose, onSave, cartItems, subtotal }) {
  const [customerName, setCustomerName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!customerName.trim()) return;
    onSave({
      customerName: customerName.trim(),
      contactNumber: contactNumber.trim(),
      notes: notes.trim(),
      amount: subtotal,
      items: cartItems,
      status: 'utang',
      created_at: new Date().toISOString()
    });
    setCustomerName('');
    setContactNumber('');
    setNotes('');
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-amber-400" />
            <h3 className="font-bold text-white text-sm">Record Credit (Utang) Transaction</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 font-semibold block mb-1">Customer Name *</label>
            <input
              required
              type="text"
              placeholder="e.g. Aling Nena"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 font-semibold block mb-1">Contact Number (Optional)</label>
            <input
              type="text"
              placeholder="09123456789"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 font-semibold block mb-1">Notes / Terms</label>
            <textarea
              rows={2}
              placeholder="e.g. Promise to pay next Friday..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex justify-between items-center">
            <span className="text-xs text-slate-400 font-semibold">Total Credit Amount:</span>
            <span className="font-mono text-amber-400 font-extrabold text-base">₱{subtotal.toFixed(2)}</span>
          </div>

          <button
            type="submit"
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-2xl text-xs uppercase tracking-wider transition shadow-lg shadow-amber-600/30"
          >
            Save to Utang Ledger
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ==========================================
// 7. MAIN INAKI POS APPLICATION
// ==========================================
export default function InakiPOS() {
  // App Navigation & Configuration
  const [activeTab, setActiveTab] = useState('pos');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  // Data Collections
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [heldCarts, setHeldCarts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [utangLedger, setUtangLedger] = useState([]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [inventorySearch, setInventorySearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [utangFilter, setUtangFilter] = useState('all');
  const [analyticsRange, setAnalyticsRange] = useState('all');

  // Transaction Inputs
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashTendered, setCashTendered] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [extraFee, setExtraFee] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [gcashRefNumber, setGcashRefNumber] = useState('');

  // Modal Views
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isUtangModalOpen, setIsUtangModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({ name: '', category: 'General', barcode: '', costPrice: 0, price: 0, stock: 0 });

  // Camera & Export Modals
  const [isPosCameraOpen, setIsPosCameraOpen] = useState(false);
  const [isProductCameraOpen, setIsProductCameraOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportTab, setExportTab] = useState('sales');
  const [exportEmail, setExportEmail] = useState('admin@inakistore.ph');

  // Hardware Status
  const [btStatus, setBtStatus] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);

  // --- INITIAL SUPABASE FETCH & LISTENERS ---
  useEffect(() => {
    fetchProducts();
    fetchTransactions();
    fetchUtangLedger();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('products').select('*').order('name');
    if (!error && data) setProducts(data);
  };

  const fetchTransactions = async () => {
    const { data, error } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });
    if (!error && data) setTransactions(data);
  };

  const fetchUtangLedger = async () => {
    const { data, error } = await supabase.from('utang_ledger').select('*').order('created_at', { ascending: false });
    if (!error && data) setUtangLedger(data);
  };

  // --- CART OPERATIONS ---
  const addToCart = (product) => {
    playAudioFeedback('beep', settings.soundEnabled);
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

  const updateCartQty = (id, delta) => {
    playAudioFeedback('beep', settings.soundEnabled);
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => setCart([]);

  // --- ORDER PARKING (HELD CARTS) ---
  const holdCurrentCart = () => {
    if (cart.length === 0) return;
    const heldOrder = {
      id: `HOLD-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      items: cart
    };
    setHeldCarts((prev) => [...prev, heldOrder]);
    clearCart();
    playAudioFeedback('success', settings.soundEnabled);
  };

  const restoreHeldCart = (heldId) => {
    const orderToRestore = heldCarts.find((h) => h.id === heldId);
    if (orderToRestore) {
      setCart(orderToRestore.items);
      setHeldCarts((prev) => prev.filter((h) => h.id !== heldId));
      playAudioFeedback('beep', settings.soundEnabled);
    }
  };

  // --- CALCULATIONS & MEMOIZED LISTS ---
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const netTotal = useMemo(() => Math.max(0, subtotal - discount + Number(extraFee) + Number(deliveryFee)), [subtotal, discount, extraFee, deliveryFee]);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category || 'General'));
    return ['all', ...Array.from(set)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(q) || String(p.barcode || '').includes(q);
      const matchesCategory = selectedCategory === 'all' || (p.category || 'General') === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const filteredInventory = useMemo(() => {
    const q = inventorySearch.toLowerCase().trim();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || String(p.barcode || '').includes(q));
  }, [products, inventorySearch]);

  const filteredTransactions = useMemo(() => {
    if (analyticsRange === 'today') {
      const todayStr = new Date().toISOString().slice(0, 10);
      return transactions.filter((t) => t.created_at && t.created_at.startsWith(todayStr));
    }
    return transactions;
  }, [transactions, analyticsRange]);

  const totalRevenue = useMemo(() => filteredTransactions.reduce((acc, t) => acc + Number(t.netSales || 0), 0), [filteredTransactions]);
  const totalGCash = useMemo(() => filteredTransactions.filter((t) => t.paymentMethod === 'gcash').reduce((acc, t) => acc + Number(t.netSales || 0), 0), [filteredTransactions]);
  const totalCash = useMemo(() => filteredTransactions.filter((t) => t.paymentMethod === 'cash').reduce((acc, t) => acc + Number(t.netSales || 0), 0), [filteredTransactions]);
  const estimatedProfit = useMemo(() => filteredTransactions.reduce((acc, t) => acc + (Number(t.netSales || 0) - Number(t.totalCost || 0)), 0), [filteredTransactions]);

  // --- CHECKOUT & TRANSACTION LOGIC ---
  const handleCompleteTransaction = async () => {
    if (cart.length === 0) return;

    const transactionId = `TX-${Date.now().toString().slice(-6)}`;
    const calculatedTotalCost = cart.reduce((sum, item) => sum + (Number(item.costPrice) || 0) * item.quantity, 0);
    const calculatedChange = paymentMethod === 'cash' ? Math.max(0, cashTendered - netTotal) : 0;

    const newTxPayload = {
      id: transactionId,
      items: cart,
      subtotal,
      discount: Number(discount),
      extraFee: Number(extraFee),
      deliveryFee: Number(deliveryFee),
      netSales: netTotal,
      totalCost: calculatedTotalCost,
      paymentMethod,
      cashTendered: paymentMethod === 'cash' ? Number(cashTendered) : 0,
      change: calculatedChange,
      gcashRefNumber: paymentMethod === 'gcash' ? gcashRefNumber : '',
      created_at: new Date().toISOString()
    };

    // Save to Supabase
    const { error: txError } = await supabase.from('transactions').insert([newTxPayload]);
    if (txError) {
      alert(`Transaction save failed: ${txError.message}`);
      playAudioFeedback('error', settings.soundEnabled);
      return;
    }

    // Deduct stock levels in Supabase
    for (const item of cart) {
      const newStock = Math.max(0, (item.stock || 0) - item.quantity);
      await supabase.from('products').update({ stock: newStock }).eq('id', item.id);
    }

    playAudioFeedback('success', settings.soundEnabled);
    setReceiptData(newTxPayload);
    setIsPaymentModalOpen(false);
    clearCart();
    setCashTendered(0);
    setDiscount(0);
    setExtraFee(0);
    setDeliveryFee(0);
    setGcashRefNumber('');
    fetchProducts();
    fetchTransactions();
  };

  // --- UTANG RECORD LOGIC ---
  const handleSaveUtang = async (utangData) => {
    const { error } = await supabase.from('utang_ledger').insert([utangData]);
    if (error) {
      alert(`Failed to log utang: ${error.message}`);
      playAudioFeedback('error', settings.soundEnabled);
      return;
    }

    // Deduct stock for utang items
    for (const item of cart) {
      const newStock = Math.max(0, (item.stock || 0) - item.quantity);
      await supabase.from('products').update({ stock: newStock }).eq('id', item.id);
    }

    playAudioFeedback('success', settings.soundEnabled);
    clearCart();
    fetchProducts();
    fetchUtangLedger();
  };

  // --- PRODUCT MANAGEMENT ---
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (editingProduct) {
      const { error } = await supabase.from('products').update(productForm).eq('id', editingProduct.id);
      if (error) alert(`Update failed: ${error.message}`);
    } else {
      const { error } = await supabase.from('products').insert([productForm]);
      if (error) alert(`Insert failed: ${error.message}`);
    }
    setIsProductModalOpen(false);
    setEditingProduct(null);
    setProductForm({ name: '', category: 'General', barcode: '', costPrice: 0, price: 0, stock: 0 });
    fetchProducts();
  };

  const handleDeleteProduct = async (id) => {
    if (window.confirm('Delete this product permanently from database?')) {
      await supabase.from('products').delete().eq('id', id);
      fetchProducts();
    }
  };

  // --- THERMAL BLUETOOTH PRINTING ---
  const handleBluetoothPrint = async (receipt) => {
    if (!navigator.bluetooth) {
      alert('Web Bluetooth API not supported on this device/browser.');
      return;
    }

    try {
      setIsPrinting(true);
      setBtStatus('Searching for printer...');

      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '00001101-0000-1000-8000-00805f9b34fb', 0xFF00]
      });

      setBtStatus('Connecting to GATT server...');
      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices();

      if (services.length === 0) throw new Error('No GATT services found.');

      const characteristics = await services[0].getCharacteristics();
      const writeChar = characteristics.find((c) => c.properties.write || c.properties.writeWithoutResponse);

      if (!writeChar) throw new Error('No writeable characteristic found.');

      setBtStatus('Sending printable buffer...');
      const buffer = buildThermalReceiptBuffer(receipt, settings);
      await writeChar.writeValue(buffer);

      setBtStatus('Print Complete!');
      playAudioFeedback('success', settings.soundEnabled);
      setTimeout(() => setBtStatus(''), 3000);
    } catch (err) {
      console.error(err);
      setBtStatus(`BT Error: ${err.message}`);
      playAudioFeedback('error', settings.soundEnabled);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col antialiased selection:bg-fuchsia-500 selection:text-white">
      {/* --- HEADER NAVBAR --- */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 px-4 py-3 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-fuchsia-600 to-indigo-600 w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white text-xl shadow-lg shadow-fuchsia-600/30">
            I
          </div>
          <div>
            <h1 className="font-extrabold text-white text-base tracking-wide leading-none">{settings.storeName}</h1>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Sari-Sari Store POS System</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800/80">
          {[
            { id: 'pos', label: 'POS', icon: ShoppingCart },
            { id: 'inventory', label: 'Stock', icon: Package },
            { id: 'analytics', label: 'Sales', icon: BarChart3 },
            { id: 'utang', label: 'Utang', icon: BookOpen },
            { id: 'settings', label: 'Config', icon: Settings }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-fuchsia-600 text-white shadow-md shadow-fuchsia-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Icon size={15} />
                <span className="hidden md:inline">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {/* --- MAIN PAGE CONTENT --- */}
      <main className="flex-1 p-4 max-w-7xl w-full mx-auto overflow-x-hidden">
        {/* ==========================================
            TAB 1: POS SYSTEM VIEW
        ========================================== */}
        {activeTab === 'pos' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left Product Catalog */}
            <div className="lg:col-span-2 space-y-3">
              {/* Search Bar & Barcode Scanner */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-3 text-slate-500" size={16} />
                  <input
                    type="text"
                    placeholder="Search product name or scan barcode..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 transition"
                  />
                </div>
                <button
                  onClick={() => setIsPosCameraOpen(true)}
                  className="bg-slate-900 border border-slate-800 hover:border-fuchsia-500 text-fuchsia-400 px-4 rounded-2xl flex items-center justify-center transition shadow-lg"
                >
                  <Camera size={18} />
                </button>
              </div>

              {/* Category Filter Pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold capitalize whitespace-nowrap transition ${
                      selectedCategory === cat
                        ? 'bg-fuchsia-600/20 text-fuchsia-400 border border-fuchsia-500/30'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Product Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="bg-slate-900 border border-slate-800/80 hover:border-fuchsia-500/50 p-3.5 rounded-2xl text-left flex flex-col justify-between transition group hover:shadow-lg hover:shadow-fuchsia-500/5 relative overflow-hidden"
                  >
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">{product.category || 'General'}</span>
                      <p className="font-bold text-slate-200 text-xs group-hover:text-fuchsia-400 line-clamp-2 leading-snug">{product.name}</p>
                    </div>
                    <div className="mt-3 flex justify-between items-end border-t border-slate-800/60 pt-2">
                      <span className="font-extrabold text-fuchsia-400 text-sm font-mono">₱{Number(product.price).toFixed(2)}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md font-mono ${product.stock > 5 ? 'bg-slate-800 text-slate-400' : 'bg-red-500/10 text-red-400'}`}>
                        {product.stock} left
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right Cart Sidebar */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 flex flex-col h-[calc(100vh-7rem)] sticky top-20 shadow-2xl">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <ShoppingCart size={18} className="text-fuchsia-400" />
                  <h2 className="font-bold text-white text-sm">Cart Order</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={holdCurrentCart} disabled={cart.length === 0} className="text-xs text-amber-400 hover:text-amber-300 font-semibold disabled:opacity-40 transition">Hold</button>
                  <button onClick={clearCart} className="text-xs text-red-400 hover:text-red-300 font-semibold transition">Clear</button>
                </div>
              </div>

              {/* Held Carts Notification Drawer */}
              {heldCarts.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-2 my-2 space-y-1">
                  <p className="text-[10px] font-bold text-amber-400 uppercase">Held Orders ({heldCarts.length})</p>
                  <div className="flex gap-1.5 overflow-x-auto">
                    {heldCarts.map((h) => (
                      <button
                        key={h.id}
                        onClick={() => restoreHeldCart(h.id)}
                        className="bg-slate-900 border border-slate-800 text-amber-300 text-[10px] font-mono font-bold px-2 py-1 rounded-xl whitespace-nowrap hover:bg-slate-800"
                      >
                        Restore {h.id}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Cart List */}
              <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2">
                    <ShoppingCart size={32} strokeWidth={1.5} />
                    <p className="text-xs font-semibold">Cart is currently empty</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.id} className="bg-slate-950 border border-slate-800/80 p-2.5 rounded-2xl flex justify-between items-center">
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-xs font-bold text-slate-200 truncate">{item.name}</p>
                        <p className="text-[10px] text-fuchsia-400 font-mono font-semibold">₱{item.price.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl">
                          <button onClick={() => updateCartQty(item.id, -1)} className="px-2 py-0.5 text-slate-400 hover:text-white font-bold text-xs">-</button>
                          <span className="text-xs font-mono font-bold px-1">{item.quantity}</span>
                          <button onClick={() => updateCartQty(item.id, 1)} className="px-2 py-0.5 text-slate-400 hover:text-white font-bold text-xs">+</button>
                        </div>
                        <button onClick={() => removeFromCart(item.id)} className="text-slate-500 hover:text-red-400 transition"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Cart Totals & Checkout Trigger */}
              <div className="border-t border-slate-800 pt-3 space-y-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Subtotal:</span>
                  <span className="font-mono">₱{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-black text-white">
                  <span>NET TOTAL:</span>
                  <span className="font-mono text-fuchsia-400 text-lg">₱{netTotal.toFixed(2)}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    disabled={cart.length === 0}
                    onClick={() => setIsUtangModalOpen(true)}
                    className="bg-amber-600/20 border border-amber-500/30 text-amber-400 hover:bg-amber-600/30 disabled:opacity-40 font-bold py-3 rounded-2xl text-xs uppercase tracking-wider transition"
                  >
                    Utang
                  </button>
                  <button
                    disabled={cart.length === 0}
                    onClick={() => setIsPaymentModalOpen(true)}
                    className="bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 text-white font-bold py-3 rounded-2xl text-xs uppercase tracking-wider transition shadow-lg shadow-fuchsia-600/30"
                  >
                    Pay Cash / GCash
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 2: INVENTORY STOCK MANAGEMENT
        ========================================== */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center gap-2">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3.5 top-3 text-slate-500" size={16} />
                <input
                  type="text"
                  placeholder="Filter inventory items..."
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-fuchsia-500"
                />
              </div>
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setProductForm({ name: '', category: 'General', barcode: '', costPrice: 0, price: 0, stock: 0 });
                  setIsProductModalOpen(true);
                }}
                className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold px-4 py-2 rounded-2xl text-xs flex items-center gap-1.5 transition shadow-lg shadow-fuchsia-600/20"
              >
                <Plus size={16} /> Add Product
              </button>
            </div>

            {/* Inventory Data Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase bg-slate-950/50">
                    <th className="p-3.5">Item Name</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Barcode</th>
                    <th className="p-3.5">Cost</th>
                    <th className="p-3.5">Selling</th>
                    <th className="p-3.5">Stock</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-xs">
                  {filteredInventory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3.5 font-bold text-slate-200">{item.name}</td>
                      <td className="p-3.5 text-slate-400">{item.category || 'General'}</td>
                      <td className="p-3.5 font-mono text-slate-400">{item.barcode || '—'}</td>
                      <td className="p-3.5 font-mono text-emerald-400">₱{Number(item.costPrice || 0).toFixed(2)}</td>
                      <td className="p-3.5 font-mono text-amber-400 font-bold">₱{Number(item.price || 0).toFixed(2)}</td>
                      <td className="p-3.5 font-mono">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${item.stock > 5 ? 'bg-slate-800 text-slate-300' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                          {item.stock} left
                        </span>
                      </td>
                      <td className="p-3.5 text-right space-x-2">
                        <button
                          onClick={() => {
                            setEditingProduct(item);
                            setProductForm(item);
                            setIsProductModalOpen(true);
                          }}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(item.id)}
                          className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition"
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

        {/* ==========================================
            TAB 3: SALES & ANALYTICS
        ========================================== */}
        {activeTab === 'analytics' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Sales & Financial Performance</h2>
                <select
                  value={analyticsRange}
                  onChange={(e) => setAnalyticsRange(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 px-3 py-1 font-semibold focus:outline-none"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today Only</option>
                </select>
              </div>
              <button
                onClick={() => setIsExportModalOpen(true)}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold px-3.5 py-2 rounded-2xl flex items-center gap-1.5 text-slate-300"
              >
                <Mail size={14} /> Export Report
              </button>
            </div>

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl space-y-1">
                <p className="text-[10px] font-bold uppercase text-slate-400">Total Revenue</p>
                <p className="text-xl font-extrabold font-mono text-emerald-400">₱{totalRevenue.toFixed(2)}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl space-y-1">
                <p className="text-[10px] font-bold uppercase text-slate-400">Cash Collections</p>
                <p className="text-xl font-extrabold font-mono text-amber-400">₱{totalCash.toFixed(2)}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl space-y-1">
                <p className="text-[10px] font-bold uppercase text-slate-400">GCash Sales</p>
                <p className="text-xl font-extrabold font-mono text-blue-400">₱{totalGCash.toFixed(2)}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl space-y-1">
                <p className="text-[10px] font-bold uppercase text-slate-400">Est. Net Profit</p>
                <p className="text-xl font-extrabold font-mono text-fuchsia-400">₱{estimatedProfit.toFixed(2)}</p>
              </div>
            </div>

            {/* Complete Transaction Table Log */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden p-4 shadow-2xl space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">Transaction History Log</h3>
                <button
                  onClick={() => exportToCSV(filteredTransactions, 'Inaki_Transactions')}
                  className="text-xs text-fuchsia-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <Download size={12} /> CSV Download
                </button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredTransactions.map((tx) => (
                  <div key={tx.id} className="bg-slate-950 border border-slate-800/80 p-3 rounded-2xl flex justify-between items-center text-xs">
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-200 font-mono">{tx.id}</span>
                      <p className="text-[10px] text-slate-500">{new Date(tx.created_at).toLocaleString('en-PH')}</p>
                    </div>
                    <div className="text-right space-y-0.5">
                      <p className="font-bold font-mono text-fuchsia-400">₱{Number(tx.netSales || 0).toFixed(2)}</p>
                      <p className="text-[10px] uppercase font-semibold text-slate-400">{tx.paymentMethod}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 4: UTANG LEDGER
        ========================================== */}
        {activeTab === 'utang' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-bold text-white">Customer Credit (Utang) Records</h2>
              <div className="flex gap-1 bg-slate-900 p-1 rounded-2xl border border-slate-800">
                {['all', 'utang', 'paid'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setUtangFilter(f)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold uppercase ${utangFilter === f ? 'bg-amber-600 text-white' : 'text-slate-400'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {utangLedger
                .filter((u) => utangFilter === 'all' || u.status === utangFilter)
                .map((u) => (
                  <div key={u.id} className="bg-slate-900 border border-slate-800 p-4 rounded-3xl space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-slate-100 text-sm">{u.customerName}</p>
                        <p className="text-[10px] text-slate-500">{u.contactNumber || 'No Phone Number'}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{new Date(u.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${u.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                        {u.status}
                      </span>
                    </div>

                    {u.notes && <p className="text-xs text-slate-400 italic bg-slate-950 p-2 rounded-xl">"{u.notes}"</p>}

                    <div className="flex justify-between items-end pt-2 border-t border-slate-800">
                      <span className="font-mono font-bold text-amber-400 text-base">₱{Number(u.amount).toFixed(2)}</span>
                      {u.status === 'utang' && (
                        <button
                          onClick={async () => {
                            await supabase.from('utang_ledger').update({ status: 'paid' }).eq('id', u.id);
                            playAudioFeedback('success', settings.soundEnabled);
                            fetchUtangLedger();
                          }}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl transition"
                        >
                          Mark as Paid
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 5: SYSTEM CONFIGURATION
        ========================================== */}
        {activeTab === 'settings' && (
          <div className="max-w-xl mx-auto space-y-4">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4 shadow-2xl">
              <h2 className="text-sm font-bold text-white border-b border-slate-800 pb-3">Store & Thermal Receipt Setup</h2>
              
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Store Name</label>
                  <input
                    type="text"
                    value={settings.storeName}
                    onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Store Address</label>
                  <input
                    type="text"
                    value={settings.storeAddress}
                    onChange={(e) => setSettings({ ...settings, storeAddress: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">Paper Width</label>
                    <select
                      value={settings.paperWidth}
                      onChange={(e) => setSettings({ ...settings, paperWidth: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
                    >
                      <option value="58mm">58mm Thermal</option>
                      <option value="80mm">80mm Thermal</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 font-semibold block mb-1">Audio Feedback</label>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, soundEnabled: !settings.soundEnabled })}
                      className={`w-full py-2 rounded-xl font-bold flex items-center justify-center gap-2 ${
                        settings.soundEnabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {settings.soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                      {settings.soundEnabled ? 'Enabled' : 'Muted'}
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => handleBluetoothPrint({ id: 'TEST-DRAWER', created_at: new Date().toISOString(), items: [], netSales: 0, paymentMethod: 'cash' })}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3 rounded-2xl flex items-center justify-center gap-2 border border-slate-700 transition mt-2"
                >
                  <Bluetooth size={16} /> Test ESC/POS Cashbox Pulse
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ==========================================
          MODAL 1: CHECKOUT / PAYMENT MODAL
      ========================================== */}
      {isPaymentModalOpen &&
        createPortal(
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white">Process Payment</h3>
                  <p className="text-xs text-slate-400">Select payment method and enter transaction detail</p>
                </div>
                <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition">✕</button>
              </div>

              {/* Discount / Fees adjustments */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    const d = prompt('Enter discount (₱):', discount.toString());
                    if (d !== null) setDiscount(Number(d) || 0);
                  }}
                  className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 py-2 rounded-xl text-xs font-semibold transition"
                >
                  Disc: ₱{discount}
                </button>
                <button
                  onClick={() => {
                    const f = prompt('Enter extra fee (₱):', extraFee.toString());
                    if (f !== null) setExtraFee(Number(f) || 0);
                  }}
                  className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 py-2 rounded-xl text-xs font-semibold transition"
                >
                  Fee: ₱{extraFee}
                </button>
                <button
                  onClick={() => {
                    const del = prompt('Enter delivery fee (₱):', deliveryFee.toString());
                    if (del !== null) setDeliveryFee(Number(del) || 0);
                  }}
                  className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 py-2 rounded-xl text-xs font-semibold transition"
                >
                  Delivery: ₱{deliveryFee}
                </button>
              </div>

              {/* Payment Selector */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`py-3 rounded-2xl font-bold text-xs uppercase flex items-center justify-center gap-2 transition border ${
                    paymentMethod === 'cash' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  💵 Cash
                </button>
                <button
                  onClick={() => setPaymentMethod('gcash')}
                  className={`py-3 rounded-2xl font-bold text-xs uppercase flex items-center justify-center gap-2 transition border ${
                    paymentMethod === 'gcash' ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  💳 GCash
                </button>
              </div>

              {/* Input section conditionally rendered */}
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
                  {/* Quick Cash Buttons */}
                  <div className="flex gap-2 pt-1">
                    {[netTotal, 100, 200, 500, 1000].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setCashTendered(amt)}
                        className="flex-1 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white py-1 rounded-lg text-[10px] font-mono font-bold"
                      >
                        ₱{amt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <label className="text-xs text-slate-400 block font-semibold">GCash Reference Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 53462828644"
                    value={gcashRefNumber}
                    onChange={(e) => setGcashRefNumber(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-blue-400 font-mono font-bold text-base focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {/* Order Net Summary */}
              <div className="border-t border-slate-800 pt-3 space-y-1 text-xs">
                <div className="flex justify-between text-slate-400"><span>Subtotal</span><span className="font-mono">₱{subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-base font-black">
                  <span className="text-white">NET TOTAL</span>
                  <span className="font-mono text-fuchsia-400 text-xl">₱{netTotal.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handleCompleteTransaction}
                disabled={paymentMethod === 'cash' && cashTendered < netTotal}
                className={`w-full py-4 rounded-2xl font-bold text-xs uppercase tracking-wider transition ${
                  paymentMethod === 'cash' && cashTendered < netTotal
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                }`}
              >
                Confirm Transaction
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* ==========================================
          MODAL 2: RECEIPT VIEW WITH CASH & GCASH
      ========================================== */}
      {receiptData && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:p-0 print:bg-white print:static print:block overflow-y-auto">
          <style>{`
            @media print {
              @page { size: ${settings.paperWidth} auto; margin: 0mm !important; }
              html, body { width: ${settings.paperWidth} !important; margin: 0 !important; padding: 0 !important; background: #ffffff !important; color: #000000 !important; }
              body * { visibility: hidden; }
              #printable-receipt, #printable-receipt * { visibility: visible !important; color: #000000 !important; }
              #printable-receipt { position: absolute !important; left: 0 !important; top: 0 !important; width: ${settings.paperWidth} !important; max-width: ${settings.paperWidth} !important; padding: 2mm !important; margin: 0 !important; background: #ffffff !important; }
              .print-hide { display: none !important; }
            }
          `}</style>

          <div id="printable-receipt" className="bg-white text-black p-4 rounded-2xl w-full max-w-[280px] shadow-2xl font-mono text-[11px] leading-tight print:shadow-none print:w-[58mm] print:max-w-[58mm] print:rounded-none print:p-0 mx-auto">
            <div className="text-center pb-2 border-b border-dashed border-gray-400 space-y-0.5">
              <h2 className="font-extrabold text-xs tracking-wider uppercase">{settings.storeName}</h2>
              <p className="text-[9px] text-gray-600">{new Date(receiptData.created_at || receiptData.timestamp).toLocaleString('en-PH')}</p>
              <p className="text-[9px] font-bold">Receipt #: {receiptData.id}</p>
            </div>

            <div className="py-2 border-b border-dashed border-gray-400 space-y-1">
              {receiptData.items.map((item) => (
                <div key={item.id} className="flex justify-between items-start">
                  <div className="pr-1 min-w-0 flex-1">
                    <p className="font-semibold truncate text-[10px]">{item.name}</p>
                    <p className="text-[9px] text-gray-600">{item.quantity} x P{Number(item.price).toFixed(2)}</p>
                  </div>
                  <span className="font-bold whitespace-nowrap text-[10px]">P{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Financial Breakdown */}
            <div className="py-2 border-b border-dashed border-gray-400 space-y-0.5 text-[10px]">
              <div className="flex justify-between font-bold text-xs pt-0.5">
                <span>TOTAL:</span>
                <span>P{Number(receiptData.netSales).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-800 uppercase pt-0.5 text-[9px]">
                <span>PAYMENT METHOD:</span>
                <span className="font-bold">{receiptData.paymentMethod}</span>
              </div>

              {receiptData.paymentMethod === 'cash' && (
                <>
                  <div className="flex justify-between text-gray-800 text-[9px] pt-0.5">
                    <span>CASH TENDERED:</span>
                    <span className="font-bold">P{(receiptData.cashTendered || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-800 text-[9px]">
                    <span>CHANGE:</span>
                    <span className="font-bold">P{(receiptData.change ?? Math.max(0, (receiptData.cashTendered || 0) - receiptData.netSales)).toFixed(2)}</span>
                  </div>
                </>
              )}

              {(receiptData.paymentMethod === 'gcash' || receiptData.gcashRefNumber) && (
                <div className="flex justify-between text-gray-800 text-[9px] pt-0.5">
                  <span>GCASH REF #:</span>
                  <span className="font-bold">{receiptData.gcashRefNumber || 'N/A'}</span>
                </div>
              )}
            </div>

            <div className="pt-2 text-center text-[9px] space-y-0.5">
              <p className="font-bold uppercase tracking-wider">{settings.receiptFooter}</p>
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
                <Bluetooth size={14} /> BT Thermal Print
              </button>

              <div className="flex items-center justify-center gap-2">
                <button onClick={() => window.print()} className="flex-1 bg-slate-800 text-slate-200 font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5"><Printer size={14} /> Web Print</button>
                <button onClick={() => setReceiptData(null)} className="flex-1 bg-slate-800 text-slate-300 font-bold text-xs py-2 rounded-xl">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 3: ADD / EDIT PRODUCT MODAL
      ========================================== */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-100 text-base">
                {editingProduct ? 'Edit Inventory Item' : 'Add New Inventory Item'}
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
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-fuchsia-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Category</label>
                <input
                  type="text"
                  placeholder="e.g. Beverages, Snacks..."
                  value={productForm.category || ''}
                  onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-fuchsia-500"
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
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-fuchsia-500"
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
                {editingProduct ? 'Save Changes' : 'Save Item to Database'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 4: RECORD CREDIT (UTANG) MODAL
      ========================================== */}
      <AddUtangModal
        isOpen={isUtangModalOpen}
        onClose={() => setIsUtangModalOpen(false)}
        onSave={handleSaveUtang}
        cartItems={cart}
        subtotal={netTotal}
      />

      {/* ==========================================
          MODAL 5: CAMERA SCANNER MODALS
      ========================================== */}
      <CameraScanner
        isOpen={isPosCameraOpen}
        soundEnabled={settings.soundEnabled}
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
            alert(`No match found for barcode: ${cleanCode}`);
          }
          setIsPosCameraOpen(false);
        }}
      />

      <CameraScanner
        isOpen={isProductCameraOpen}
        soundEnabled={settings.soundEnabled}
        onClose={() => setIsProductCameraOpen(false)}
        onScan={(scannedBarcode) => {
          setProductForm((prev) => ({ ...prev, barcode: String(scannedBarcode).trim() }));
          setIsProductCameraOpen(false);
        }}
      />

      {/* ==========================================
          MODAL 6: REPORT EXPORT MODAL
      ========================================== */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <button onClick={() => setIsExportModalOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-white"><X size={18} /></button>
            <h3 className="text-base font-bold text-slate-100 mb-4">Export Report Data</h3>

            <div className="flex border-b border-slate-800 mb-4 text-xs font-bold">
              {['sales', 'inventory', 'utang'].map((tab) => (
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
                <label className="text-xs font-semibold text-slate-400 block mb-1">Email Recipient</label>
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

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => {
                    const dataToExport = exportTab === 'sales' ? transactions : exportTab === 'inventory' ? products : utangLedger;
                    exportToCSV(dataToExport, `Inaki_${exportTab}`);
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition border border-slate-700 flex items-center justify-center gap-1.5"
                >
                  <Download size={14} /> Save CSV
                </button>
                <button
                  onClick={() => {
                    alert(`Report (${exportTab.toUpperCase()}) successfully emailed to ${exportEmail}!`);
                    setIsExportModalOpen(false);
                  }}
                  className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition shadow-md shadow-fuchsia-600/30"
                >
                  Send Email
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}