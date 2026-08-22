import { db } from './db';
import { supabase } from './supabase';

export async function processCheckout(
  items: { product_id: string; quantity: number; unit_price: number }[],
  paymentMethod: string,
  totalAmount: number
) {
  const saleId = crypto.randomUUID();
  const saleData = {
    id: saleId,
    total_amount: totalAmount,
    payment_method: paymentMethod,
    created_at: new Date().toISOString(),
    items,
    synced: false,
  };

  // 1. Update local IndexedDB instantly (Zero lag for cashier)
  await db.transaction('rw', [db.products, db.sales, db.syncQueue], async () => {
    await db.sales.add(saleData);

    for (const item of items) {
      const product = await db.products.get(item.product_id);
      if (product) {
        await db.products.update(item.product_id, {
          stock: product.stock - item.quantity,
        });
      }
    }

    await db.syncQueue.add({
      action: 'CREATE_SALE',
      payload: saleData,
      timestamp: Date.now(),
    });
  });

  // 2. Trigger sync if online
  if (navigator.onLine) {
    await syncPendingData();
  }
}

export async function syncPendingData() {
  if (!navigator.onLine) return;

  const queue = await db.syncQueue.toArray();
  for (const item of queue) {
    try {
      if (item.action === 'CREATE_SALE') {
        const { payload } = item;

        // Insert Sale into Supabase
        const { error: saleErr } = await supabase.from('sales').insert([{
          id: payload.id,
          total_amount: payload.total_amount,
          payment_method: payload.payment_method,
          created_at: payload.created_at,
          synced_from_offline: true
        }]);

        if (saleErr) throw saleErr;

        // Insert Sale Items
        const saleItems = payload.items.map((i: any) => ({
          sale_id: payload.id,
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
        }));
        await supabase.from('sale_items').insert(saleItems);

        // Update Remote Stock & Ledger
        for (const i of payload.items) {
          await supabase.rpc('decrement_stock', { p_id: i.product_id, qty: i.quantity });
          await supabase.from('inventory_ledger').insert([{
            product_id: i.product_id,
            change_qty: -i.quantity,
            reason: 'SALE'
          }]);
        }

        // Mark local as synced and remove from queue
        await db.sales.update(payload.id, { synced: true });
        if (item.id) await db.syncQueue.delete(item.id);
      }
    } catch (err) {
      console.error('Sync failed for item:', item.id, err);
    }
  }
}