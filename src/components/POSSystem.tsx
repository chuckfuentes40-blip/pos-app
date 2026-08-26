'use client';
import React, { useState, useEffect, useRef, useCallback, useMemo, } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@supabase/supabase-js';
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
  RefreshCw,
  Printer,
  Wifi,
  CreditCard,
  Edit,
  Bluetooth,
  Unlock,
  Wallet,
} from 'lucide-react';

// --- SUPABASE CLIENT INITIALIZATION ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  
  // Database lowercase aliases & alternative property names
  netsales?: number;
  paymentmethod?: string;
  cashreceived?: number;
  changedue?: number;
  cashTendered?: number;
  change?: number;
  gcashrefnumber?: string;

  // Catch-all index signature for dynamic property checks
  [key: string]: any;
}

const buildEscPosReceiptBuffer = (receipt: any, triggerCashbox: boolean = true): Uint8Array => {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];

  const addBytes = (bytes: number[]) => chunks.push(new Uint8Array(bytes));
  const addText = (text: string) => chunks.push(encoder.encode(text));

  // Extract properties safely across camelCase and lowercase DB fields
  const paymentMethod = String(receipt.paymentMethod || receipt.paymentmethod || '').toLowerCase();
  const netSales = Number(receipt.netSales ?? receipt.netsales ?? 0);
  const cashReceived = Number(receipt.cashReceived ?? receipt.cashreceived ?? receipt.cashTendered ?? 0);
  const changeDue = Number(receipt.changeDue ?? receipt.changedue ?? receipt.change ?? 0);
  const gcashRef = receipt.gcashRefNumber || receipt.gcashrefnumber;

  // 1. Reset / Initialize Printer (ESC @)
  addBytes([0x1b, 0x40]);

  // 2. Header (Centered, Bold)
  addBytes([0x1b, 0x61, 0x01]); // Center
  addBytes([0x1b, 0x45, 0x01]); // Bold ON
  addText("IÑAKI STORE\n");
  addBytes([0x1b, 0x45, 0x00]); // Bold OFF
  addText(`${new Date(receipt.timestamp).toLocaleString('en-PH')}\n`);
  addText(`Receipt #: ${receipt.id}\n`);
  addText("--------------------------------\n");

  // 3. Item List (Left Aligned)
  addBytes([0x1b, 0x61, 0x00]); // Left
  receipt.items?.forEach((item: any) => {
    addText(`${item.name}\n`);
    const line = `  ${item.quantity} x P${item.price.toFixed(2)}`.padEnd(22) + `P${(item.price * item.quantity).toFixed(2)}\n`;
    addText(line);
  });
  addText("--------------------------------\n");

  // 4. Totals & Payment Info
  addBytes([0x1b, 0x45, 0x01]);
  addText(`NET TOTAL: P${netSales.toFixed(2)}\n`);
  addBytes([0x1b, 0x45, 0x00]);
  addText(`Payment Method: ${paymentMethod.toUpperCase()}\n`);

  if (paymentMethod === 'cash' || cashReceived > 0) {
    addText(`Cash Tendered: P${cashReceived.toFixed(2)}\n`);
    addText(`Change Due: P${changeDue.toFixed(2)}\n`);
  }

  if (gcashRef) {
    addText(`GCash Ref: ${gcashRef}\n`);
  }

  // 5. Footer
  addBytes([0x1b, 0x61, 0x01]); // Center
  addText("\nMaraming Salamat Po!\nPlease Come Again\n\n\n");

  // 6. Cash Drawer Kick Command (ESC p m t1 t2)
  if (triggerCashbox) {
    addBytes([0x1b, 0x70, 0x00, 0x19, 0xfa]);
  }

  // 7. Paper Cut Command (GS V 0)
  addBytes([0x1d, 0x56, 0x00]);

  // Merge into single array
  const totalBytes = chunks.reduce((acc, curr) => acc + curr.length, 0);
  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
};

