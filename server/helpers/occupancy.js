import { supabase } from '../supabaseClient.js';

// Helper: current occupancy for a single pen = active pigs assigned to it
// + the head count of active piglet batches assigned to it (unless it's a Sow Pen, where only sows count toward capacity).
export async function getPenOccupancy(penId) {
  const [pigsRes, batchesRes, penRes] = await Promise.all([
    supabase.from('pigs').select('*', { count: 'exact', head: true }).eq('pen_id', penId).eq('is_archived', false),
    supabase.from('piglet_batches').select('current_count').eq('pen_id', penId).eq('is_archived', false),
    supabase.from('pens').select('section, pen_code').eq('pen_id', penId).maybeSingle(),
  ]);
  const pigCount = pigsRes.count ?? 0;
  
  const pen = penRes.data || {};
  const isSowPen = pen.section === 'S' || (pen.pen_code && pen.pen_code.toUpperCase().startsWith('S'));
  
  const batchCount = isSowPen ? 0 : (batchesRes.data || []).reduce((sum, b) => sum + (b.current_count || 0), 0);
  return pigCount + batchCount;
}

// Helper: occupancy for ALL pens at once, as a Map<pen_id, occupiedCount>.
// Used by /api/pens/available so we don't run one query per pen.
export async function getAllPenOccupancy() {
  const [pigsRes, batchesRes, pensRes] = await Promise.all([
    supabase.from('pigs').select('pen_id').eq('is_archived', false),
    supabase.from('piglet_batches').select('pen_id, current_count').eq('is_archived', false),
    supabase.from('pens').select('pen_id, section, pen_code'),
  ]);

  const sowPenIds = new Set();
  for (const p of pensRes.data || []) {
    const isSowPen = p.section === 'S' || (p.pen_code && p.pen_code.toUpperCase().startsWith('S'));
    if (isSowPen) sowPenIds.add(p.pen_id);
  }

  const occupancy = new Map();
  for (const pig of pigsRes.data || []) {
    if (!pig.pen_id) continue;
    occupancy.set(pig.pen_id, (occupancy.get(pig.pen_id) || 0) + 1);
  }
  for (const batch of batchesRes.data || []) {
    if (!batch.pen_id) continue;
    if (sowPenIds.has(batch.pen_id)) continue; // Do not count piglet batches against Sow Pen capacity
    occupancy.set(batch.pen_id, (occupancy.get(batch.pen_id) || 0) + (batch.current_count || 0));
  }
  return occupancy;
}
