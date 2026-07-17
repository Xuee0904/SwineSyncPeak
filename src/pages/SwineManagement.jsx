import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  PiggyBank, AlertTriangle, Activity, Download, Plus,
  Search, ChevronLeft, ChevronRight, MoreVertical, RefreshCw,
  X, Grid3X3, AlertCircle, Edit2, Archive, ArchiveX,
} from 'lucide-react';
import AddPigModal from '../components/SwineManagement/AddPigModal.jsx';
import EditPigModal from '../components/SwineManagement/EditPigModal.jsx';
import ViewPigModal from '../components/SwineManagement/ViewPigModal.jsx';
import useConfirmDialog from '../hooks/useConfirmDialog.jsx';
import toast from '../utils/toast';
import StatusBadge from '../components/StatusBadge.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const PAGE_SIZE = 5;

/**
 * Returns a page number array with windowed ellipsis for clean UX navigation.
 * e.g. [1, '...', 4, 5, 6, '...', 20]
 */
function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  const addPage = (p) => { if (!pages.includes(p)) pages.push(p); };
  addPage(1);
  if (current > 3) pages.push('...');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) addPage(p);
  if (current < total - 2) pages.push('...');
  addPage(total);
  return pages;
}


function StatCard({ icon, label, value, badge, badgeColor, accentColor, bg, loading }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-100 shadow-sm ${bg || 'bg-white'} p-5 flex items-center gap-4`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${accentColor || 'bg-slate-50'}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">{label}</p>
        <div className="flex items-baseline gap-2 mt-0.5">
          {loading ? (
            <div className="h-7 w-16 bg-slate-100 animate-pulse rounded-md" />
          ) : (
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">{value}</h3>
          )}
          {badge && (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${badgeColor || 'bg-slate-100 text-slate-600'}`}>
              {badge}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function TableSkeleton({ rows = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, idx) => (
        <tr key={idx} className="border-b border-slate-50">
          {Array.from({ length: 7 }).map((_, colIdx) => (
            <td key={colIdx} className="py-4 px-4">
              <div className="h-4 bg-slate-100 animate-pulse rounded w-3/4" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function SwineManagement({ loggedInUser = 'Admin', activeSubTab = 'swine_list' }) {
  const [swineList,    setSwineList]    = useState([]);
  const [listLoading,  setListLoading]  = useState(true);
  const [listError,    setListError]    = useState(null);
  const [totalCount,   setTotalCount]   = useState(0);

  const [stats,        setStats]        = useState({ total: 0, pregnant: 0, sick: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  const [pens,         setPens]         = useState([]);
  const [pensLoading,  setPensLoading]  = useState(true);

  const [breeds,       setBreeds]       = useState([]);

  const [filterPen,    setFilterPen]    = useState('all');
  const [filterCat,    setFilterCat]    = useState('all');
  const [filterBreed,  setFilterBreed]  = useState('all');
  const [searchInput,  setSearchInput]  = useState('');
  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState(1);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedPig, setSelectedPig] = useState(null);

  // Reusable confirm dialog hook (portal-based, blurs full page)
  const { confirmDialog, openConfirm } = useConfirmDialog();

  // Archived records view
  const [viewArchived, setViewArchived] = useState(false);
  const [archivedList, setArchivedList] = useState([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archivedTotal, setArchivedTotal] = useState(0);
  const [archivedPage, setArchivedPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const archivedTotalPages = Math.max(1, Math.ceil(archivedTotal / PAGE_SIZE));

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

  const fetchBreeds = useCallback(async () => {
    try {
      const res  = await fetch(`${API_BASE}/api/breeds`);
      const data = await res.json();
      setBreeds(data.data ?? []);
    } catch {
      // Fail silently
    }
  }, []);

  const fetchSwine = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search      && search      !== '')    params.set('search',   search);
      if (filterPen   && filterPen   !== 'all') params.set('pen',      filterPen);
      if (filterCat   && filterCat   !== 'all') params.set('category', filterCat);
      if (filterBreed && filterBreed !== 'all') params.set('breed',    filterBreed);

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
  }, [page, search, filterPen, filterCat, filterBreed]);

  const handleSavePig = async (pigData) => {
    const payload = { ...pigData, creator: loggedInUser };
    const res = await fetch(`${API_BASE}/api/pigs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Failed to save pig (status ${res.status})`);
    }
    fetchSwine();
    fetchStats();
  };

  const handleSaveBatch = async (batchData) => {
    const payload = { ...batchData, creator: loggedInUser };
    const res = await fetch(`${API_BASE}/api/pigs/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
    const payload = { ...updatedData, creator: loggedInUser };
    const res = await fetch(`${API_BASE}/api/pigs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Failed to update record (status ${res.status})`);
    }
    fetchSwine();
    fetchStats();
  };

  // Archive pig — called after the confirm dialog is accepted
  const handleArchivePig = async (pig) => {
    const res = await fetch(`${API_BASE}/api/pigs/${pig.id}/archive`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creator: loggedInUser }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to archive record.');
    toast.success(`#${pig.pig_tag ?? pig.id} has been archived.`);
    setIsViewModalOpen(false);
    setSelectedPig(null);
    fetchSwine();
    fetchStats();
  };

  // Open the confirm dialog for a given pig
  const promptArchive = (pig) => {
    openConfirm({
      title: 'Archive this record?',
      subtitle: `#${pig.pig_tag ?? pig.id}`,
      message: 'This swine will be moved to the Archived view and removed from the active list. You can still view it at any time.',
      confirmLabel: 'Yes, Archive',
      onConfirm: () => handleArchivePig(pig),
    });
  };

  // Fetch archived records
  const fetchArchived = useCallback(async () => {
    setArchivedLoading(true);
    try {
      const params = new URLSearchParams({ page: String(archivedPage), limit: String(PAGE_SIZE) });
      if (search && search !== '') params.set('search', search);
      const res = await fetch(`${API_BASE}/api/pigs/archived?${params}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setArchivedList(data.data ?? []);
      setArchivedTotal(data.count ?? 0);
    } catch {
      setArchivedList([]);
      setArchivedTotal(0);
    } finally {
      setArchivedLoading(false);
    }
  }, [archivedPage, search]);

  useEffect(() => {
    fetchStats();
    fetchPens();
    fetchBreeds();
  }, [fetchStats, fetchPens, fetchBreeds]);
  useEffect(() => { fetchSwine(); }, [fetchSwine]);
  useEffect(() => { if (viewArchived) fetchArchived(); }, [fetchArchived, viewArchived]);

  useEffect(() => { setPage(1); }, [search, filterPen, filterCat, filterBreed]);
  useEffect(() => { setArchivedPage(1); }, [search]);

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
          value={stats?.total ?? 0}
          badge="SWINE"
          badgeColor="bg-emerald-100 text-emerald-700"
          accentColor="bg-emerald-50"
          loading={statsLoading}
        />
        <StatCard
          icon={<Activity className="w-6 h-6 text-amber-500" />}
          label="Sows"
          value={stats?.pregnant ?? 0}
          badge="FEMALE"
          badgeColor="bg-amber-100 text-amber-600"
          accentColor="bg-amber-50"
          loading={statsLoading}
        />
        <StatCard
          icon={<AlertTriangle className="w-6 h-6 text-rose-600" />}
          label="Sick Alert"
          value={stats?.sick ?? 0}
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
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-bold text-slate-800">
                {viewArchived ? 'Archived Records' : 'Swine List'}
              </h3>
              {/* Active / Archived tab toggle */}
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
                <button
                  onClick={() => setViewArchived(false)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                    !viewArchived ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                  id="swine-tab-active"
                >
                  Active
                </button>
                <button
                  onClick={() => setViewArchived(true)}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                    viewArchived ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                  id="swine-tab-archived"
                >
                  <Archive className="w-3 h-3" /> Archived
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                id="swine-export-btn"
              >
                <Download className="w-3.5 h-3.5" /> Export
              </button>
              
              {!viewArchived && (
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer"
                  id="add-swine-btn"
                >
                  <Plus className="w-3.5 h-3.5" /> Add new swine
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 mt-4">
            {!viewArchived && (
              <>
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

                <div className="flex flex-col gap-0.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Filter by Breed</label>
                  <select
                    value={filterBreed}
                    onChange={e => setFilterBreed(e.target.value)}
                    className="text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer transition-colors"
                    id="breed-filter-select"
                  >
                    <option value="all">All Breeds</option>
                    {breeds.map(b => (
                      <option key={b.breed_id || b.name} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

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
                  <th key={h} className={`py-2.5 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap ${h === 'Actions' ? 'text-right pr-6' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(viewArchived ? archivedLoading : listLoading) ? (
                <TableSkeleton rows={PAGE_SIZE} />
              ) : !viewArchived && listError ? (
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
              ) : (viewArchived ? archivedList : swineList).length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                        {viewArchived
                          ? <ArchiveX className="w-5 h-5 text-slate-300" />
                          : <PiggyBank className="w-5 h-5 text-slate-300" />}
                      </div>
                      <p className="text-xs font-semibold text-slate-400">
                        {viewArchived ? 'No archived records found' : 'No swine match your filters'}
                      </p>
                      {!viewArchived && (
                        <button
                          onClick={() => { setFilterPen('all'); setFilterCat('all'); setFilterBreed('all'); setSearchInput(''); }}
                          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                (viewArchived ? archivedList : swineList).map((pig, idx) => (
                  <tr
                    key={pig.id ?? idx}
                    onClick={() => { setSelectedPig(pig); setIsViewModalOpen(true); }}
                    className={`border-b border-slate-50 transition-colors group cursor-pointer ${
                      viewArchived
                        ? 'opacity-70 hover:opacity-100 hover:bg-amber-50/40'
                        : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <span className={`text-xs font-bold transition-colors ${
                        viewArchived
                          ? 'text-slate-400 group-hover:text-slate-600'
                          : 'text-emerald-600 group-hover:text-emerald-700'
                      }`}>
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
                      {viewArchived
                        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                            <Archive className="w-3 h-3" /> Archived
                          </span>
                        : <StatusBadge status={pig.status} />
                      }
                    </td>
                    <td className="py-3 px-4 text-right pr-6 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {!viewArchived && (
                          <>
                            <button
                              type="button"
                              onClick={() => { setSelectedPig(pig); setIsEditModalOpen(true); }}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all inline-block active:scale-95 cursor-pointer"
                              title="Edit Record"
                              id={`swine-edit-${pig.id ?? idx}`}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => promptArchive(pig)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all inline-block active:scale-95 cursor-pointer"
                              title="Archive Record"
                              id={`swine-archive-${pig.id ?? idx}`}
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-3.5 border-t border-slate-50 text-xs text-slate-400 font-medium">
          <p className="text-[11px] font-semibold text-slate-400">
            {(viewArchived ? archivedLoading : listLoading)
              ? 'Loading…'
              : viewArchived
                ? `Showing ${archivedTotal === 0 ? 0 : Math.min((archivedPage - 1) * PAGE_SIZE + 1, archivedTotal)}–${Math.min(archivedPage * PAGE_SIZE, archivedTotal)} of ${archivedTotal.toLocaleString()} Archived`
                : `Showing ${totalCount === 0 ? 0 : Math.min((page - 1) * PAGE_SIZE + 1, totalCount)}–${Math.min(page * PAGE_SIZE, totalCount)} of ${totalCount.toLocaleString()} Swine`}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => viewArchived ? setArchivedPage(p => Math.max(1, p - 1)) : setPage(p => Math.max(1, p - 1))}
              disabled={(viewArchived ? archivedPage <= 1 : page <= 1) || (viewArchived ? archivedLoading : listLoading)}
              className="p-1.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer active:scale-95"
              id="swine-prev-page-btn"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center gap-1">
              {getPageNumbers(
                viewArchived ? archivedPage : page,
                viewArchived ? archivedTotalPages : totalPages
              ).map((pg, i) =>
                pg === '...' ? (
                  <span key={`ellipsis-${i}`} className="w-7 text-center text-slate-400 select-none font-bold text-xs">
                    &hellip;
                  </span>
                ) : (
                  <button
                    key={pg}
                    type="button"
                    onClick={() => viewArchived ? setArchivedPage(pg) : setPage(pg)}
                    disabled={viewArchived ? archivedLoading : listLoading}
                    className={[
                      'w-7 h-7 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 flex items-center justify-center',
                      pg === (viewArchived ? archivedPage : page)
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/10'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50',
                      (viewArchived ? archivedLoading : listLoading) ? 'opacity-60 cursor-not-allowed' : '',
                    ].join(' ')}
                    id={`swine-page-${pg}-btn`}
                  >
                    {pg}
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              onClick={() => viewArchived ? setArchivedPage(p => Math.min(archivedTotalPages, p + 1)) : setPage(p => Math.min(totalPages, p + 1))}
              disabled={(viewArchived ? archivedPage >= archivedTotalPages : page >= totalPages) || (viewArchived ? archivedLoading : listLoading)}
              className="p-1.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer active:scale-95"
              id="swine-next-page-btn"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Portal-based confirm dialog (from useConfirmDialog hook) */}
      {confirmDialog}

      <AddPigModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSavePig}
        onSaveBatch={handleSaveBatch}
        pens={pens}
      />

      {/* RENDER: Edit Modal (standalone, for direct edit button in table) */}
      <EditPigModal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setSelectedPig(null); }}
        onSave={handleUpdatePig}
        pigData={selectedPig}
      />

      {/* RENDER: View Details Modal (with built-in edit form & smooth transition) */}
      <ViewPigModal
        isOpen={isViewModalOpen}
        onClose={() => { setIsViewModalOpen(false); setSelectedPig(null); }}
        onSave={handleUpdatePig}
        onArchive={!viewArchived ? (pig) => {
          setIsViewModalOpen(false);
          promptArchive(pig);
        } : null}
        pigData={selectedPig}
      />
    </div>
  );
}