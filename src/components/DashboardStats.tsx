'use client';

import { useState, useEffect } from 'react';
import { db, LocalProduct } from '@/lib/db';

export default function DashboardStats() {
  const [lowStockItems, setLowStockItems] = useState<LocalProduct[]>([]);
  const [todayRevenue, setTodayRevenue] = useState<number>(0);
  const [todaySalesCount, setTodaySalesCount] = useState<number>(0);

  async function loadDashboardData() {
    // 1. Fetch items at or below minimum threshold
    const lowStock = await db.products
      .filter((product) => product.stock <= (product.min_stock ?? 5))
      .toArray();
    setLowStockItems(lowStock);

    // 2. Fetch today's sales and sum total revenue
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todaysSales = await db.sales
      .where('created_at')
      .above(startOfDay.toISOString())
      .toArray();

    const revenue = todaysSales.reduce((acc, sale) => acc + sale.total_amount, 0);

    setTodayRevenue(revenue);
    setTodaySalesCount(todaysSales.length);
  }

  useEffect(() => {
    loadDashboardData();
  }, []);

  return (
    <div className="p-4 space-y-6">
      {/* Analytics Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-white">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today's Revenue</p>
          <p className="text-3xl font-bold mt-1">₱{todayRevenue.toFixed(2)}</p>
          <span className="text-xs text-slate-400">{todaySalesCount} completed orders</span>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-white">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Low Stock Warnings</p>
          <p className="text-3xl font-bold text-amber-400 mt-1">{lowStockItems.length} Products</p>
          <span className="text-xs text-slate-400">Require restock</span>
        </div>
      </div>

      {/* Low Stock Alert Panel */}
      {lowStockItems.length > 0 && (
        <div className="p-4 bg-amber-950/30 border border-amber-500/30 rounded-xl">
          <h3 className="font-semibold text-amber-400 text-sm mb-3">⚠️ Low Stock Alerts</h3>
          <div className="space-y-2">
            {lowStockItems.map((item) => (
              <div key={item.id} className="flex justify-between items-center text-sm text-slate-200 border-b border-slate-800 pb-2">
                <span>{item.name}</span>
                <span className="font-mono text-xs px-2 py-1 bg-amber-500/20 text-amber-300 rounded">
                  {item.stock} left (Min: {item.min_stock ?? 5})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}