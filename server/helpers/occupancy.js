import { supabase, supabaseAdmin } from '../supabaseClient.js';

const db = supabaseAdmin || supabase;

// Helper: current occupancy for a single pen = active pigs assigned to it
// + the head count of active piglet batches assigned to it (unless it's a Sow Pen, where only sows count toward capacity).
export async function getPenOccupancy(penId) {
  const [pigsRes, batchesRes, penRes] = await Promise.all([
    db.from('pigs').select('pen_id, gender, status').eq('pen_id', penId).eq('is_archived', false),
    db.from('piglet_batches').select('current_count').eq('pen_id', penId).eq('is_archived', false),
    db.from('pens').select('pen_id, pen_code, pen_type, max_capacity').eq('pen_id', penId).maybeSingle(),
  ]);
  const pigs = pigsRes.data || [];
  const pigCount = pigs.length;
  
  let sowCount = 0;
  let boarCount = 0;
  for (const pig of pigs) {
    const isFemale = pig.gender === 'Female' || pig.status?.toLowerCase() === 'sow';
    const isMale = pig.gender === 'Male' || pig.status?.toLowerCase() === 'boar';
    if (isFemale) sowCount++;
    if (isMale) boarCount++;
  }
  
  const pen = penRes.data || {};
  const penSection = pen.pen_type || (pen.pen_code && pen.pen_code.toUpperCase().startsWith('S') ? 'S' : '');
  const isSowPen = penSection === 'S' || penSection === 'SOW';

  const batchCount = (batchesRes.data || []).reduce((sum, b) => sum + (b.current_count || 0), 0);
  return {
    total: pigCount + (isSowPen ? 0 : batchCount),
    pigCount,
    sowCount,
    boarCount,
    batchCount,
    hasSow: sowCount > 0,
    hasBoar: boarCount > 0,
  };
}

// Helper: occupancy for ALL pens at once, as a Map<pen_id, occupancyDetails>.
// Used by /api/pens/available and /api/pens/all so we don't run one query per pen.
export async function getAllPenOccupancy() {
  const [pigsRes, batchesRes, pensRes] = await Promise.all([
    db.from('pigs').select('pen_id, gender, status').eq('is_archived', false),
    db.from('piglet_batches').select('pen_id, current_count').eq('is_archived', false),
    db.from('pens').select('pen_id, pen_code, pen_type, max_capacity'),
  ]);

  const occupancy = new Map();
  const getOrCreate = (id) => {
    const key = String(id);
    if (!occupancy.has(key)) {
      occupancy.set(key, { total: 0, pigCount: 0, sowCount: 0, boarCount: 0, batchCount: 0 });
    }
    return occupancy.get(key);
  };

  for (const pig of pigsRes.data || []) {
    if (!pig.pen_id) continue;
    const occ = getOrCreate(pig.pen_id);
    occ.pigCount += 1;
    occ.total += 1;
    const isFemale = pig.gender === 'Female' || pig.status?.toLowerCase() === 'sow';
    const isMale = pig.gender === 'Male' || pig.status?.toLowerCase() === 'boar';
    if (isFemale) occ.sowCount += 1;
    if (isMale) occ.boarCount += 1;
  }

  for (const batch of batchesRes.data || []) {
    if (!batch.pen_id) continue;
    const occ = getOrCreate(batch.pen_id);
    const count = batch.current_count || 0;
    occ.batchCount += count;
    
    // We need pen_type to know if it's a Sow Pen
    const pen = pensRes.data?.find(p => String(p.pen_id) === String(batch.pen_id)) || {};
    const penSection = pen.pen_type || (pen.pen_code && pen.pen_code.toUpperCase().startsWith('S') ? 'S' : '');
    const isSowPen = penSection === 'S' || penSection === 'SOW';
    
    if (!isSowPen) {
      occ.total += count;
    }
  }

  return occupancy;
}
