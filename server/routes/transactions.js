import express from 'express';
import { supabase, supabaseAdmin } from '../supabaseClient.js';

const router = express.Router();
const db = supabaseAdmin || supabase;

// Helper to extract clean user details
function getCreatorDetails(creator) {
  let name = 'Admin';
  let email = 'admin@swinesync.com';
  if (typeof creator === 'string' && creator.trim() !== '') {
    name = creator;
    if (creator.includes('@')) email = creator;
  } else if (typeof creator === 'object' && creator !== null) {
    name = creator.name || creator.full_name || creator.user_metadata?.full_name || creator.email?.split('@')[0] || 'Admin';
    email = creator.email || 'admin@swinesync.com';
  }
  const parts = name.split(' ');
  const initials = parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.substring(0, 2).toUpperCase();
  return { name, email, initials };
}

// Generate unique receipt code
function generateTxCode(prefix = 'TX') {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}-${num}`;
}

// In-memory fallback cache so sales display and calculate even if Postgres table grant is pending
const localSalesFallback = [];

// Format date into "Nov 6, 2026"
function formatDateDisplay(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Format time into "3:45 PM"
function formatTimeDisplay(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  if (isNaN(date.getTime())) return '';
  try {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila',
    });
  } catch {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
}

// ─── GET /api/transactions/options ──────────────────────────────────────────
// Returns live active pigs, batches, and inventory supplies for sale & restock modals
router.get('/api/transactions/options', async (req, res) => {
  try {
    const [pigsRes, batchesRes, itemsRes] = await Promise.all([
      db.from('pigs')
        .select('pig_id, pig_tag, gender, weight, status, parity_count, pen_id, pens(pen_code), breeds(name)')
        .eq('is_archived', false)
        .order('pig_tag'),
      db.from('piglet_batches')
        .select('batch_id, batch_tag, current_count, average_weight, date_of_birth, status, pen_id, pens(pen_code), breeds(name)')
        .eq('is_archived', false)
        .gt('current_count', 0)
        .order('batch_tag'),
      db.from('inventory_items')
        .select('item_id, item_name, category, unit_of_measure, current_stock_level, ideal_stock_level, unit_cost')
        .eq('is_archived', false)
        .order('item_name'),
    ]);

    const today = new Date();

    // 1. FILTER: ONLY HEALTHY BATCHES (strictly exclude sick and quarantine)
    const healthyBatches = (batchesRes.data || []).filter((b) => {
      const s = (b.status || '').toLowerCase();
      return s !== 'sick' && s !== 'quarantine';
    });

    const enrichedBatches = healthyBatches.map((b) => {
      let ageDays = 0;
      if (b.date_of_birth) {
        const dob = new Date(b.date_of_birth);
        ageDays = Math.max(0, Math.floor((today - dob) / (1000 * 60 * 60 * 24)));
      }
      const isMarketWeaner = ageDays >= 28 && ageDays < 90;
      const isMarketFattener = ageDays >= 150;
      return {
        ...b,
        ageDays,
        marketType: isMarketFattener ? 'Finisher' : isMarketWeaner ? 'Weaner' : 'Growing',
        label: `${b.batch_tag} (${b.current_count} heads • ${b.pens?.pen_code ? 'Pen ' + b.pens.pen_code : 'No pen'}${isMarketFattener ? ' • Ready Finisher' : isMarketWeaner ? ' • Weaner' : ' • Healthy'})`,
      };
    });

    // 2. BREEDING HERD: Sows only sold when reaching target parity count (cull)
    const healthySows = (pigsRes.data || []).filter((p) => {
      const isFemale = (p.gender || '').toLowerCase().startsWith('f') || p.status?.toLowerCase() === 'sow';
      const s = (p.status || '').toLowerCase();
      const isHealthy = s !== 'sick' && s !== 'quarantine';
      return isFemale && isHealthy;
    }).map((p) => {
      const parity = Number(p.parity_count) || 0;
      const isHighParity = parity >= 5 || (p.status || '').toLowerCase() === 'cull';
      return {
        ...p,
        parity,
        isHighParity,
        label: `Sow #${p.pig_tag} (Parity ${parity}${p.pens?.pen_code ? ' • Pen ' + p.pens.pen_code : ''}${isHighParity ? ' • Ready for Cull Sale' : ' • Active Breeder'})`,
      };
    });

    res.json({
      pigs: healthySows,
      batches: enrichedBatches,
      inventoryItems: itemsRes.data || [],
    });
  } catch (err) {
    console.error('Error fetching transaction options:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/transactions ──────────────────────────────────────────────────
// Returns unified list of sales and expenses with multi-criteria filtering
router.get('/api/transactions', async (req, res) => {
  try {
    const { tab = 'All', category = 'All categories', status = 'All statuses', range = 'All', search = '' } = req.query;

    // 1. Fetch Expenses + inventory_purchases
    let expQuery = db
      .from('expenses')
      .select(`
        expense_id,
        category,
        amount,
        date_incurred,
        supplier_name,
        receipt_no,
        payment_method,
        description,
        created_at,
        inventory_purchases (
          purchase_id,
          item_id,
          quantity_bought,
          unit_price,
          subtotal,
          batch_number,
          inventory_items (item_name, unit_of_measure)
        )
      `)
      .order('created_at', { ascending: false });

    // 2. Fetch Sales + sold_swine (with safe fallback if table not yet migrated)
    let salesQuery = db
      .from('sales_transactions')
      .select(`
        sale_id,
        receipt_no,
        buyer_name,
        category,
        total_price,
        payment_method,
        status,
        transaction_date,
        notes,
        created_at,
        sold_swine (
          item_id,
          pig_id,
          batch_id,
          item_description,
          quantity_sold,
          sale_weight,
          unit_price,
          subtotal,
          pigs (pig_tag),
          piglet_batches (batch_tag)
        )
      `)
      .order('created_at', { ascending: false });

    const [expRes, salesRes] = await Promise.all([
      Promise.resolve(expQuery).catch((e) => ({ data: null, error: e })),
      Promise.resolve(salesQuery).catch((e) => ({ data: null, error: e })),
    ]);

    const rawExpenses = expRes.data || [];
    const rawSales = salesRes.data || [];

    // Transform expenses into standard UI model
    const mappedExpenses = rawExpenses.map((exp) => {
      const items = (exp.inventory_purchases || []).map((ip) => ({
        name: ip.inventory_items?.item_name || 'Supplies',
        qty: Number(ip.quantity_bought) || 1,
        price: Number(ip.unit_price) || 0,
        subtotal: Number(ip.subtotal) || 0,
        unit: ip.inventory_items?.unit_of_measure || '',
      }));

      // Determine linked inventory summary
      let linked = '';
      if (items.length > 0) {
        const itemNames = items.map((i) => `+${i.qty} ${i.unit ? i.unit + ' ' : ''}${i.name}`).join(', ');
        linked = `${itemNames} added to inventory stock`;
      }

      return {
        id: exp.receipt_no || `EXP-${exp.expense_id.substring(0, 5).toUpperCase()}`,
        rawId: exp.expense_id,
        date: formatDateDisplay(exp.date_incurred || exp.created_at),
        time: formatTimeDisplay(exp.created_at),
        createdAt: exp.created_at,
        rawDate: exp.date_incurred || exp.created_at,
        type: 'Expense',
        party: exp.supplier_name || 'General Farm Supplier',
        category: exp.category || 'Supplies',
        amount: Number(exp.amount) || 0,
        status: exp.status || 'Completed',
        method: exp.payment_method || 'Cash',
        items: items.length > 0 ? items : [{ name: exp.description || exp.category, qty: 1, price: Number(exp.amount) }],
        linked,
        notes: exp.description || '',
      };
    });

    // Transform sales into standard UI model
    const mappedSales = rawSales.map((sale) => {
      const items = (sale.sold_swine || []).map((ss) => ({
        name: ss.item_description || (ss.pig_id ? `Breeding pig #${ss.pigs?.pig_tag || ''}` : `Batch piglets #${ss.piglet_batches?.batch_tag || ''}`),
        qty: Number(ss.quantity_sold) || 1,
        price: Number(ss.unit_price) || 0,
        subtotal: Number(ss.subtotal) || 0,
        weight: ss.sale_weight ? Number(ss.sale_weight) : null,
      }));

      // Determine linked swine summary
      const linkedPigs = (sale.sold_swine || [])
        .map((ss) => {
          if (ss.pigs?.pig_tag) return `#${ss.pigs.pig_tag}`;
          if (ss.piglet_batches?.batch_tag) return `${ss.quantity_sold} heads from #${ss.piglet_batches.batch_tag}`;
          return null;
        })
        .filter(Boolean);

      const linked = linkedPigs.length > 0
        ? `${linkedPigs.join(', ')} marked sold and removed from active pens`
        : '';

      return {
        id: sale.receipt_no || `TX-${sale.sale_id.substring(0, 5).toUpperCase()}`,
        rawId: sale.sale_id,
        date: formatDateDisplay(sale.transaction_date || sale.created_at),
        time: formatTimeDisplay(sale.created_at),
        createdAt: sale.created_at,
        rawDate: sale.transaction_date || sale.created_at,
        type: 'Sale',
        party: sale.buyer_name || 'Buyer',
        category: sale.category || 'Swine Sale',
        amount: Number(sale.total_price) || 0,
        status: sale.status || 'Completed',
        method: sale.payment_method || 'Cash',
        items: items.length > 0 ? items : [{ name: sale.category, qty: 1, price: Number(sale.total_price) }],
        linked,
        notes: sale.notes || '',
      };
    });

    // Merge fallback sales (avoiding duplicates)
    const dbSaleIds = new Set(mappedSales.map((s) => s.id));
    const uniqueFallbacks = localSalesFallback.filter((s) => !dbSaleIds.has(s.id));
    let merged = [...mappedSales, ...uniqueFallbacks, ...mappedExpenses];

    // Filter by Tab (All, Sales, Expenses)
    if (tab === 'Sales') merged = merged.filter((t) => t.type === 'Sale');
    if (tab === 'Expenses') merged = merged.filter((t) => t.type === 'Expense');

    // Filter by Category
    if (category && category !== 'All categories') {
      merged = merged.filter((t) => (t.category || '').toLowerCase() === category.toLowerCase());
    }

    // Filter by Status
    if (status && status !== 'All statuses') {
      merged = merged.filter((t) => (t.status || '').toLowerCase() === status.toLowerCase());
    }

    // Filter by Date Range
    if (range && range !== 'All') {
      const now = new Date();
      let cutoff = new Date(0);
      if (range === 'Last 7 days') {
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (range === 'Last 30 days') {
        cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else if (range === 'This quarter') {
        const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
        cutoff = new Date(now.getFullYear(), quarterStartMonth, 1);
      } else if (range === 'This year') {
        cutoff = new Date(now.getFullYear(), 0, 1);
      }
      merged = merged.filter((t) => new Date(t.rawDate) >= cutoff);
    }

    // Filter by Search Query
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      merged = merged.filter(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.party.toLowerCase().includes(q) ||
          (t.category || '').toLowerCase().includes(q) ||
          (t.notes || '').toLowerCase().includes(q)
      );
    }

    // Sort newly added records at the very top (by created_at / rawDate desc)
    merged.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.rawDate).getTime();
      const timeB = new Date(b.createdAt || b.rawDate).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return (b.id || '').localeCompare(a.id || '');
    });

    res.json({
      data: merged,
      totalCount: merged.length,
    });
  } catch (err) {
    console.error('Error fetching transactions:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/transactions/summary ──────────────────────────────────────────
// Computes metrics: Total Sales, Total Expenses, Net Income, Pending Payments, and 8-week trend
router.get('/api/transactions/summary', async (req, res) => {
  try {
    const [expRes, salesRes] = await Promise.all([
      Promise.resolve(db.from('expenses').select('amount, date_incurred, status, created_at')).catch(() => ({ data: [] })),
      Promise.resolve(db.from('sales_transactions').select('total_price, transaction_date, status, created_at')).catch(() => ({ data: [] })),
    ]);

    const expenses = expRes.data || [];
    const dbSaleIds = new Set((salesRes.data || []).map((s) => s.receipt_no));
    const fallbackForSummary = localSalesFallback.filter((s) => !dbSaleIds.has(s.id));
    const sales = [
      ...(salesRes.data || []),
      ...fallbackForSummary.map((s) => ({
        total_price: s.amount,
        transaction_date: s.rawDate,
        status: s.status,
        created_at: s.rawDate,
      })),
    ];

    let totalSales = 0;
    let totalExpenses = 0;
    let pendingPayments = 0;
    let pendingCount = 0;

    sales.forEach((s) => {
      const amt = Number(s.total_price) || 0;
      if (s.status === 'Completed' || !s.status) {
        totalSales += amt;
      } else if (s.status === 'Pending' || s.status === 'Overdue') {
        pendingPayments += amt;
        pendingCount++;
      }
    });

    expenses.forEach((e) => {
      const amt = Number(e.amount) || 0;
      if (e.status === 'Completed' || !e.status) {
        totalExpenses += amt;
      } else if (e.status === 'Pending' || e.status === 'Overdue') {
        pendingPayments += amt;
        pendingCount++;
      }
    });

    const netIncome = totalSales - totalExpenses;
    const profitMargin = totalSales > 0 ? Math.round((netIncome / totalSales) * 100) : 0;

    // ─── 8-Week Trend Calculation ─────────────────────────
    const weekLabels = [];
    const weeklySales = [];
    const weeklyExpenses = [];

    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
      const label = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      weekLabels.push(label);

      let wSales = 0;
      let wExp = 0;

      sales.forEach((s) => {
        const d = new Date(s.transaction_date || s.created_at);
        if (d >= weekStart && d <= weekEnd) {
          wSales += Number(s.total_price) || 0;
        }
      });

      expenses.forEach((e) => {
        const d = new Date(e.date_incurred || e.created_at);
        if (d >= weekStart && d <= weekEnd) {
          wExp += Number(e.amount) || 0;
        }
      });

      // Express in thousands for graph readability (or raw)
      weeklySales.push(Math.round(wSales / 1000));
      weeklyExpenses.push(Math.round(wExp / 1000));
    }

    res.json({
      stats: [
        { label: 'Total sales', value: `₱${totalSales.toLocaleString('en-PH')}`, note: 'Current period', icon: 'trendUp', tone: 'emerald' },
        { label: 'Total expenses', value: `₱${totalExpenses.toLocaleString('en-PH')}`, note: 'Current period', icon: 'trendDown', tone: 'slate' },
        { label: 'Net income', value: `₱${netIncome.toLocaleString('en-PH')}`, note: `${profitMargin}% profit margin`, icon: 'wallet', tone: 'emerald' },
        { label: 'Pending payments', value: `₱${pendingPayments.toLocaleString('en-PH')}`, note: `${pendingCount} transaction${pendingCount === 1 ? '' : 's'}`, icon: 'clock', tone: 'amber' },
      ],
      trend: {
        labels: weekLabels,
        sales: weeklySales,
        expenses: weeklyExpenses,
      },
      raw: {
        totalSales,
        totalExpenses,
        netIncome,
        pendingPayments,
        pendingCount,
      },
    });
  } catch (err) {
    console.error('Error fetching summary:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/transactions/expense ─────────────────────────────────────────
// Records a financial expense (and handles linked inventory restock if supplies were bought)
router.post('/api/transactions/expense', async (req, res) => {
  try {
    const {
      category,
      amount,
      supplierName,
      paymentMethod = 'Cash',
      paymentStatus = 'Completed',
      dateIncurred,
      description,
      receiptNo,
      creator,
      inventoryItems = [], // [{ itemId, quantityBought, unitPrice, batchNumber, expirationDate }]
    } = req.body;

    const { name: creatorName } = getCreatorDetails(creator);
    const resolvedReceipt = receiptNo?.trim() || generateTxCode('EXP');
    const resolvedDate = dateIncurred || new Date().toISOString().split('T')[0];
    const totalAmount = parseFloat(amount) || 0;

    if (!category) {
      return res.status(400).json({ error: 'Expense category is required.' });
    }
    if (totalAmount <= 0) {
      return res.status(400).json({ error: 'A valid expense amount (> ₱0) is required.' });
    }

    // 1. Insert into expenses
    const { data: expData, error: expErr } = await db
      .from('expenses')
      .insert({
        category,
        amount: totalAmount,
        supplier_name: supplierName || 'General Supplier',
        payment_method: paymentMethod || 'Cash',
        status: paymentStatus || 'Completed',
        date_incurred: resolvedDate,
        description: description || null,
        receipt_no: resolvedReceipt,
      })
      .select()
      .single();

    if (expErr) throw expErr;

    // 2. Handle linked inventory items (inventory_purchases + inventory_transactions + stock update)
    if (Array.isArray(inventoryItems) && inventoryItems.length > 0) {
      for (const item of inventoryItems) {
        if (!item.itemId || !item.quantityBought) continue;
        const qtyBought = parseFloat(item.quantityBought) || 0;
        const uPrice = parseFloat(item.unitPrice) || 0;
        const subtotal = qtyBought * uPrice;

        // Insert inventory_purchases (subtotal is computed/generated by postgres)
        const { data: purchaseData, error: purErr } = await db
          .from('inventory_purchases')
          .insert({
            expense_id: expData.expense_id,
            item_id: item.itemId,
            quantity_bought: qtyBought,
            unit_price: uPrice,
            batch_number: item.batchNumber || null,
            expiration_date: item.expirationDate || null,
            purchase_date: resolvedDate,
          })
          .select()
          .single();

        if (purErr) {
          console.warn('[Transactions] inventory_purchases insert note:', purErr.message);
        }

        // Fetch current stock
        const { data: curItem } = await db
          .from('inventory_items')
          .select('item_id, item_name, current_stock_level, unit_of_measure')
          .eq('item_id', item.itemId)
          .single();

        if (curItem) {
          const newStock = Number((Number(curItem.current_stock_level || 0) + qtyBought).toFixed(4));

          // Update stock level and unit_cost on inventory_items
          await db
            .from('inventory_items')
            .update({
              current_stock_level: newStock,
              unit_cost: uPrice > 0 ? uPrice : undefined,
              last_updated_at: new Date().toISOString(),
            })
            .eq('item_id', item.itemId);

          // Log in inventory_transactions with purchase_id
          await db.from('inventory_transactions').insert({
            item_id: item.itemId,
            purchase_id: purchaseData?.purchase_id || null,
            transaction_type: 'RESTOCK',
            quantity: qtyBought,
            notes: `Purchased from ${supplierName || 'supplier'} (${resolvedReceipt}) • By: ${creatorName}`,
          });
        }
      }
    }

    // 3. Log in activity_logs
    try {
      await db.from('activity_logs').insert({
        user_name: creatorName,
        user_email: 'admin@swinesync.com',
        event_title: 'Expense Recorded',
        event_desc: `Recorded expense #${resolvedReceipt} (${category}: ₱${totalAmount.toLocaleString('en-PH')}) from ${supplierName || 'Supplier'}.`,
        status: 'SUCCESS',
        user_bg_color: 'bg-slate-100 text-slate-700',
      });
    } catch (_) {}

    res.json({ message: 'Expense recorded successfully', data: expData });
  } catch (err) {
    console.error('Error recording expense:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/transactions/sale ────────────────────────────────────────────
// Records a swine sale and automatically updates herd state (archives sold pigs / deducts batch headcount)
router.post('/api/transactions/sale', async (req, res) => {
  try {
    const {
      buyerName,
      category = 'Finisher hogs',
      paymentMethod = 'Cash',
      paymentStatus = 'Completed',
      transactionDate,
      notes,
      receiptNo,
      creator,
      items = [], // [{ pigId, batchId, itemDescription, quantitySold, saleWeight, unitPrice }]
    } = req.body;

    const { name: creatorName } = getCreatorDetails(creator);
    const resolvedReceipt = receiptNo?.trim() || generateTxCode('TX');
    const resolvedDate = transactionDate || new Date().toISOString().split('T')[0];

    if (!buyerName?.trim()) {
      return res.status(400).json({ error: 'Buyer / Client name is required.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one swine or batch must be selected for the sale.' });
    }

    // Compute total price from line items (Real farm flow: priced strictly per kilogram)
    let totalPrice = 0;
    const validatedLines = items.map((line) => {
      const qty = parseInt(line.quantitySold) || 1;
      const weight = line.saleWeight ? parseFloat(line.saleWeight) : null;
      // unitPrice represents price per kg (PHP/kg)
      const rate = parseFloat(line.pricePerKg || line.unitPrice) || 0;
      const subtotal = weight && weight > 0
        ? Number((weight * rate).toFixed(2))
        : Number((qty * rate).toFixed(2));
      totalPrice += subtotal;
      return {
        pigId: line.pigId || null,
        batchId: line.batchId || null,
        itemDescription: line.itemDescription || line.name || (line.pigId ? 'Breeding Sow (Culled)' : 'Swine Batch'),
        quantitySold: qty,
        saleWeight: weight,
        unitPrice: rate,
        subtotal,
      };
    });

    // Auto-derive category if omitted or generic
    let resolvedCategory = category;
    if (!resolvedCategory || resolvedCategory === 'Swine Sale' || resolvedCategory === 'Finisher hogs') {
      const hasPig = validatedLines.some((l) => l.pigId);
      if (hasPig) {
        resolvedCategory = 'Breeding sows (Culled)';
      } else {
        resolvedCategory = category || 'Finisher hogs';
      }
    }

    // 1. Insert into sales_transactions
    let saleData = null;
    const { data: insertedSale, error: saleErr } = await db
      .from('sales_transactions')
      .insert({
        receipt_no: resolvedReceipt,
        buyer_name: buyerName.trim(),
        category: resolvedCategory,
        total_price: totalPrice,
        payment_method: paymentMethod || 'Cash',
        status: paymentStatus || 'Completed',
        transaction_date: resolvedDate,
        notes: notes || null,
      })
      .select()
      .single();

    if (saleErr) {
      console.warn('[Transactions] Warning: sales_transactions insert failed:', saleErr.message);
      console.warn('[Transactions] Run "GRANT ALL ON TABLE public.sales_transactions, public.sold_swine TO anon, authenticated, service_role;" in Supabase SQL editor.');
    } else {
      saleData = insertedSale;
    }

    const createdSaleId = saleData?.sale_id;

    // 2. Insert line items into sold_swine & update herd records
    for (const line of validatedLines) {
      // Insert line item if table is accessible
      if (createdSaleId) {
        try {
          await db.from('sold_swine').insert({
            sale_id: createdSaleId,
            pig_id: line.pigId,
            batch_id: line.batchId,
            item_description: line.itemDescription,
            quantity_sold: line.quantitySold,
            sale_weight: line.saleWeight,
            unit_price: line.unitPrice,
            subtotal: line.subtotal,
          });
        } catch (e) {
          console.warn('[Transactions] sold_swine insert note:', e.message);
        }
      }

      // Individual Sow / Boar Sold: Soft archive the pig
      if (line.pigId) {
        await db
          .from('pigs')
          .update({
            is_archived: true,
            archived_at: new Date().toISOString(),
            archive_reasoning: `Sold / Marketed to ${buyerName.trim()} (${resolvedReceipt})`,
          })
          .eq('pig_id', line.pigId);
      }

      // Batch Piglets / Finishers Sold: Deduct current_count
      if (line.batchId) {
        const { data: batch } = await db
          .from('piglet_batches')
          .select('batch_id, batch_tag, current_count, total_born_alive')
          .eq('batch_id', line.batchId)
          .single();

        if (batch) {
          const currentCount = batch.current_count !== null && batch.current_count !== undefined
            ? Number(batch.current_count)
            : Number(batch.total_born_alive || 0);
          const remaining = Math.max(0, currentCount - line.quantitySold);
          const shouldArchive = remaining === 0;

          await db
            .from('piglet_batches')
            .update({
              current_count: remaining,
              is_archived: shouldArchive ? true : false,
              archived_at: shouldArchive ? new Date().toISOString() : null,
              archive_reasoning: shouldArchive ? `Sold Out - Batch Fully Liquidated to ${buyerName.trim()} (${resolvedReceipt})` : null,
            })
            .eq('batch_id', line.batchId);

          // Clean up pending growth tasks if batch is fully liquidated
          if (shouldArchive) {
            try {
              await db
                .from('growth_tasks')
                .delete()
                .eq('batch_id', line.batchId)
                .eq('status', 'pending');
            } catch (_) {}
          }

          // Log in batch_activity_logs
          try {
            await db.from('batch_activity_logs').insert({
              batch_id: line.batchId,
              activity_type: 'SALE',
              amount_given: line.quantitySold,
              performed_by: creatorName,
              notes: `Sold ${line.quantitySold} head(s) to ${buyerName.trim()} (${resolvedReceipt}) • Remaining: ${remaining}`,
            });
          } catch (_) {}
        }
      }
    }

    // 3. Fallback record if Postgres table had permission block
    const fallbackRecord = {
      id: resolvedReceipt,
      rawId: createdSaleId || `temp-${Date.now()}`,
      date: formatDateDisplay(resolvedDate),
      time: formatTimeDisplay(new Date()),
      createdAt: new Date().toISOString(),
      rawDate: resolvedDate,
      type: 'Sale',
      party: buyerName.trim(),
      category: resolvedCategory,
      amount: totalPrice,
      status: paymentStatus || 'Completed',
      method: paymentMethod || 'Cash',
      items: validatedLines.map((l) => ({
        name: l.itemDescription,
        qty: l.quantitySold,
        price: l.unitPrice,
        subtotal: l.subtotal,
        weight: l.saleWeight,
      })),
      linked: validatedLines
        .map((l) => (l.batchId ? `${l.quantitySold} head(s) deducted from batch` : 'Sow archived as sold'))
        .join(', '),
      notes: notes || '',
    };

    if (!createdSaleId) {
      localSalesFallback.unshift(fallbackRecord);
    }

    // 4. Log in activity_logs
    try {
      await db.from('activity_logs').insert({
        user_name: creatorName,
        user_email: 'admin@swinesync.com',
        event_title: 'Swine Sale Recorded',
        event_desc: `Sold swine to ${buyerName.trim()} for ₱${totalPrice.toLocaleString('en-PH')} (${resolvedReceipt}).`,
        status: 'SUCCESS',
        user_bg_color: 'bg-emerald-100 text-emerald-700',
      });
    } catch (_) {}

    res.json({ message: 'Swine sale recorded successfully', data: saleData || fallbackRecord });
  } catch (err) {
    console.error('Error recording sale:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/transactions/:type/:id ──────────────────────────────────────
// Updates payment status (e.g. Pending -> Completed) or transaction notes
router.patch('/api/transactions/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const { status, notes, creator } = req.body;
    const { name: creatorName } = getCreatorDetails(creator);

    if (type === 'Sale') {
      const updateData = {};
      if (status) updateData.status = status;
      if (notes !== undefined) updateData.notes = notes;

      const { data, error } = await db
        .from('sales_transactions')
        .update(updateData)
        .eq('sale_id', id)
        .select()
        .single();

      if (error) throw error;
      return res.json({ message: 'Sale updated successfully', data });
    } else {
      // Expense
      const updateData = {};
      if (status) updateData.status = status;
      if (notes !== undefined) updateData.description = notes;

      const { data, error } = await db
        .from('expenses')
        .update(updateData)
        .eq('expense_id', id)
        .select()
        .single();

      if (error) throw error;
      return res.json({ message: 'Expense updated successfully', data });
    }
  } catch (err) {
    console.error('Error updating transaction:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;

