import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  PiggyBank, AlertTriangle, Activity, Download, Plus,
  Search, ChevronLeft, ChevronRight, MoreVertical, RefreshCw,
  X, Grid3X3, AlertCircle,
} from 'lucide-react';
import AddPigModal from '../components/SwineManagement/AddPigModal.jsx';
import EditPigModal from '../components/SwineManagement/EditPigModal.jsx'; // NEW IMPORT

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const PAGE_SIZE = 5;

function StatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  const map = {
    healthy:     'bg-emerald-100 text-emerald-700 border-emerald-200',
    sick:        'bg-rose-100 text-rose-700 border-rose-200',
    medical:     'bg-rose-100 text-rose-700 border-rose-200',
    quarantine:  'bg-amber-100 text-amber-700 border-amber-200',
    reserved:    'bg-slate-100 text-slate-600 border-slate-200',
    stable:      'bg-teal-100  text-teal-700  border-teal-200',
    active:      'bg-emerald-100 text-emerald-700 border-emerald-200',
    suckling:    'bg-sky-100 text-sky-700 border-sky-200',
    weaned:      'bg-indigo-100 text-indigo-700 border-indigo-200',
    transferred: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  const cls = map[s] || 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide ${cls}`}>
      {status || '—'}
    </span>
  );
}

function StatCard({ icon, label, value, badge, badgeColor, accentColor, bg, loading }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-100 shadow-sm ${bg || 'bg-white'} p-5 flex items-center gap-4`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${accentColor || 'bg-slate-50'}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
        {loading ? (
          <div className="h-7 w-16 bg-slate-100 rounded-lg animate-pulse mt-1" />
        ) : (
          <p className="text-2xl font-black text-slate-900 leading-tight">{value?.toLocaleString() ?? '—'}</p>
        )}
      </div>
      {badge && (
        <span className={`absolute top-3 right-3 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest ${badgeColor || 'bg-slate-100 text-slate-500'}`}>
          {badge}
        </span>
      )}
    </div>
  );
}

function TableSkeleton({ rows = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="animate-pulse border-b border-slate-50">
          <td className="py-3 px-4"><div className="h-4 w-24 bg-slate-100 rounded" /></td>
          <td className="py-3 px-4"><div className="h-4 w-20 bg-slate-100 rounded" /></td>
          <td className="py-3 px-4"><div className="h-4 w-10 bg-slate-100 rounded" /></td>
          <td className="py-3 px-4"><div className="h-4 w-16 bg-slate-100 rounded" /></td>
          <td className="py-3 px-4"><div className="h-4 w-12 bg-slate-100 rounded" /></td>
          <td className="py-3 px-4"><div className="h-5 w-14 bg-slate-100 rounded-full" /></td>
          <td className="py-3 px-4"><div className="h-4 w-6 bg-slate-100 rounded" /></td>
        </tr>
      ))}
    </>
  );
}