// --- ENHANCED HIGH-ACCURACY CAMERA SCANNER ---
interface CameraScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({ isOpen, onClose, onScan }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const isProcessingRef = useRef(false);

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
      // Request high resolution and environment-facing camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
      });

      streamRef.current = stream;

      // Apply continuous auto-focus hardware constraint if supported by device
      const track = stream.getVideoTracks()[0];
      if (track && 'applyConstraints' in track) {
        const capabilities = (track.getCapabilities?.() || {}) as any;
        if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
          await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] } as any).catch(() => {});
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        startFrameDetection();
      }
    } catch (err: any) {
      setCameraError('Camera access denied or high-res mode unavailable.');
    }
  };

  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startFrameDetection = async () => {
    if (!('BarcodeDetector' in window)) {
      return;
    }

    try {
      const barcodeDetector = new (window as any).BarcodeDetector({
        formats: ['code_128', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e', 'code_39'],
      });

      const processFrame = async () => {
        if (!videoRef.current || !streamRef.current || isProcessingRef.current) {
          animFrameRef.current = requestAnimationFrame(processFrame);
          return;
        }

        isProcessingRef.current = true;

        try {
          // Offscreen Canvas frame contrast enhancement
          const video = videoRef.current;
          let targetInput: HTMLVideoElement | HTMLCanvasElement = video;

          if (canvasRef.current && video.videoWidth > 0) {
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              // Contrast enhancement image filter
              ctx.filter = 'contrast(140%) grayscale(100%)';
              ctx.drawImage(canvas, 0, 0);
              targetInput = canvas;
            }
          }

          const barcodes = await barcodeDetector.detect(targetInput);
          if (barcodes.length > 0 && barcodes[0].rawValue) {
            if ('vibrate' in navigator) navigator.vibrate(100);
            onScan(barcodes[0].rawValue);
            stopCamera();
            return;
          }
        } catch (e) {
          // Frame pass
        } finally {
          isProcessingRef.current = false;
          animFrameRef.current = requestAnimationFrame(processFrame);
        }
      };

      animFrameRef.current = requestAnimationFrame(processFrame);
    } catch (e) {
      console.warn('Native BarcodeDetector initialization error:', e);
    }
  };




 
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
      <canvas ref={canvasRef} className="hidden" />
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-5 shadow-2xl space-y-4 relative">
        <div className="flex justify-between items-center pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-fuchsia-400" />
            <h3 className="font-bold text-sm text-slate-100">Scan Barcode (Auto-Focus)</h3>
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
              <div className="absolute inset-x-6 top-1/2 h-0.5 bg-rose-500 shadow-[0_0_10px_#f43f5e] animate-pulse" />
              <div className="absolute inset-8 border-2 border-fuchsia-500/60 rounded-2xl pointer-events-none shadow-[inset_0_0_15px_rgba(217,70,239,0.3)]" />
            </>
          )}
        </div>

        <div className="space-y-2 pt-2 border-t border-slate-800">
          <label className="text-[11px] text-slate-400 block">Or key barcode manually:</label>
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
  const [products, setProducts] = useState<Product[]>([]);
   // Calculate Total Capital Value of Current Inventory
  const totalCapital = useMemo(() => {
    return products.reduce((acc, product) => {
      const cost = Number(product.costPrice || 0);
      const stock = Number(product.stock || 0);
      return acc + cost * stock;
    }, 0);
  }, [products]);

  const [activeTab, setActiveTab] = useState<'pos' | 'inventory' | 'analytics' | 'ledger' | 'settings'>('pos');


  // Supabase Data States
  const [transactions, setTransactions] = useState<ReceiptData[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  // Cart & POS State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [posScanMethod, setPosScanMethod] = useState<ScanMethod>('hardware');

  // Payment & Financial Calculations
  const [discount, setDiscount] = useState<number>(0);
  const [extraFee, setExtraFee] = useState<number>(0);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [gcashRefNumber, setGcashRefNumber] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gcash'>('cash');
  const [customer, setCustomer] = useState<{ name?: string; phone?: string; address?: string; notes?: string }>({});

  // Modals & Controls
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPosCameraOpen, setIsPosCameraOpen] = useState(false);
  const [isProductCameraOpen, setIsProductCameraOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  // Bluetooth Printer State
  const [isPrinting, setIsPrinting] = useState(false);
  const [btStatus, setBtStatus] = useState<string>('');

  // Product Modal State
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

  // Export Analytics State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportTab, setExportTab] = useState<'sales' | 'movement' | 'capital'>('sales');
  const [exportEmail, setExportEmail] = useState('manager@inaki-store.ph');

  // Ledger State
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'utang' | 'paid'>('all');
  const [ledger, setLedger] = useState<LedgerEntry[]>([
    { id: 'l1', customerName: 'Juan Dela Cruz', phone: '09171234567', description: '2x SM Light, 1x Chips', amount: 155, status: 'unpaid' },
    { id: 'l2', customerName: 'Maria Santos', phone: '09189876543', description: 'Grocery items', amount: 320, status: 'paid' },
  ]);

      // Using 'async function' enables function hoisting across the entire component scope
  async function fetchProducts() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching products:', error);
      return;
    }

    if (data) {
      setProducts(
        data.map((item: any) => ({
          id: item.id,
          name: item.name,
          barcode: item.barcode || '',
          costPrice: Number(item.cost_price ?? item.costprice ?? item.cost ?? 0),
          price: Number(item.price ?? item.unit_price ?? 0),
          stock: Number(item.stock ?? 0),
        }))
      );
    }
  } catch (err) {
    console.error('Unexpected error fetching products:', err);
  }
}
        useEffect(() => {
      fetchProducts();

      // Subscribe to real-time changes on the `products` table
      const productsChannel = supabase
        .channel('products-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'products' },
          () => {
            // Automatically fetch updated list whenever Supabase database changes
            fetchProducts();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(productsChannel);
      };
    }, []);


    

  // Fetch Supabase data on mount
  useEffect(() => {
    fetchProducts();
    fetchTransactions();
  }, []);


  // Fetch Transactions from `transactions` table
  const fetchTransactions = async () => {
    setIsLoadingTransactions(true);
    try {
      const { data, error } = await supabase.from('transactions').select('*').order('timestamp', { ascending: false });
      if (error) {
        console.error('Error fetching transactions:', error);
      } else if (data) {
        const mappedData: ReceiptData[] = data.map((t: any) => ({
          id: t.id,
          timestamp: t.timestamp,
          items: t.items || [],
          subtotal: Number(t.subtotal || 0),
          discount: Number(t.discount || 0),
          serviceFee: Number(t.servicefee || 0),
          deliveryFee: Number(t.deliveryfee || 0),
          netSales: Number(t.netsales || 0),
          paymentMethod: t.paymentmethod,
          cashReceived: Number(t.cashreceived || 0),
          changeDue: Number(t.changedue || 0),
          gcashRefNumber: t.gcashrefnumber || '',
          customer: t.customer,
        }));
        setTransactions(mappedData);
      }
    } catch (err) {
      console.error('Error syncing transactions:', err);
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  // Financial Calculations
  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const netTotal = Math.max(0, subtotal - discount + extraFee + deliveryFee);

  // Analytics Dynamic Calculations
  const totalSales = transactions.reduce((acc, t) => acc + t.netSales, 0);
  const gcashTransactions = transactions.filter((t) => t.paymentMethod === 'gcash');
  const gcashTotalSales = gcashTransactions.reduce((acc, t) => acc + t.netSales, 0);
  const gcashCount = gcashTransactions.length;
  const estimatedProfit = transactions.reduce((acc, t) => {
    const totalCost = t.items.reduce((cAcc, item) => cAcc + (item.costPrice || 0) * item.quantity, 0);
    return acc + (t.netSales - totalCost);
  }, 0);

  // Cart Handlers
const addToCart = (product: Product) => {
  // 1. Block if base stock is zero or negative
  if (product.stock <= 0) return;

  setCart((prev) => {
    const existing = prev.find((item) => item.id === product.id);
    if (existing) {
      // 2. Prevent adding more than available stock
      if (existing.quantity >= product.stock) return prev;
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
          // 3. Cap incrementing beyond current item stock
          if (newQty > item.stock) return item; 
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

  // Product Database Actions (Supabase)
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

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      const { error } = await supabase
        .from('products')
        .update({
          name: productForm.name,
          barcode: productForm.barcode,
          price: productForm.price,
          cost: productForm.costPrice,
          stock: productForm.stock,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingProduct.id);

      if (error) {
        alert('Failed to update product in database.');
      } else {
        fetchProducts();
      }
    } else {
      const { error } = await supabase.from('products').insert([
        {
          name: productForm.name,
          barcode: productForm.barcode,
          price: productForm.price,
          cost: productForm.costPrice,
          stock: productForm.stock,
        },
      ]);

      if (error) {
        alert('Failed to add product to database.');
      } else {
        fetchProducts();
      }
    }
    setIsProductModalOpen(false);
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm('Are you sure you want to delete this product?')) {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) {
        alert('Failed to delete product.');
      } else {
        fetchProducts();
      }
    }
  };

  // Direct Bluetooth ESC/POS Print & Cashbox Trigger Handler
  const handleBluetoothPrint = async (receipt: ReceiptData) => {
    if (!('bluetooth' in navigator)) {
      alert('Web Bluetooth API is not supported in this browser/device.');
      return;
    }

    setIsPrinting(true);
    setBtStatus('Searching for printer...');

    try {
      // Standard ESC/POS printer Bluetooth service UUIDs
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', // Standard Thermal Printer Service
          '0000af00-0000-1000-8000-00805f9b34fb',
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        ],
      });

      setBtStatus('Connecting to printer...');
      const server = await device.gatt.connect();

      // Locate writable characteristic
      const services = await server.getPrimaryServices();
      let writeCharacteristic: any = null;

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
        throw new Error('No writable characteristic found on printer.');
      }

      setBtStatus('Printing & kicking cashbox...');
      const buffer = buildEscPosReceiptBuffer(receipt, true);

      // Write in chunks to prevent Bluetooth buffer overflow
      const chunkSize = 100;
      for (let i = 0; i < buffer.length; i += chunkSize) {
        const chunk = buffer.slice(i, i + chunkSize);
        if (writeCharacteristic.properties.writeWithoutResponse) {
          await writeCharacteristic.writeValueWithoutResponse(chunk);
        } else {
          await writeCharacteristic.writeValue(chunk);
        }
      }

      setBtStatus('Print successful! Cashbox unlocked.');
      setTimeout(() => {
        setBtStatus('');
        setIsPrinting(false);
      }, 2000);
    } catch (err: any) {
      console.error('Bluetooth Print Error:', err);
      setBtStatus('');
      setIsPrinting(false);
      alert(`Bluetooth print failed: ${err.message || err}`);
    }
  };

  // Direct Cashbox Open Trigger (Standalone)
  const handleKickCashbox = async () => {
    if (!('bluetooth' in navigator)) {
      alert('Web Bluetooth API is not supported.');
      return;
    }

    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'],
      });
      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices();
      let writeChar: any = null;

      for (const service of services) {
        const chars = await service.getCharacteristics();
        for (const c of chars) {
          if (c.properties.write || c.properties.writeWithoutResponse) {
            writeChar = c;
            break;
          }
        }
        if (writeChar) break;
      }

      if (writeChar) {
        // Pulse cashbox command: ESC p 0 25 250
        const pulse = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]);
        await writeChar.writeValue(pulse);
        alert('Cashbox pulse command sent!');
      }
    } catch (e: any) {
      alert(`Cashbox trigger error: ${e.message}`);
    }
  };

  // Complete & Persist Transaction
  const handleCompleteTransaction = async () => {
    const trxId = `TRX-${Math.floor(10000 + Math.random() * 90000)}`;
    const timestamp = new Date().toISOString();

    const receipt: ReceiptData = {
      id: trxId,
      timestamp,
      items: [...cart],
      subtotal,
      discount,
      serviceFee: extraFee,
      deliveryFee,
      netSales: netTotal,
      paymentMethod,
      cashReceived: paymentMethod === 'cash' ? cashTendered : undefined,
      changeDue: paymentMethod === 'cash' ? Math.max(0, cashTendered - netTotal) : undefined,
      gcashRefNumber: paymentMethod === 'gcash' ? gcashRefNumber : undefined,
      customer,
    };

    try {
      // 1. Insert transaction into `transactions` table
      const { error: trxError } = await supabase.from('transactions').insert([
        {
          id: trxId,
          timestamp,
          items: cart,
          subtotal,
          discount,
          servicefee: extraFee,
          deliveryfee: deliveryFee,
          netsales: netTotal,
          paymentmethod: paymentMethod,
          cashreceived: paymentMethod === 'cash' ? cashTendered : null,
          changedue: paymentMethod === 'cash' ? Math.max(0, cashTendered - netTotal) : null,
          gcashrefnumber: paymentMethod === 'gcash' ? gcashRefNumber : null,
          customer: customer.name ? customer : null,
        },
      ]);

      if (trxError) console.error('Failed transaction insert:', trxError);

      // 2. Insert into `sales` and `sale_items`
      const { data: salesData } = await supabase
        .from('sales')
        .insert([
          {
            total_amount: netTotal,
            payment_method: paymentMethod,
            customer_name: customer.name || 'Walk-in Customer',
            created_at: timestamp,
          },
        ])
        .select();

      if (salesData && salesData.length > 0) {
        const saleId = salesData[0].id;
        const saleItemsPayload = cart.map((item) => ({
          sale_id: saleId,
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
        }));
        await supabase.from('sale_items').insert(saleItemsPayload);
      }

      // 3. Deduct Stock & Write to `inventory_ledger`
      for (const item of cart) {
        const newStock = Math.max(0, item.stock - item.quantity);
        await supabase.from('products').update({ stock: newStock }).eq('id', item.id);

        await supabase.from('inventory_ledger').insert([
          {
            product_id: item.id,
            change_qty: -item.quantity,
            reason: `POS Sale (${trxId})`,
            created_at: timestamp,
          },
        ]);
      }

      fetchProducts();
      fetchTransactions();
    } catch (err) {
      console.error('Supabase persistence error:', err);
    }

    setReceiptData(receipt);
    setCart([]);
    setDiscount(0);
    setExtraFee(0);
    setDeliveryFee(0);
    setCashTendered(0);
    setGcashRefNumber('');
    setCustomer({});
    setIsPaymentModalOpen(false);
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchQuery))
  );

  const parseReceipt = (receipt: any) => ({
  ...receipt,
  netSales: Number(receipt.netSales ?? receipt.netsales ?? 0),
  paymentMethod: String(receipt.paymentMethod || receipt.paymentmethod || '').toLowerCase(),
  cashReceived: Number(receipt.cashReceived ?? receipt.cashreceived ?? receipt.cashTendered ?? 0),
  changeDue: Number(receipt.changeDue ?? receipt.changedue ?? receipt.change ?? 0),
  gcashRefNumber: receipt.gcashRefNumber || receipt.gcashrefnumber || '',
});

  // Bulk Stock Edit States
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [bulkStocks, setBulkStocks] = useState<Record<string, number>>({});
  const [isSavingBulk, setIsSavingBulk] = useState(false);

  // Start Bulk Edit (Populates local state with current stocks)
  const handleStartBulkEdit = () => {
    const initialStocks: Record<string, number> = {};
    products.forEach((p) => {
      initialStocks[p.id] = p.stock;
    });
    setBulkStocks(initialStocks);
    setIsBulkEditing(true);
  };

  // Handle Input Value Changes
  const handleBulkStockChange = (productId: string, value: string) => {
    const parsedValue = parseInt(value, 10);
    setBulkStocks((prev) => ({
      ...prev,
      [productId]: isNaN(parsedValue) ? 0 : Math.max(0, parsedValue),
    }));
  };

      const handleSaveBulkStock = async () => {
      setIsSavingBulk(true);
      try {
        const timestamp = new Date().toISOString();

        // 1. Identify items with changed stock levels
        const modifiedProducts = products.filter(
          (p) => bulkStocks[p.id] !== undefined && bulkStocks[p.id] !== p.stock
        );

        if (modifiedProducts.length === 0) {
          setIsBulkEditing(false);
          setIsSavingBulk(false);
          return;
        }

        // 2. Prepare Supabase updates for products & inventory ledger
        const productPromises = modifiedProducts.map((p) =>
          supabase
            .from('products')
            .update({ stock: bulkStocks[p.id] })
            .eq('id', p.id)
        );

        const ledgerPromises = modifiedProducts.map((p) => {
          const qtyDiff = bulkStocks[p.id] - p.stock;
          return supabase.from('inventory_ledger').insert([
            {
              product_id: p.id,
              change_qty: qtyDiff,
              reason: `Bulk Stock Adjustment (${qtyDiff >= 0 ? '+' : ''}${qtyDiff})`,
              created_at: timestamp,
            },
          ]);
        });

        // 3. Execute all updates concurrently to Supabase
        await Promise.all([...productPromises, ...ledgerPromises]);

        // 4. Fetch updated list locally
        await fetchProducts();
        setIsBulkEditing(false);
      } catch (err) {
        console.error('Failed bulk stock update on Supabase:', err);
      } finally {
        setIsSavingBulk(false);
      }
    };
      // 1. Callback to handle adding scanned products to the cart
