import React, { useState } from "react";
import {
  Plus,
  Search,
  MoreVertical,
  CalendarClock,
  Heart,
  AlertTriangle,
  Baby,
} from "lucide-react";

// ---- Domain constants ---------------------------------------------------
// A sow's gestation runs almost exactly 114 days — the "3 months, 3 weeks,
// 3 days" rule every swine farm plans around. Stage markers below sit at
// their REAL day offsets (not evenly spaced), so the timeline itself
// communicates how gestation actually unfolds: a long quiet stretch after
// mating, then everything compresses fast in the last two weeks.
const GESTATION_DAYS = 114;
const STAGES = [
  { day: 0, label: "Mated" },
  { day: 30, label: "30D Check" },
  { day: 60, label: "Mid Preg" },
  { day: 100, label: "Near Farrow" },
  { day: 114, label: "Farrow" },
];

const STATUS_META = {
  pregnant: { label: "Pregnant", color: "var(--pine)", tint: "var(--pine-tint)" },
  monitoring: { label: "Monitoring", color: "var(--slate)", tint: "var(--slate-tint)" },
  action: { label: "Action required", color: "var(--brick)", tint: "var(--brick-tint)" },
};

// ---- Mock data (wire up to your API later) ------------------------------
const INITIAL_SOWS = [
  { id: "A-2041", parity: 3, breed: "Yorkshire Cross", day: 86, status: "pregnant", dueDate: "Oct 24" },
  { id: "B-1102", parity: 1, breed: "Duroc Purebred", day: 24, status: "monitoring", dueDate: "Nov 12" },
  { id: "A-0988", parity: 5, breed: "Berkshire", day: 116, status: "action", dueDate: "Overdue" },
  { id: "C-3350", parity: 2, breed: "Landrace", day: 61, status: "pregnant", dueDate: "Nov 30" },
  { id: "D-1220", parity: 4, breed: "Hampshire", day: 6, status: "monitoring", dueDate: "Dec 20" },
];

function activeStageIndex(day) {
  let idx = 0;
  STAGES.forEach((s, i) => { if (day >= s.day) idx = i; });
  return idx;
}

function GestationRing({ day, status }) {
  const meta = STATUS_META[status];
  const pct = Math.min(100, Math.round((day / GESTATION_DAYS) * 100));
  const r = 26;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const overdue = day > GESTATION_DAYS;

  return (
    <div className="brl-ring">
      <svg viewBox="0 0 64 64" width="60" height="60">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--track)" strokeWidth="5" />
        <circle
          cx="32" cy="32" r={r} fill="none"
          stroke={meta.color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <div className="brl-ring-label">
        <span className="brl-ring-day">{overdue ? GESTATION_DAYS : day}</span>
        <span className="brl-ring-total">/{GESTATION_DAYS}</span>
      </div>
    </div>
  );
}

