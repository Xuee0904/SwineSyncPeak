/**
 * Helper to deduct stock from inventory_items and record an audit transaction in inventory_transactions.
 */
export async function deductInventoryStock({
  db,
  itemId,
  quantity,
  notes,
  performedBy = 'System',
  userId = null
}) {
  if (!itemId) return null;
  const numQty = parseFloat(quantity);
  if (isNaN(numQty) || numQty <= 0) return null;

  try {
    // 1. Fetch current item stock
    const { data: item, error: fetchErr } = await db
      .from('inventory_items')
      .select('item_id, item_name, current_stock_level, low_stock_threshold, unit_of_measure')
      .eq('item_id', itemId)
      .single();

    if (fetchErr || !item) {
      console.warn(`[Inventory] Item ${itemId} not found for deduction:`, fetchErr?.message);
      return null;
    }

    const currentStock = Number(item.current_stock_level) || 0;
    const roundedQty = Number(numQty.toFixed(4));
    // Stock cannot go below zero in physical terms; clamp at 0
    const newStock = Math.max(0, Number((currentStock - roundedQty).toFixed(4)));

    // 2. Update inventory_items
    const { error: updateErr } = await db
      .from('inventory_items')
      .update({
        current_stock_level: newStock,
        last_updated_at: new Date().toISOString()
      })
      .eq('item_id', itemId);

    if (updateErr) {
      console.error(`[Inventory] Failed to update stock for item ${itemId}:`, updateErr.message);
      throw updateErr;
    }

    // 3. Log into inventory_transactions
    const formattedNotes = notes || `Stock deducted (${roundedQty} ${item.unit_of_measure}) • By: ${performedBy}`;
    const { data: tx, error: txErr } = await db
      .from('inventory_transactions')
      .insert({
        item_id: itemId,
        transaction_type: 'USAGE',
        quantity: roundedQty,
        user_id: userId,
        notes: formattedNotes
      })
      .select()
      .single();

    if (txErr) {
      console.warn(`[Inventory] Failed to log transaction for ${itemId}:`, txErr.message);
    }

    // 4. Low stock alert in activity logs if threshold reached
    if (newStock <= Number(item.low_stock_threshold || 0) && currentStock > Number(item.low_stock_threshold || 0)) {
      await db.from('activity_logs').insert({
        user_name: 'Inventory Monitor',
        user_email: 'inventory@swinesync.ag',
        event_title: 'Low Stock Alert',
        event_desc: `${item.item_name} reached low stock threshold (${newStock} ${item.unit_of_measure} remaining).`,
        status: 'WARNING',
        user_bg_color: 'bg-amber-100 text-amber-700'
      }).then(() => {}).catch(() => {});
    }

    return {
      success: true,
      item,
      previousStock: currentStock,
      newStock,
      quantityDeducted: roundedQty,
      transaction: tx
    };
  } catch (err) {
    console.error(`[Inventory] Error deducting stock:`, err.message);
    throw err;
  }
}