const handleBarcodeScanned = useCallback((scannedBarcode: string) => {
  const foundProduct = products.find((p) => p.barcode === scannedBarcode);
  if (foundProduct) {
    // Replace 'addToCart' with your component's cart handler if named differently
    addToCart(foundProduct);
  } else {
    console.warn('No product found matching barcode:', scannedBarcode);
  }
}, [products]);

// 2. Hardware Gun Listener with corrected variable name
useEffect(() => {
  if (posScanMethod !== 'hardware') return;

  let barcodeBuffer = '';
  let timeoutId: NodeJS.Timeout;

  const handleKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

    if (e.key === 'Enter') {
      if (barcodeBuffer.trim()) {
        handleBarcodeScanned(barcodeBuffer.trim());
        barcodeBuffer = '';
      }
      return;
    }

    if (e.key.length === 1) {
      barcodeBuffer += e.key;
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        barcodeBuffer = '';
      }, 100);
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    clearTimeout(timeoutId);
  };
}, [posScanMethod, handleBarcodeScanned]);

// Export Summary Metrics & Filtered Transactions to Excel / CSV
const handleExportToExcel = () => {
  if (!filteredTransactions || filteredTransactions.length === 0) {
    alert("No transaction data available for the selected timeframe.");
    return;
  }

  const timeframeLabel = analyticsTimeframe.toUpperCase();

  // 1. Summary Metrics Block (Displays at top of Excel file)
  const summaryRows = [
    ["IÑAKI POS - SALES & PROFIT REPORT"],
    ["Report Timeframe:", timeframeLabel],
    ["Generated Date:", `"${new Date().toLocaleString('en-PH')}"`],
    [""],
    ["SUMMARY METRICS"],
    ["Total Revenue Amount (PHP)", filteredMetrics.revenue.toFixed(2)],
    ["GCash Payments Amount (PHP)", filteredMetrics.gcash.toFixed(2)],
    ["Estimated Profit Amount (PHP)", filteredMetrics.profit.toFixed(2)],
    ["Total Capital Amount (Current Inventory) (PHP)", totalCapital.toFixed(2)],
    ["Total Transactions (Server Log Entries)", filteredMetrics.count],
    [""],
    ["TRANSACTION LOG DETAILS"]
  ];

  // 2. Detail Table Column Headers
  const headers = [
    "Invoice ID",
    "Date & Time",
    "Payment Method",
    "GCash Ref #",
    "Items Count",
    "Net Amount (PHP)"
  ];

  // 3. Detailed Data Rows from Filtered Transactions
  const dataRows = filteredTransactions.map((tx) => [
    `"${tx.id}"`,
    `"${new Date(tx.timestamp).toLocaleString('en-PH')}"`,
    `"${String(tx.paymentMethod || tx.paymentmethod || '').toUpperCase()}"`,
    `"${tx.gcashRefNumber || tx.gcashrefnumber || '-'}"`,
    Array.isArray(tx.items) ? tx.items.length : 0,
    Number(tx.netSales || tx.netsales || 0).toFixed(2)
  ]);

  // 4. Combine Summary, Headers, and Data
  const csvLines = [
    ...summaryRows.map((row) => row.join(",")),
    headers.join(","),
    ...dataRows.map((row) => row.join(","))
  ];

  const csvContent = csvLines.join("\n");

  // 5. Create Blob with UTF-8 BOM (\ufeff) so Excel formats currency and numbers properly
  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  // 6. Trigger Download
  const link = document.createElement("a");
  const fileName = `Sales_Report_${analyticsTimeframe}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// 1. Timeframe State (Daily | Weekly | Monthly | All)
const [analyticsTimeframe, setAnalyticsTimeframe] = useState<'daily' | 'weekly' | 'monthly' | 'all'>('daily');

// 2. Filter Transactions based on selected Timeframe
const filteredTransactions = useMemo(() => {
  const now = new Date();
  return transactions.filter((tx) => {
    const txDate = new Date(tx.timestamp);
    if (analyticsTimeframe === 'daily') {
      return txDate.toDateString() === now.toDateString();
    }
    if (analyticsTimeframe === 'weekly') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return txDate >= sevenDaysAgo;
    }
    if (analyticsTimeframe === 'monthly') {
      return (
        txDate.getMonth() === now.getMonth() &&
        txDate.getFullYear() === now.getFullYear()
      );
    }
    return true; // 'all'
  });
}, [transactions, analyticsTimeframe]);

// 3. Recalculate Metrics for Filtered Timeframe
const filteredMetrics = useMemo(() => {
  let revenue = 0;
  let gcash = 0;
  let gcashCount = 0;
  let profit = 0;

  filteredTransactions.forEach((tx) => {
    const net = Number(tx.netSales ?? tx.netsales ?? 0);
    revenue += net;

    const method = String(tx.paymentMethod ?? tx.paymentmethod ?? '').toLowerCase();
    if (method === 'gcash') {
      gcash += net;
      gcashCount++;
    }

    if (Array.isArray(tx.items)) {
      const txCost = tx.items.reduce((acc: number, item: any) => {
        const cost = Number(item.costPrice ?? item.cost_price ?? item.cost ?? 0);
        const qty = Number(item.quantity ?? 1);
        return acc + cost * qty;
      }, 0);
      profit += net - txCost;
    }
  });

  return {
    revenue,
    gcash,
    gcashCount,
    profit,
    count: filteredTransactions.length,
  };
}, [filteredTransactions]);

// 1. Theme Configuration Schema
const DEFAULT_THEME = {
  bgPrimary: '#020617',
  bgCard: '#0f172a',
  borderColor: '#1e293b',
  textPrimary: '#f8fafc',
  accentColor: '#c026d3',
  fontFamily: 'sans-serif',
};

// 2. Persistent Theme State (Next.js SSR Safe)
const [theme, setThemeState] = useState(() => {
  // Check if code is running in the browser before accessing localStorage
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const saved = localStorage.getItem('pos_app_theme');
    return saved ? JSON.parse(saved) : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
});

// Helper function to update theme
const applyTheme = (newTheme: typeof DEFAULT_THEME | string) => {
  if (typeof newTheme === 'string') {
    if (newTheme === 'light') {
      setThemeState({
        bgPrimary: '#f8fafc',
        bgCard: '#ffffff',
        borderColor: '#e2e8f0',
        textPrimary: '#0f172a',
        accentColor: '#2563eb',
        fontFamily: 'sans-serif'
      });
    } else {
      setThemeState(DEFAULT_THEME);
    }
  } else {
    setThemeState(newTheme);
  }
};

// 3. Sync CSS Variables & LocalStorage (Client Side Only)
useEffect(() => {
  if (typeof window === 'undefined') return;

  const root = document.documentElement;
  const current = typeof theme === 'object' ? theme : DEFAULT_THEME;

  root.style.setProperty('--bg-primary', current.bgPrimary || '#020617');
  root.style.setProperty('--bg-card', current.bgCard || '#0f172a');
  root.style.setProperty('--border-color', current.borderColor || '#1e293b');
  root.style.setProperty('--text-primary', current.textPrimary || '#f8fafc');
  root.style.setProperty('--accent-color', current.accentColor || '#c026d3');
  root.style.setProperty('--font-family', current.fontFamily || 'sans-serif');

  localStorage.setItem('pos_app_theme', JSON.stringify(current));
}, [theme]);





  return (
  
        <div 
        className="min-h-screen flex flex-col transition-colors duration-200"
        style={{
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-family)'
        }}
      >
      {/* Top Header Navigation */}
      <header className="border-b px-4 py-3 flex items-center justify-between sticky top-0 z-30"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="h-8 w-8 rounded-lg flex items-center justify-center font-black text-white text-sm"
              style={{ backgroundColor: 'var(--accent-color)' }}
            >
              I
            </div>
            <h1 className="font-black text-lg tracking-wide">IÑAKI <span style={{ color: 'var(--accent-color)' }}>POS</span></h1>
          </div>

          <nav 
            className="flex items-center gap-1 p-1 rounded-xl border text-xs font-bold"
            style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-color)' }}
          >
            {[
              { id: 'pos', label: 'POS', icon: ShoppingCart },
              { id: 'inventory', label: 'Inventory', icon: Package },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 },
              { id: 'ledger', label: 'Utang Ledger', icon: BookOpen },
              { id: 'settings', label: 'Settings', icon: Sliders },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition"
                  style={{
                    backgroundColor: isActive ? 'var(--accent-color)' : 'transparent',
                    color: isActive ? '#ffffff' : 'var(--text-primary)',
                    opacity: isActive ? 1 : 0.7
                  }}
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
            <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto min-w-0">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 text-slate-500" size={16} />
                  <input
                    type="text"
                    placeholder="Search product name or scan barcode..."
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

              {isLoadingProducts ? (
                <div className="p-12 text-center text-slate-500 text-xs">Loading products from Supabase...</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      className="bg-slate-900 border border-slate-800 hover:border-fuchsia-500/50 rounded-2xl p-3.5 text-left transition flex flex-col justify-between space-y-2 group"
                    >
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{product.barcode || 'NO BARCODE'}</p>
                        <h3 className="font-bold text-xs text-slate-200 group-hover:text-fuchsia-400 transition line-clamp-2">{product.name}</h3>
                      </div>
                      <div className="flex justify-between items-end pt-2 border-t border-slate-800/60">
                        <span className="font-mono font-bold text-sm text-amber-400">₱{product.price.toFixed(2)}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${product.stock > 5 ? 'bg-slate-800 text-slate-400' : 'bg-rose-500/20 text-rose-400'}`}>
                          {product.stock} left
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
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
            {/* Header & Action Controls */}
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold">Inventory Management</h2>
                <p className="text-xs text-slate-400">Manage stock, cost prices, and barcodes directly in Supabase</p>
              </div>
              
              <div className="flex items-center gap-2">
                {!isBulkEditing ? (
                  <>
                    <button
                      onClick={handleStartBulkEdit}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 border border-slate-700"
                    >
                      Bulk Edit Stock
                    </button>
                    <button
                      onClick={handleOpenAddProduct}
                      className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-fuchsia-600/30"
                    >
                      <Plus size={16} /> Add Product
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsBulkEditing(false)}
                      disabled={isSavingBulk}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs px-4 py-2.5 rounded-xl transition border border-slate-700 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveBulkStock}
                      disabled={isSavingBulk}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-lg shadow-emerald-600/30 disabled:opacity-50"
                    >
                      {isSavingBulk ? 'Saving...' : 'Save All Updates'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Products Table */}
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
                      
                      {/* --- EDITABLE STOCK COLUMN --- */}
                      <td className="p-3.5 font-mono font-bold">
                        {isBulkEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={bulkStocks[p.id] ?? p.stock}
                            onChange={(e) => handleBulkStockChange(p.id, e.target.value)}
                            className="w-20 bg-slate-950 border border-fuchsia-500 text-white text-xs font-mono font-bold text-center px-2 py-1 rounded-lg focus:outline-none focus:ring-1 focus:ring-fuchsia-400"
                          />
                        ) : (
                          <span className={p.stock <= 0 ? 'text-rose-400' : 'text-slate-100'}>
                            {p.stock}
                          </span>
                        )}
                      </td>

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
          <div className="flex-1 p-6 overflow-y-auto max-w-6xl mx-auto w-full space-y-6">
            {/* Analytics Header & Timeframe Selector */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold">Sales & Profit Analytics</h2>
                <p className="text-xs text-slate-400">Live transaction server logs synced with Supabase</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Timeframe Selector Pills */}
                <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs font-bold">
                  {(['daily', 'weekly', 'monthly', 'all'] as const).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setAnalyticsTimeframe(tf)}
                      className={`px-3 py-1.5 rounded-lg capitalize transition ${
                        analyticsTimeframe === tf
                          ? 'bg-fuchsia-600 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>

                <button
                  onClick={fetchTransactions}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1.5"
                >
                  <RefreshCw size={14} className={isLoadingTransactions ? 'animate-spin' : ''} /> Sync
                </button>

                <button
                  onClick={handleExportToExcel}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 border border-slate-700"
                >
                  <Download size={14} /> Export Report
                </button>
              </div>
            </div>

            {/* Metric Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* 1. Total Revenue */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
                <span className="text-slate-400 text-xs block font-semibold capitalize">{analyticsTimeframe} Revenue</span>
                <span className="font-mono text-2xl font-bold text-emerald-400">₱{filteredMetrics.revenue.toFixed(2)}</span>
                <span className="text-[10px] text-slate-500 block font-semibold">{filteredMetrics.count} transactions</span>
              </div>

              {/* 2. GCash Payments */}
              <div className="bg-slate-900 border border-blue-500/30 p-4 rounded-2xl space-y-1 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/30">
                <div className="flex justify-between items-center">
                  <span className="text-blue-300 text-xs block font-semibold capitalize">{analyticsTimeframe} GCash</span>
                  <CreditCard size={18} className="text-blue-400" />
                </div>
                <span className="font-mono text-2xl font-bold text-blue-400">₱{filteredMetrics.gcash.toFixed(2)}</span>
                <span className="text-[10px] text-blue-300/80 block font-semibold">{filteredMetrics.gcashCount} transactions</span>
              </div>

              {/* 3. Estimated Profit */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
                <span className="text-slate-400 text-xs block font-semibold capitalize">{analyticsTimeframe} Profit</span>
                <span className="font-mono text-2xl font-bold text-fuchsia-400">₱{filteredMetrics.profit.toFixed(2)}</span>
                <span className="text-[10px] text-slate-500 block font-semibold">Net revenue - cost</span>
              </div>

              {/* 4. Total Capital */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-xs block font-semibold">Total Capital</span>
                  <Wallet size={18} className="text-indigo-400" />
                </div>
                <span className="font-mono text-2xl font-bold text-indigo-400">
                  ₱{totalCapital.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-500 block font-semibold">Cost × Available Stock</span>
              </div>

              {/* 5. Total Transactions */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
                <span className="text-slate-400 text-xs block font-semibold capitalize">{analyticsTimeframe} Logs</span>
                <span className="font-mono text-2xl font-bold text-amber-400">{filteredMetrics.count}</span>
                <span className="text-[10px] text-slate-500 block font-semibold">Server log entries</span>
              </div>
            </div>

            {/* Filtered Transaction Log Table */}
            <div className="space-y-3">
              <h3 className="font-bold text-sm text-slate-200 capitalize">{analyticsTimeframe} Transaction Log</h3>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                {filteredTransactions.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    {isLoadingTransactions ? 'Loading transactions...' : `No ${analyticsTimeframe} transactions found.`}
                  </div>
                ) : (
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px]">
                      <tr>
                        <th className="p-3.5">Invoice ID</th>
                        <th className="p-3.5">Date & Time</th>
                        <th className="p-3.5">Method</th>
                        <th className="p-3.5">GCash Ref #</th>
                        <th className="p-3.5">Items</th>
                        <th className="p-3.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {filteredTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                          <td className="p-3.5 font-mono text-slate-300 font-bold">{tx.id}</td>
                          <td className="p-3.5 text-slate-400 text-[11px]">
                            {new Date(tx.timestamp).toLocaleString('en-PH')}
                          </td>
                          <td className="p-3.5 uppercase font-bold">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] ${
                                String(tx.paymentMethod || tx.paymentmethod).toLowerCase() === 'gcash'
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : 'bg-emerald-500/20 text-emerald-400'
                              }`}
                            >
                              {tx.paymentMethod || tx.paymentmethod}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-slate-400 text-[11px]">
                            {tx.gcashRefNumber || tx.gcashrefnumber || '-'}
                          </td>
                          <td className="p-3.5 text-slate-400">
                            {Array.isArray(tx.items) ? tx.items.length : 0} items
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold text-amber-400">
                            ₱{Number(tx.netSales || tx.netsales || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
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
      <div className="p-3 bg-fuchsia-600/20 text-fuchsia-400 rounded-xl">
        <Sliders size={22} />
      </div>
      <div>
        <h2 className="text-lg font-bold">Hardware & System Settings</h2>
        <p className="text-xs text-slate-400">Configure scanner hardware, printers, and visual themes</p>
      </div>
    </div>

    {/* Bluetooth Thermal Printer */}
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

    {/* POS Scanner Method */}
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      <h3 className="font-semibold text-slate-100 text-sm">Primary POS Scanner Method</h3>
      <div className="grid grid-cols-3 gap-3">
        {[
          { id: 'hardware', label: 'Hardware Gun', desc: 'USB/BT barcode gun' },
          { id: 'camera', label: 'Device Camera', desc: 'Integrated auto-focus' },
          { id: 'manual', label: 'Manual Key', desc: 'Direct search input' },
        ].map((option) => (
          <button
            key={option.id}
            onClick={() => setPosScanMethod(option.id as ScanMethod)}
            className={`p-3.5 rounded-xl border text-left transition ${
              posScanMethod === option.id 
                ? 'bg-fuchsia-600/10 border-fuchsia-500 text-white' 
                : 'bg-slate-950 border-slate-800 text-slate-400'
            }`}
          >
            <p className="font-bold text-xs">{option.label}</p>
            <p className="text-[10px] text-slate-500 mt-1">{option.desc}</p>
          </button>
        ))}
      </div>
    </div>

    {/* Theme & Visual Customization Section */}
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
      <div>
        <h3 className="font-semibold text-slate-100 text-sm">Theme Appearance & Customization</h3>
        <p className="text-xs text-slate-400">Customize background, card borders, typography, and accent colors across the app.</p>
      </div>

      {/* Quick Presets */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-300 block">Quick Presets</label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => applyTheme(DEFAULT_THEME)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-200 hover:border-slate-600 transition"
          >
            🌙 Midnight Dark
          </button>

          <button
            onClick={() => applyTheme({
              bgPrimary: '#052e16',
              bgCard: '#064e3b',
              borderColor: '#047857',
              textPrimary: '#ecfdf5',
              accentColor: '#10b981',
              fontFamily: 'sans-serif'
            })}
            className="px-3 py-1.5 rounded-xl bg-emerald-950 border border-emerald-800 text-xs font-semibold text-emerald-200 hover:border-emerald-600 transition"
          >
            🌲 Emerald Forest
          </button>

          <button
            onClick={() => applyTheme({
              bgPrimary: '#18181b',
              bgCard: '#27272a',
              borderColor: '#3f3f46',
              textPrimary: '#fafafa',
              accentColor: '#f43f5e',
              fontFamily: 'monospace'
            })}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-xs font-semibold text-rose-300 hover:border-rose-500 transition"
          >
            🤖 Cyber Terminal
          </button>

          <button
            onClick={() => applyTheme('light')}
            className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-800 hover:border-slate-400 transition"
          >
            ☀️ Clean Light
          </button>
        </div>
      </div>

      {/* Custom Color Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-200">Main Background</p>
            <p className="text-[10px] text-slate-500">App body background</p>
          </div>
          <input
            type="color"
            value={typeof theme === 'object' ? theme.bgPrimary : DEFAULT_THEME.bgPrimary}
            onChange={(e) => applyTheme({ ... (typeof theme === 'object' ? theme : DEFAULT_THEME), bgPrimary: e.target.value })}
            className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
          />
        </div>

        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-200">Container / Cards</p>
            <p className="text-[10px] text-slate-500">Panel surface color</p>
          </div>
          <input
            type="color"
            value={typeof theme === 'object' ? theme.bgCard : DEFAULT_THEME.bgCard}
            onChange={(e) => applyTheme({ ... (typeof theme === 'object' ? theme : DEFAULT_THEME), bgCard: e.target.value })}
            className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
          />
        </div>

        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-200">Borders</p>
            <p className="text-[10px] text-slate-500">Card borders & dividers</p>
          </div>
          <input
            type="color"
            value={typeof theme === 'object' ? theme.borderColor : DEFAULT_THEME.borderColor}
            onChange={(e) => applyTheme({ ... (typeof theme === 'object' ? theme : DEFAULT_THEME), borderColor: e.target.value })}
            className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
          />
        </div>

        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-200">Accent Highlight</p>
            <p className="text-[10px] text-slate-500">Active tab & key focus</p>
          </div>
          <input
            type="color"
            value={typeof theme === 'object' ? theme.accentColor : DEFAULT_THEME.accentColor}
            onChange={(e) => applyTheme({ ... (typeof theme === 'object' ? theme : DEFAULT_THEME), accentColor: e.target.value })}
            className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
          />
        </div>

        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-200">Typography Text</p>
            <p className="text-[10px] text-slate-500">Main text color</p>
          </div>
          <input
            type="color"
            value={typeof theme === 'object' ? theme.textPrimary : DEFAULT_THEME.textPrimary}
            onChange={(e) => applyTheme({ ... (typeof theme === 'object' ? theme : DEFAULT_THEME), textPrimary: e.target.value })}
            className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
          />
        </div>

        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
          <p className="text-xs font-bold text-slate-200">App Font Family</p>
          <select
            value={typeof theme === 'object' ? theme.fontFamily : DEFAULT_THEME.fontFamily}
            onChange={(e) => applyTheme({ ... (typeof theme === 'object' ? theme : DEFAULT_THEME), fontFamily: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg p-1.5 focus:outline-none"
          >
            <option value="sans-serif">Sans-Serif (Modern Clean)</option>
            <option value="monospace">Monospace (Terminal Tech)</option>
            <option value="serif">Serif (Classic)</option>
            <option value="system-ui">System Default UI</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={() => applyTheme(DEFAULT_THEME)}
          className="text-xs text-slate-400 hover:text-slate-200 underline transition"
        >
          Reset to Default Theme
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
                  <p className="text-xs text-slate-400">Select payment method and save to Supabase</p>
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
                  <label className="text-xs text-slate-400 block font-semibold">GCash Reference Number (`gcashrefnumber`):</label>
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
                Confirm & Save to Server
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

              {/* --- TOTALS & CASH DETAILS --- */}
              {(() => {
                const rec = receiptData as any;
                const paymentMethod = String(rec.paymentMethod || rec.paymentmethod || '').toLowerCase();
                const netSales = Number(rec.netSales ?? rec.netsales ?? 0);
                const cashReceived = Number(rec.cashReceived ?? rec.cashreceived ?? rec.cashTendered ?? 0);
                const changeDue = Number(rec.changeDue ?? rec.changedue ?? rec.change ?? 0);
                const gcashRef = rec.gcashRefNumber || rec.gcashrefnumber;

                return (
                  <div className="py-2 border-b border-dashed border-gray-400 space-y-0.5 text-[10px]">
                    <div className="flex justify-between font-bold text-xs pt-0.5">
                      <span>TOTAL:</span>
                      <span>P{netSales.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex justify-between text-gray-800 uppercase pt-0.5 text-[9px]">
                      <span>PAYMENT:</span>
                      <span className="font-bold">{paymentMethod}</span>
                    </div>

                    {(paymentMethod === 'cash' || cashReceived > 0) && (
                      <>
                        <div className="flex justify-between text-gray-800 text-[9px]">
                          <span>CASH TENDERED:</span>
                          <span className="font-bold">
                            P{cashReceived.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-gray-800 text-[9px]">
                          <span>CHANGE:</span>
                          <span className="font-bold">
                            P{changeDue.toFixed(2)}
                          </span>
                        </div>
                      </>
                    )}

                    {gcashRef && (
                      <div className="flex justify-between text-gray-800 text-[9px]">
                        <span>GCASH REF:</span>
                        <span className="font-bold">{gcashRef}</span>
                      </div>
                    )}
                  </div>
                );
              })()}

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
                  <button onClick={() => window.print()} className="flex-1 bg-slate-800 text-slate-200 font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5">
                    <Printer size={14} /> Web Print
                  </button>
                  <button onClick={() => setReceiptData(null)} className="flex-1 bg-slate-800 text-slate-300 font-bold text-xs py-2 rounded-xl">
                    Close
                  </button>
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
                {editingProduct ? 'Save Changes' : 'Add to Supabase Database'}
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

