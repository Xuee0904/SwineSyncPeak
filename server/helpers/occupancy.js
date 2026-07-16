import { supabase } from '../supabaseClient.js';

// Helper: current occupancy for a single pen = active pigs assigned to it
// + the head count of active piglet batches assigned to it.
export async function getPenOccupancy(penId) {
  const [pigsRes, batchesRes] = await Promise.all([
    supabase.from('pigs').select('*', { count: 'exact', head: true }).eq('pen_id', penId).eq('is_archived', false),
    supabase.from('piglet_batches').select('current_count').eq('pen_id', penId).eq('is_archived', false),
  ]);
  const pigCount = pigsRes.count ?? 0;
  const batchCount = (batchesRes.data || []).reduce((sum, b) => sum + (b.current_count || 0), 0);
  return pigCount + batchCount;
}

// Helper: occupancy for ALL pens at once, as a Map<pen_id, occupiedCount>.
// Used by /api/pens/available so we don't run one query per pen.
export async function getAllPenOccupancy() {
  const [pigsRes, batchesRes] = await Promise.all([
    supabase.from('pigs').select('pen_id').eq('is_archived', false),
    supabase.from('piglet_batches').select('pen_id, current_count').eq('is_archived', false),
  ]);

  const occupancy = new Map();
  for (const pig of pigsRes.data || []) {
    if (!pig.pen_id) continue;
    occupancy.set(pig.pen_id, (occupancy.get(pig.pen_id) || 0) + 1);
  }
  for (const batch of batchesRes.data || []) {
    if (!batch.pen_id) continue;
    occupancy.set(batch.pen_id, (occupancy.get(batch.pen_id) || 0) + (batch.current_count || 0));
  }
  return occupancy;
}