export default function BreedingLogs() {
  const [sows] = useState(INITIAL_SOWS);
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [openMenu, setOpenMenu] = useState(null);

  const filtered = sows.filter((s) => {
    const matchesFilter = filter === "ALL" || s.status === filter;
    const q = query.trim().toLowerCase();
    const matchesQuery = q === "" || s.id.toLowerCase().includes(q) || s.breed.toLowerCase().includes(q);
    return matchesFilter && matchesQuery;
  });

  const totalPregnant = sows.filter((s) => s.status !== "monitoring").length;
  const dueThisMonth = sows.filter((s) => s.day >= 90 && s.day <= GESTATION_DAYS).length + 15; // mock baseline
  const actionRequired = sows.filter((s) => s.status === "action").length;

  return (
    <div className="brl-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        .brl-root {
          --bg: #F6F7F2;
          --surface: #FFFFFF;
          --border: #E3E6DD;
          --ink: #1C2420;
          --ink-soft: #6B756C;
          --pine: #1F6F54;
          --pine-dark: #15503A;
          --pine-tint: #E3EFE9;
          --slate: #4A6B8A;
          --slate-tint: #E4EAF0;
          --wheat: #C98A3C;
          --wheat-tint: #F7ECD9;
          --brick: #B5473F;
          --brick-tint: #F5E3E1;
          --track: #EAEDE4;
          font-family: 'Inter', sans-serif;
          background: var(--bg);
          color: var(--ink);
          min-height: 100vh;
          padding: 32px 36px 64px;
          box-sizing: border-box;
        }
        .brl-root * { box-sizing: border-box; }

        .brl-header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 26px; flex-wrap: wrap; gap: 16px; }
        .brl-title-row { display: flex; align-items: center; gap: 10px; }
        .brl-title { font-family: 'Fraunces', serif; font-weight: 600; font-size: 30px; letter-spacing: -0.01em; margin: 0; }
        .brl-subtitle { color: var(--ink-soft); font-size: 14.5px; margin: 6px 0 0; }

        .brl-add-btn {
          display: inline-flex; align-items: center; gap: 8px;
          background: var(--pine); color: #fff; border: none;
          padding: 11px 20px; border-radius: 999px; font-weight: 600; font-size: 14.5px;
          cursor: pointer; transition: background 0.15s ease, transform 0.1s ease;
        }
        .brl-add-btn:hover { background: var(--pine-dark); }
        .brl-add-btn:active { transform: scale(0.97); }

        .brl-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; margin-bottom: 28px; }
        .brl-stat { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 16px 18px; display: flex; align-items: center; gap: 12px; }
        .brl-stat-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .brl-stat-value { font-family: 'Fraunces', serif; font-size: 21px; font-weight: 600; line-height: 1.1; }
        .brl-stat-label { font-size: 12.5px; color: var(--ink-soft); margin-top: 2px; }

        .brl-controls { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 22px; flex-wrap: wrap; }
        .brl-chips { display: flex; gap: 8px; flex-wrap: wrap; }
        .brl-chip { border: 1px solid var(--border); background: var(--surface); color: var(--ink-soft); padding: 7px 14px; border-radius: 999px; font-size: 13.5px; font-weight: 500; cursor: pointer; transition: all 0.15s ease; }
        .brl-chip:hover { border-color: var(--pine); color: var(--pine); }
        .brl-chip.active { background: var(--ink); border-color: var(--ink); color: #fff; }

        .brl-search { position: relative; width: 250px; max-width: 100%; }
        .brl-search svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--ink-soft); }
        .brl-search input { width: 100%; padding: 9px 12px 9px 36px; border-radius: 999px; border: 1px solid var(--border); background: var(--surface); font-size: 13.5px; color: var(--ink); }
        .brl-search input:focus { outline: 2px solid var(--pine); outline-offset: 1px; }

        .brl-list { display: flex; flex-direction: column; gap: 14px; }

        .brl-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 18px 20px; display: flex; gap: 18px; align-items: center; transition: box-shadow 0.15s ease, transform 0.15s ease; position: relative; }
        .brl-card:hover { box-shadow: 0 6px 20px rgba(28,36,32,0.07); transform: translateY(-1px); }

        .brl-ring { position: relative; width: 60px; height: 60px; flex-shrink: 0; }
        .brl-ring-label { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; }
        .brl-ring-day { font-family: 'JetBrains Mono', monospace; font-size: 15px; font-weight: 600; }
        .brl-ring-total { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--ink-soft); }

        .brl-card-main { flex: 1; min-width: 0; }
        .brl-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
        .brl-sow-name { font-family: 'Fraunces', serif; font-weight: 600; font-size: 17px; margin: 0; }
        .brl-sow-sub { font-size: 12.5px; color: var(--ink-soft); margin: 2px 0 0; }

        .brl-status-pill { font-size: 11.5px; font-weight: 600; padding: 4px 11px; border-radius: 999px; white-space: nowrap; display: inline-flex; align-items: center; gap: 5px; }
        .brl-pulse-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; animation: brl-pulse 1.6s ease-in-out infinite; }
        @keyframes brl-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.4); } }
        @media (prefers-reduced-motion: reduce) { .brl-pulse-dot { animation: none; } }

        .brl-timeline { position: relative; height: 34px; margin: 4px 0 2px; }
        .brl-timeline-track { position: absolute; top: 14px; left: 0; right: 0; height: 4px; background: var(--track); border-radius: 999px; }
        .brl-timeline-fill { position: absolute; top: 14px; left: 0; height: 4px; border-radius: 999px; }
        .brl-stage { position: absolute; top: 6px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; }
        .brl-stage-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--surface); border: 2px solid var(--track); }
        .brl-stage-dot.done { border-color: transparent; }
        .brl-stage-dot.current { width: 13px; height: 13px; box-shadow: 0 0 0 4px var(--surface); }
        .brl-stage-label { font-size: 10px; color: var(--ink-soft); margin-top: 5px; white-space: nowrap; }
        .brl-stage-label.done { color: var(--ink); font-weight: 500; }

        .brl-card-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; }
        .brl-due { font-size: 12.5px; color: var(--ink-soft); }
        .brl-due strong { color: var(--ink); font-weight: 600; }

        .brl-menu-btn { background: none; border: none; color: var(--ink-soft); cursor: pointer; padding: 4px; border-radius: 6px; display: flex; }
        .brl-menu-btn:hover { background: var(--bg); color: var(--ink); }
        .brl-menu { position: absolute; right: 16px; top: 52px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 8px 24px rgba(28,36,32,0.14); z-index: 10; overflow: hidden; min-width: 150px; }
        .brl-menu button { width: 100%; text-align: left; padding: 9px 13px; font-size: 13.5px; background: none; border: none; cursor: pointer; color: var(--ink); }
        .brl-menu button:hover { background: var(--bg); }

        .brl-ghost { border: 1.5px dashed var(--border); border-radius: 16px; padding: 16px 20px; display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--ink-soft); cursor: pointer; background: transparent; font-size: 13.5px; font-weight: 500; transition: border-color 0.15s ease, color 0.15s ease; }
        .brl-ghost:hover { border-color: var(--pine); color: var(--pine); }

        @media (max-width: 640px) {
          .brl-card { flex-direction: column; align-items: flex-start; }
          .brl-stage-label { display: none; }
        }
      `}</style>

      {/* Header */}
      <div className="brl-header">
        <div>
          <div className="brl-title-row">
            <h1 className="brl-title">Breeding Logs</h1>
          </div>
          <p className="brl-subtitle">Track gestation from mating to farrowing, day by day</p>
        </div>
        <button className="brl-add-btn"><Plus size={16} strokeWidth={2.5} /> Add Farrowing</button>
      </div>

      {/* Stats */}
      <div className="brl-stats">
        <div className="brl-stat">
          <div className="brl-stat-icon" style={{ background: "var(--pine-tint)" }}><Heart size={18} color="var(--pine)" /></div>
          <div>
            <div className="brl-stat-value">{totalPregnant}</div>
            <div className="brl-stat-label">Total pregnant</div>
          </div>
        </div>
        <div className="brl-stat">
          <div className="brl-stat-icon" style={{ background: "var(--wheat-tint)" }}><CalendarClock size={18} color="var(--wheat)" /></div>
          <div>
            <div className="brl-stat-value">{dueThisMonth}</div>
            <div className="brl-stat-label">Expected farrowings, 30d</div>
          </div>
        </div>
        <div className="brl-stat">
          <div className="brl-stat-icon" style={{ background: actionRequired ? "var(--brick-tint)" : "var(--slate-tint)" }}>
            <AlertTriangle size={18} color={actionRequired ? "var(--brick)" : "var(--slate)"} />
          </div>
          <div>
            <div className="brl-stat-value">{actionRequired}</div>
            <div className="brl-stat-label">Needs action now</div>
          </div>
        </div>
        <div className="brl-stat">
          <div className="brl-stat-icon" style={{ background: "var(--slate-tint)" }}><Baby size={18} color="var(--slate)" /></div>
          <div>
            <div className="brl-stat-value">65</div>
            <div className="brl-stat-label">Ready to wean</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="brl-controls">
        <div className="brl-chips">
          <button className={`brl-chip ${filter === "ALL" ? "active" : ""}`} onClick={() => setFilter("ALL")}>All</button>
          <button className={`brl-chip ${filter === "pregnant" ? "active" : ""}`} onClick={() => setFilter("pregnant")}>Pregnant</button>
          <button className={`brl-chip ${filter === "monitoring" ? "active" : ""}`} onClick={() => setFilter("monitoring")}>Monitoring</button>
          <button className={`brl-chip ${filter === "action" ? "active" : ""}`} onClick={() => setFilter("action")}>Action required</button>
        </div>
        <div className="brl-search">
          <Search size={15} />
          <input type="text" placeholder="Search sow ID or breed…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {/* Pipeline list */}
      <div className="brl-list">
        {filtered.map((sow) => {
          const meta = STATUS_META[sow.status];
          const stageIdx = activeStageIndex(sow.day);
          const overdue = sow.day > GESTATION_DAYS;
          const fillPct = Math.min(100, (sow.day / GESTATION_DAYS) * 100);

          return (
            <div className="brl-card" key={sow.id}>
              <GestationRing day={sow.day} status={sow.status} />

              <div className="brl-card-main">
                <div className="brl-card-head">
                  <div>
                    <p className="brl-sow-name">Sow #{sow.id}</p>
                    <p className="brl-sow-sub">{sow.parity === 1 ? "1st" : sow.parity === 2 ? "2nd" : sow.parity === 3 ? "3rd" : `${sow.parity}th`} parity · {sow.breed}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="brl-status-pill" style={{ background: meta.tint, color: meta.color }}>
                      {sow.status === "action" && <span className="brl-pulse-dot" />}
                      {meta.label}
                    </span>
                    <div style={{ position: "relative" }}>
                      <button className="brl-menu-btn" onClick={() => setOpenMenu(openMenu === sow.id ? null : sow.id)}>
                        <MoreVertical size={16} />
                      </button>
                      {openMenu === sow.id && (
                        <div className="brl-menu">
                          <button>View full log</button>
                          <button>Log new check</button>
                          <button>Edit record</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="brl-timeline">
                  <div className="brl-timeline-track" />
                  <div className="brl-timeline-fill" style={{ width: `${fillPct}%`, background: overdue ? "var(--brick)" : meta.color }} />
                  {STAGES.map((stage, i) => {
                    const done = sow.day >= stage.day;
                    const isCurrent = i === stageIdx && !overdue;
                    return (
                      <div key={stage.label} className="brl-stage" style={{ left: `${(stage.day / GESTATION_DAYS) * 100}%` }}>
                        <div
                          className={`brl-stage-dot ${done ? "done" : ""} ${isCurrent ? "current" : ""}`}
                          style={done ? { background: overdue ? "var(--brick)" : meta.color } : {}}
                        />
                        <span className={`brl-stage-label ${done ? "done" : ""}`}>{stage.label}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="brl-card-foot">
                  <span className="brl-due">
                    {overdue
                      ? <>Overdue by <strong style={{ color: "var(--brick)" }}>{sow.day - GESTATION_DAYS} days</strong></>
                      : <>Expected farrowing: <strong>{sow.dueDate}</strong> · {GESTATION_DAYS - sow.day} days to go</>}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        <button className="brl-ghost"><Plus size={16} /> Log a new mating</button>
      </div>
    </div>
  );
}
