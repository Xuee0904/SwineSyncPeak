// ─────────────────────────────────────────────────────────────────────────────
// Farm Layout – physical map of the client's farm.
//
// This is the ONLY file that needs to change if the physical farm changes.
// Coordinates (x, y, w, h) are expressed in grid units; the renderer multiplies
// them by UNIT so pen tiles stay proportional to the real pens
// (weaned pens ≈ 2× a sow pen).
//
// Pens are linked to database records by `code`. The database stores what
// changes day-to-day (section/type, capacity, occupancy, out-of-service).
// The defaults below are only used when initializing a missing pen.
// ─────────────────────────────────────────────────────────────────────────────

export const UNIT = { x: 76, y: 64 }; // px per grid unit

// Default capacities per pen type
export const DEFAULT_CAPACITY = { W: 20, S: 20, Q: 20, B: 1 };

const W = (code, x, y, w = 2, h = 1) => ({ code, x, y, w, h, defaultSection: "W", defaultCapacity: DEFAULT_CAPACITY.W });
const S = (code, x, y, w = 1, h = 1) => ({ code, x, y, w, h, defaultSection: "S", defaultCapacity: DEFAULT_CAPACITY.S });
const Q = (code, x, y, w = 1, h = 1.5) => ({ code, x, y, w, h, defaultSection: "Q", defaultCapacity: DEFAULT_CAPACITY.Q });

// Zone types: "pathway" | "isolation" | "buffer"
export const FARM_LAYOUT = [
  // ── Building 2 (10 pens): isolation zone on top, weaned pens below ─────────
  {
    id: "B2",
    name: "Building 2",
    subtitle: "Isolation & Weaned",
    width: 2.6,
    height: 9.05,
    outline: [[0, 0], [2.6, 0], [2.6, 9.05], [0, 9.05]],
    zones: [
      { type: "isolation", x: 0, y: 0.22, w: 2.6, h: 3.30, label: "Isolation Zone" },
      { type: "pathway", x: 1, y: 0.32, w: 0.6, h: 3.10, vertical: true },
      { type: "buffer", x: 0, y: 3.62, w: 2.6, h: 0.5, label: "Buffer · No pass-through" },
      { type: "pathway", x: 1, y: 4.22, w: 0.6, h: 4.75, label: "Pathway", vertical: true },
    ],
    slots: [
      Q("B2-05", 0, 0.32), Q("B2-06", 1.6, 0.32),
      Q("B2-04", 0, 1.92), Q("B2-07", 1.6, 1.92),
      W("B2-03", 0, 4.22, 1, 1.5), W("B2-08", 1.6, 4.22, 1, 1.5),
      W("B2-02", 0, 5.82, 1, 1.5), W("B2-09", 1.6, 5.82, 1, 1.5),
      W("B2-01", 0, 7.42, 1, 1.5), W("B2-10", 1.6, 7.42, 1, 1.5),
    ],
  },

  // ── Main Building (18 pens): T-shaped ──────────────────────────────────────
  {
    id: "M",
    name: "Main Building",
    subtitle: "Weaned & Sow",
    width: 10,
    height: 8.5,
    // T-shape: long horizontal wing + corner wing on the right
    // Top arm (y=0–3) = 3 units, Bottom arm (y=5.5–8.5) = 3 units — balanced
    outline: [[0, 3], [8, 3], [8, 0], [10, 0], [10, 8.5], [8, 8.5], [8, 5.5], [0, 5.5]],
    zones: [
      { type: "pathway", x: 0, y: 4, w: 9, h: 0.5, label: "Pathway" },
      { type: "pathway", x: 9, y: 0, w: 1, h: 8.5, label: "Pathway", vertical: true },
    ],
    slots: [
      // Corner wing (weaned) — stacked in left column; M-01(h=2) + M-02(h=2) = 4 units above pathway
      W("M-01", 8, 0, 1, 2),
      W("M-02", 8, 2, 1, 2),
      // Long weaned row, left → right
      W("M-06", 0, 3), W("M-05", 2, 3), W("M-04", 4, 3), W("M-03", 6, 3),
      // Sow row, left → right (M-07 to M-15)
      S("M-07", 0, 4.5), S("M-08", 1, 4.5), S("M-09", 2, 4.5), S("M-10", 3, 4.5), S("M-11", 4, 4.5),
      S("M-12", 5, 4.5), S("M-13", 6, 4.5), S("M-14", 7, 4.5), S("M-15", 8, 4.5),
      // Corner sow pens — stacked in left column, below sow row
      S("M-16", 8, 5.5),
      S("M-17", 8, 6.5),
      S("M-18", 8, 7.5),
    ],
  },
];

export const ALL_SLOTS = FARM_LAYOUT.flatMap((b) => b.slots.map((s) => ({ ...s, buildingId: b.id, buildingName: b.name })));
export const LAYOUT_CODES = new Set(ALL_SLOTS.map((s) => s.code));