export default function SwineManagement({ activeSubTab }) {
  const [stats,        setStats]        = useState({ total: 0, pregnant: 0, sick: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  const [swineList,    setSwineList]    = useState([]);
  const [listLoading,  setListLoading]  = useState(true);
  const [listError,    setListError]    = useState(null);
  const [totalCount,   setTotalCount]   = useState(0);

  const [pens,         setPens]         = useState([]);
  const [filterPen,    setFilterPen]    = useState('all');
  const [filterCat,    setFilterCat]    = useState('all');
  const [searchInput,  setSearchInput]  = useState('');
  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState(1);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); // NEW
  const [selectedPig, setSelectedPig] = useState(null); // NEW

  const [openMenuId,   setOpenMenuId]   = useState(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.swine-action-container')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/api/pigs/stats`);
      const data = await res.json();
      setStats({
        total:    data.total    ?? 0,
        pregnant: data.pregnant ?? 0,
        sick:     data.sick     ?? 0,
      });
    } catch {
      // Fail silently and keep defaults
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchPens = useCallback(async () => {
    try {
      const res  = await fetch(`${API_BASE}/api/pens`);
      const data = await res.json();
      setPens(data.data ?? []);
    } catch {
      // Fail silently
    }
  }, []);

  const fetchSwine = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search    && search    !== '')    params.set('search',   search);
      if (filterPen && filterPen !== 'all') params.set('pen',      filterPen);
      if (filterCat && filterCat !== 'all') params.set('category', filterCat);

      const res = await fetch(`${API_BASE}/api/pigs?${params}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setSwineList(data.data  ?? []);
      setTotalCount(data.count ?? 0);
    } catch (err) {
      setListError(err.message || 'Failed to load swine data.');
    } finally {
      setListLoading(false);
    }
  }, [page, search, filterPen, filterCat]);

  const handleSavePig = async (pigData) => {
    const res = await fetch(`${API_BASE}/api/pigs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pigData),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Failed to save pig (status ${res.status})`);
    }
    fetchSwine();
    fetchStats();
  };

  const handleSaveBatch = async (batchData) => {
    const res = await fetch(`${API_BASE}/api/pigs/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batchData),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Failed to save batch (status ${res.status})`);
    }
    fetchSwine();
    fetchStats();
  };

  // NEW: Update Pig Logic
  const handleUpdatePig = async (id, updatedData) => {
    const res = await fetch(`${API_BASE}/api/pigs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Failed to update record (status ${res.status})`);
    }
    fetchSwine();
    fetchStats();
  };

  useEffect(() => { fetchStats(); fetchPens(); }, [fetchStats, fetchPens]);
  useEffect(() => { fetchSwine(); }, [fetchSwine]);

  useEffect(() => { setPage(1); }, [search, filterPen, filterCat]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  if (activeSubTab === 'pen_management') {
    return (
      <div className="p-5 lg:p-6 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Pen Management</h2>
            <p className="text-xs text-slate-400 mt-0.5">Configure pens, assign capacity &amp; view occupancy</p>
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
            id="add-pen-btn"
          >
            <Plus className="w-3.5 h-3.5" /> Add Pen
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pens.length === 0 ? (
            <div className="col-span-full bg-white border border-dashed border-slate-200 rounded-2xl p-10 text-center">
              <Grid3X3 className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-500">No pens configured</p>
              <p className="text-xs text-slate-400 mt-1">Pens will appear here once added to the database.</p>
            </div>
          ) : (
            pens.map(pen => (
              <div key={pen.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <Grid3X3 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <button className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 cursor-pointer">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm font-bold text-slate-800">{pen.name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">ID: {pen.id}</p>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 lg:p-6 space-y-5 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<PiggyBank className="w-6 h-6 text-emerald-600" />}
          label="Total Swine"
          value={stats.total}
          badge="SWINE"
          badgeColor="bg-emerald-100 text-emerald-700"
          accentColor="bg-emerald-50"
          loading={statsLoading}
        />
        <StatCard
          icon={<Activity className="w-6 h-6 text-amber-500" />}
          label="Sows"
          value={stats.pregnant}
          badge="FEMALE"
          badgeColor="bg-amber-100 text-amber-600"
          accentColor="bg-amber-50"
          loading={statsLoading}
        />
        <StatCard
          icon={<AlertTriangle className="w-6 h-6 text-rose-600" />}
          label="Sick Alert"
          value={stats.sick}
          badge="CRITICAL"
          badgeColor="bg-rose-500 text-white"
          accentColor="bg-rose-50"
          bg="bg-rose-50/60"
          loading={statsLoading}
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-4 border-b border-slate-50">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-sm font-bold text-slate-800">Swine List</h3>
            <div className="flex items-center gap-2">
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                id="swine-export-btn"
              >
                <Download className="w-3.5 h-3.5" /> Export
              </button>
              
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer"
                id="add-swine-btn"
              >
                <Plus className="w-3.5 h-3.5" /> Add new swine
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 mt-4">
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Filter by Pen</label>
              <select
                value={filterPen}
                onChange={e => setFilterPen(e.target.value)}
                className="text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer transition-colors"
                id="pen-filter-select"
              >
                <option value="all">All Pens</option>
                {pens.map(p => (
                  <option key={p.id} value={String(p.id)}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Filter by Category</label>
              <select
                value={filterCat}
                onChange={e => setFilterCat(e.target.value)}
                className="text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer transition-colors"
                id="category-filter-select"
              >
                <option value="all">All Categories</option>
                <option value="sow">Sow</option>
                <option value="boar">Boar</option>
                <option value="piglet_batch">Piglet Batch</option>
              </select>
            </div>

            <div className="flex flex-col gap-0.5 ml-auto">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Search</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="Search by tag…"
                  className="pl-8 pr-8 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-colors w-44"
                  id="swine-search-input"
                />
                {searchInput && (
                  <button
                    onClick={() => setSearchInput('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-50">
                {['Swine ID', 'Breed', 'Age (Weeks)', 'Current Weight', 'Pig Category', 'Status', 'Actions'].map(h => (
                  <th key={h} className="py-2.5 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listLoading ? (
                <TableSkeleton rows={PAGE_SIZE} />
              ) : listError ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-rose-500" />
                      </div>
                      <p className="text-xs font-semibold text-slate-500">{listError}</p>
                      <button
                        onClick={fetchSwine}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                      >
                        Try again
                      </button>
                    </div>
                  </td>
                </tr>
              ) : swineList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                        <PiggyBank className="w-5 h-5 text-slate-300" />
                      </div>
                      <p className="text-xs font-semibold text-slate-400">No swine match your filters</p>
                      <button
                        onClick={() => { setFilterPen('all'); setFilterCat('all'); setSearchInput(''); }}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                      >
                        Clear filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                swineList.map((pig, idx) => (
                  <tr
                    key={pig.id ?? idx}
                    className="border-b border-slate-50 hover:bg-slate-50/70 transition-colors group"
                  >
                    <td className="py-3 px-4">
                      <span className="text-xs font-bold text-emerald-600 group-hover:text-emerald-700 transition-colors">
                        #{pig.pig_tag ?? pig.id ?? '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-semibold text-slate-700">{pig.breed ?? '—'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-semibold text-slate-700">
                        {pig.age_weeks ?? '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-bold text-slate-800">
                        {pig.current_weight != null
                          ? `${Number(pig.current_weight).toFixed(1)} kg`
                          : '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-bold text-slate-600">
                        {pig.category ?? '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={pig.status} />
                    </td>
                    <td className="py-3 px-4 swine-action-container">
                      <div className="relative inline-block">
                        <button
                          onClick={() => setOpenMenuId(prev => prev === (pig.id ?? idx) ? null : (pig.id ?? idx))}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                          id={`swine-action-${pig.id ?? idx}`}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {openMenuId === (pig.id ?? idx) && (
                          <div className="absolute right-0 top-full mt-1 z-20 w-36 bg-white rounded-xl shadow-lg border border-slate-100 py-1 text-xs font-semibold text-slate-700 overflow-hidden">
                            <button className="w-full text-left px-3.5 py-2 hover:bg-slate-50 transition-colors cursor-pointer">View Details</button>
                            
                            {/* CONNECTED: Edit Button */}
                            <button 
                              onClick={() => { setSelectedPig(pig); setIsEditModalOpen(true); setOpenMenuId(null); }}
                              className="w-full text-left px-3.5 py-2 hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                              Edit Record
                            </button>

                            <button className="w-full text-left px-3.5 py-2 hover:bg-rose-50 text-rose-600 transition-colors cursor-pointer">Archive</button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-50">
          <p className="text-[11px] font-semibold text-slate-400">
            {listLoading
              ? 'Loading…'
              : `Showing ${totalCount === 0 ? 0 : Math.min((page - 1) * PAGE_SIZE + 1, totalCount)}–${Math.min(page * PAGE_SIZE, totalCount)} of ${totalCount.toLocaleString()} Swine`}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || listLoading}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              id="swine-prev-page-btn"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pg;
              if (totalPages <= 5)         pg = i + 1;
              else if (page <= 3)          pg = i + 1;
              else if (page >= totalPages - 2) pg = totalPages - 4 + i;
              else                         pg = page - 2 + i;
              return (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  disabled={listLoading}
                  className={[
                    'w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer',
                    pg === page
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'border border-slate-200 text-slate-600 hover:bg-slate-50',
                    listLoading ? 'opacity-60 cursor-not-allowed' : '',
                  ].join(' ')}
                  id={`swine-page-${pg}-btn`}
                >
                  {pg}
                </button>
              );
            })}

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || listLoading}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              id="swine-next-page-btn"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <AddPigModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSavePig}
        onSaveBatch={handleSaveBatch}
        pens={pens}
      />

      {/* RENDER: Edit Modal */}
      <EditPigModal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setSelectedPig(null); }}
        onSave={handleUpdatePig}
        pigData={selectedPig}
      />
    </div>
  );
}