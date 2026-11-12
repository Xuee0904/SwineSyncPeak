import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Users, HeartPulse, PiggyBank, AlertTriangle, Download, Plus,
  Search, MoreVertical, RefreshCw, Layers, Heart,
  X, Grid3X3, AlertCircle, Edit2, Archive, ArchiveX, RotateCcw, Unlock, FilterX, SlidersHorizontal, Eye,
} from 'lucide-react';
import Pagination from '../components/common/Pagination';
import AddPigModal from '../components/SwineManagement/AddPigModal.jsx';
import EditPigModal from '../components/SwineManagement/EditPigModal.jsx';
import ViewPigModal from '../components/SwineManagement/ViewPigModal.jsx';
import ArchiveSwineModal from '../components/SwineManagement/ArchiveSwineModal.jsx';
import useConfirmDialog from '../hooks/useConfirmDialog.jsx';
import toast from '../utils/toast';
import StatusBadge from '../components/StatusBadge.jsx';
import ExportDropdown from '../components/common/ExportDropdown.jsx';
import PigSnout from '../components/common/PigSnout.jsx';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const PAGE_SIZE = 5;

function getArchiveStatus(reason) {
  if (!reason) return 'Archived';
  const r = reason.toLowerCase();
  if (r.includes('sold')) return 'Sold';
  if (r.includes('cull')) return 'Culled';
  if (r.includes('mortal') || r.includes('died') || r.includes('death') || r.includes('loss')) return 'Mortality';
  if (r.includes('transfer')) return 'Transferred';
  return 'Archived';
}


function StatCard({
  icon: Icon,
  label,
  value,
  unit = 'heads',
  unitColor,
  subtext,
  badge,
  isAlert = false,
  loading = false,
}) {
  return (
    <div
      className={`bg-white border rounded-2xl p-4 sm:p-5 shadow-xs transition-all flex flex-col justify-between min-h-[106px] sm:min-h-[112px] ${isAlert
        ? 'border-rose-200/90 ring-1 ring-rose-100/70'
        : 'border-slate-200/70'
        }`}
    >
      <div className="flex items-center justify-between w-full mb-3">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
          {label}
        </span>
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isAlert
            ? 'bg-rose-50 text-rose-600'
            : 'bg-slate-50 text-slate-500'
            }`}
        >
          {Icon && <Icon className="w-4 h-4" />}
        </div>
      </div>

      <div>
        <div className="flex items-baseline gap-1.5 flex-wrap">
          {loading ? (
            <div className="h-7 w-16 bg-slate-100 animate-pulse rounded-md" />
          ) : (
            <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {value}
            </span>
          )}
          {unit && !loading && (
            <span
              className={`text-xs font-semibold ${unitColor
                ? unitColor
                : isAlert
                  ? 'text-rose-600 font-bold'
                  : 'text-slate-400'
                }`}
            >
              {unit}
            </span>
          )}
          {badge && !loading && (
            <span className="text-[10px] font-extrabold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full ml-auto shrink-0">
              {badge}
            </span>
          )}
        </div>

        {subtext && !loading && (
          <p className="text-[11px] font-medium text-slate-400 mt-1 truncate">
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}

function TableSkeleton({ rows = 5, cols = 8 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, idx) => (
        <tr key={idx} className="border-b border-slate-50">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <td key={colIdx} className="py-3.5 px-4">
              <div className="h-4 bg-slate-100 animate-pulse rounded w-3/4" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function SwineManagement({ loggedInUser = 'Admin', activeSubTab = 'swine_list' }) {
  const [swineList, setSwineList] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);

  const [stats, setStats] = useState({
    total: 0,
    records: 0,
    sows: 0,
    boars: 0,
    piglets: 0,
    batches: 0,
    pregnant: 0,
    sick: 0,
    quarantine: 0,
    healthWatch: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  const [pens, setPens] = useState([]);
  const [pensLoading, setPensLoading] = useState(true);

  const [breeds, setBreeds] = useState([]);

  const [filterPen, setFilterPen] = useState('all');
  const [filterCat, setFilterCat] = useState('all');
  const [filterBreed, setFilterBreed] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedPig, setSelectedPig] = useState(null);
  const [selectedArchiveSwine, setSelectedArchiveSwine] = useState(null);

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
      const res = await fetch(`${API_BASE}/api/pigs/stats`);
      const data = await res.json();
      const sows = data.sows ?? data.pregnant ?? 0;
      const boars = data.boars ?? 0;
      const total = data.total ?? 0;
      const piglets = data.piglets ?? Math.max(0, total - sows - boars);
      setStats({
        total,
        records: data.records ?? 0,
        sows,
        boars,
        piglets,
        batches: data.batches ?? 0,
        pregnant: data.pregnant ?? 0,
        sick: data.sick ?? 0,
        quarantine: data.quarantine ?? 0,
        healthWatch: data.healthWatch ?? ((data.sick ?? 0) + (data.quarantine ?? 0)),
      });
    } catch {
      // Fail silently and keep defaults
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchPens = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/pens`);
      const data = await res.json();
      setPens(data.data ?? []);
    } catch {
      // Fail silently
    }
  }, []);

  const fetchBreeds = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/breeds`);
      const data = await res.json();
      setBreeds(data.data ?? []);
    } catch {
      // Fail silently
    }
  }, []);

  // Columns for CSV/PDF export — matches what the user sees in the list + extra detail
  const exportColumns = [
    { header: 'Swine Tag', accessor: (row) => row.pig_tag ?? row.id ?? '—' },
    { header: 'Category', accessor: (row) => row.category ?? '—' },
    { header: 'Breed', accessor: (row) => row.breed ?? '—' },
    { header: 'Date of Birth', accessor: (row) => row.date_of_birth ? new Date(row.date_of_birth).toLocaleDateString() : '—' },
    { header: 'Age (Weeks)', accessor: (row) => row.age_weeks ?? '—' },
    { header: 'Current Weight (kg)', accessor: (row) => row.current_weight != null ? Number(row.current_weight).toFixed(1) : '—' },
    { header: 'Pen', accessor: (row) => row.pen_code || '' },
    { header: 'Status', accessor: (row) => viewArchived ? (row.archive_reasoning || 'Archived') : (row.status || '—') },
  ];

  // Fetches ALL records (bypasses pagination) for export, respecting current filters
  const fetchAllForExport = async () => {
    const endpoint = viewArchived ? '/api/pigs/archived' : '/api/pigs';
    const params = new URLSearchParams({ limit: '9999' });
    if (search && search !== '') params.set('search', search);
    if (filterPen && filterPen !== 'all') params.set('pen', filterPen);
    if (filterCat && filterCat !== 'all') params.set('category', filterCat);
    if (filterBreed && filterBreed !== 'all') params.set('breed', filterBreed);
    if (filterStatus && filterStatus !== 'all') params.set('status', filterStatus);
    const res = await fetch(`${API_BASE}${endpoint}?${params}`);
    if (!res.ok) throw new Error(`Export fetch failed: ${res.status}`);
    const json = await res.json();
    return json.data ?? [];
  };

  const fetchSwine = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search && search !== '') params.set('search', search);
      if (filterPen && filterPen !== 'all') params.set('pen', filterPen);
      if (filterCat && filterCat !== 'all') params.set('category', filterCat);
      if (filterBreed && filterBreed !== 'all') params.set('breed', filterBreed);
      if (filterStatus && filterStatus !== 'all') params.set('status', filterStatus);

      const res = await fetch(`${API_BASE}/api/pigs?${params}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setSwineList(data.data ?? []);
      setTotalCount(data.count ?? 0);
    } catch (err) {
      setListError(err.message || 'Failed to load swine data.');
    } finally {
      setListLoading(false);
    }
  }, [page, search, filterPen, filterCat, filterBreed, filterStatus]);

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
    fetchArchived();
    return Array.isArray(data.data) ? data.data[0] : (data.data || data); // return created pig record so modal can capture the ID
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
    fetchArchived();
    return Array.isArray(data.data) ? data.data[0] : (data.data || data); // return created batch record so modal can capture the ID
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
    fetchArchived();
    const rawData = Array.isArray(data.data) ? data.data[0] : (data.data || payload);
    return {
      ...payload,
      ...rawData,
      id: rawData?.id || rawData?.pig_id || rawData?.batch_id || id,
      pig_tag: rawData?.pig_tag || rawData?.batch_tag || payload.pig_tag || payload.tagNumber,
    };
  };

  // Open the archive or restore modal (which handles both warning and success with smooth transition)
  const promptArchive = (pig) => {
    setSelectedArchiveSwine({ pig, isArchiving: true });
  };

  const promptUnarchive = (pig) => {
    setSelectedArchiveSwine({ pig, isArchiving: false });
  };

  const handleArchiveModalSuccess = () => {
    setSelectedArchiveSwine(null);
    setIsViewModalOpen(false);
    setSelectedPig(null);
    fetchSwine();
    fetchStats();
    fetchArchived();
  };

  // Fetch archived records
  const fetchArchived = useCallback(async () => {
    setArchivedLoading(true);
    try {
      const params = new URLSearchParams({ page: String(archivedPage), limit: String(PAGE_SIZE) });
      if (search && search !== '') params.set('search', search);
      if (filterPen && filterPen !== 'all') params.set('pen', filterPen);
      if (filterCat && filterCat !== 'all') params.set('category', filterCat);
      if (filterBreed && filterBreed !== 'all') params.set('breed', filterBreed);
      if (filterStatus && filterStatus !== 'all') params.set('status', filterStatus);

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
  }, [archivedPage, search, filterPen, filterCat, filterBreed, filterStatus]);

  useEffect(() => {
    fetchStats();
    fetchPens();
    fetchBreeds();
  }, [fetchStats, fetchPens, fetchBreeds]);
  useEffect(() => { fetchSwine(); }, [fetchSwine]);
  useEffect(() => { if (viewArchived) fetchArchived(); }, [fetchArchived, viewArchived]);

  useEffect(() => { setPage(1); }, [search, filterPen, filterCat, filterBreed, filterStatus]);
  useEffect(() => { setArchivedPage(1); }, [search, filterPen, filterCat, filterBreed, filterStatus]);

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

  // Group pens with Main Building (M-) prioritized at top
  const mainBuildingPens = useMemo(() => {
    return pens
      .filter(p => (p.name || '').toUpperCase().startsWith('M'))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }));
  }, [pens]);

  const otherPens = useMemo(() => {
    return pens
      .filter(p => !(p.name || '').toUpperCase().startsWith('M'))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }));
  }, [pens]);

  const hasActiveFilters = filterPen !== 'all' || filterCat !== 'all' || filterBreed !== 'all' || filterStatus !== 'all' || Boolean(search);

  return (
    <div className="p-5 lg:p-6 space-y-5 animate-fade-in">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Total Swine */}
        <StatCard
          icon={PigSnout}
          label="Total Swine"
          value={stats?.total ?? 0}
          unit="heads"
          loading={statsLoading}
        />

        {/* 2. Sows & Boars (Breeding Stock) */}
        <StatCard
          icon={Heart}
          label="Sows & Boars"
          value={(stats?.sows ?? 0) + (stats?.boars ?? 0)}
          unit="heads"
          loading={statsLoading}
        />

        {/* 3. Piglets */}
        <StatCard
          icon={Layers}
          label="Piglets"
          value={stats?.piglets ?? 0}
          unit="heads"
          loading={statsLoading}
        />

        {/* 4. Health Watch */}
        <StatCard
          icon={HeartPulse}
          label="Health Watch"
          value={stats?.healthWatch ?? 0}
          unit={(stats?.healthWatch ?? 0) > 0 ? 'under watch' : 'healthy'}
          unitColor={(stats?.healthWatch ?? 0) > 0 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}
          isAlert={(stats?.healthWatch ?? 0) > 0}
          loading={statsLoading}
        />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100">
          {/* ── Row 1: Search | View Switcher | Global Actions ── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap flex-1">
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="Search by tag or ID…"
                  className="w-full h-9 pl-9 pr-8 text-xs font-medium border border-slate-200 rounded-xl bg-slate-50/60 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  id="swine-search-input"
                />
                {searchInput && (
                  <button
                    onClick={() => { setSearchInput(''); setSearch(''); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Active / Archived tabs */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/50">
                <button
                  onClick={() => setViewArchived(false)}
                  className={`h-8 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${!viewArchived ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  id="swine-tab-active"
                >
                  Active
                </button>
                <button
                  onClick={() => setViewArchived(true)}
                  className={`h-8 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${viewArchived ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  id="swine-tab-archived"
                >
                  Archived
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <ExportDropdown
                onFetchAll={fetchAllForExport}
                columns={exportColumns}
                filename={viewArchived ? 'swine_sync_archived_records' : 'swine_sync_active_records'}
                pdfTitle={viewArchived ? 'Archived Swine Records' : 'Active Swine Records'}
              />
              {!viewArchived && (
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="h-9 flex items-center gap-1.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
                  id="add-swine-btn"
                >
                  <Plus className="w-3.5 h-3.5" /> Add new swine
                </button>
              )}
            </div>
          </div>

          {/* ── Row 2: Filter Strip ── */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 mt-3 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-slate-400 mr-1 shrink-0">
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Filters:</span>
              </div>

              {/* Pen Filter */}
              <select
                value={filterPen}
                onChange={e => setFilterPen(e.target.value)}
                className={`h-8.5 text-xs rounded-lg px-2.5 pr-7 border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${filterPen !== 'all'
                  ? 'border-emerald-500/60 bg-emerald-50/30 text-emerald-900 font-bold'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 font-medium'
                  }`}
                id="pen-filter-select"
              >
                <option value="all">All Pens</option>
                {mainBuildingPens.length > 0 && (
                  <optgroup label="Main Building (M)">
                    {mainBuildingPens.map(p => (
                      <option key={p.id} value={String(p.id)}>{p.name}</option>
                    ))}
                  </optgroup>
                )}
                {otherPens.length > 0 && (
                  <optgroup label="Building 2 (B2)">
                    {otherPens.map(p => (
                      <option key={p.id} value={String(p.id)}>{p.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>

              {/* Category Filter */}
              <select
                value={filterCat}
                onChange={e => setFilterCat(e.target.value)}
                className={`h-8.5 text-xs rounded-lg px-2.5 pr-7 border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${filterCat !== 'all'
                  ? 'border-emerald-500/60 bg-emerald-50/30 text-emerald-900 font-bold'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 font-medium'
                  }`}
                id="category-filter-select"
              >
                <option value="all">All Categories</option>
                <option value="sow">Sow</option>
                <option value="boar">Boar</option>
                <option value="piglet_batch">Piglet Batch</option>
              </select>

              {/* Breed Filter */}
              <select
                value={filterBreed}
                onChange={e => setFilterBreed(e.target.value)}
                className={`h-8.5 text-xs rounded-lg px-2.5 pr-7 border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${filterBreed !== 'all'
                  ? 'border-emerald-500/60 bg-emerald-50/30 text-emerald-900 font-bold'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 font-medium'
                  }`}
                id="breed-filter-select"
              >
                <option value="all">All Breeds</option>
                {breeds.map(b => (
                  <option key={b.breed_id || b.name} value={b.name}>{b.name}</option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className={`h-8.5 text-xs rounded-lg px-2.5 pr-7 border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${filterStatus !== 'all'
                  ? 'border-emerald-500/60 bg-emerald-50/30 text-emerald-900 font-bold'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 font-medium'
                  }`}
                id="status-filter-select"
              >
                <option value="all">{viewArchived ? 'All Reasons' : 'All Statuses'}</option>
                {viewArchived ? (
                  <>
                    <option value="sold">Sold</option>
                    <option value="culled">Culled</option>
                    <option value="mortality">Mortality</option>
                    <option value="transferred">Transferred</option>
                  </>
                ) : (
                  <>
                    <option value="healthy">Healthy</option>
                    <option value="sick">Sick</option>
                    <option value="quarantine">Quarantine</option>
                  </>
                )}
              </select>

              {/* Reset Button */}
              {hasActiveFilters && (
                <button
                  onClick={() => {
                    setFilterPen('all');
                    setFilterCat('all');
                    setFilterBreed('all');
                    setFilterStatus('all');
                    setSearchInput('');
                    setSearch('');
                  }}
                  className="h-8.5 flex items-center gap-1.5 px-2.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/70 border border-rose-200/80 rounded-lg transition-colors cursor-pointer"
                  title="Reset all filters"
                >
                  <FilterX className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>

            {/* Quick Context on Right */}
            <div className="text-[11px] font-medium text-slate-400 hidden sm:block">
              {hasActiveFilters ? (
                <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                  Filtered: {viewArchived ? archivedTotal : totalCount} records
                </span>
              ) : (
                <span>{viewArchived ? archivedTotal : totalCount} total records</span>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/75 border-b border-slate-100">
              <tr>
                {['Swine Tag', 'Pen', 'Breed', 'Age', 'Category', 'Status', 'Actions'].map(h => (
                  <th
                    key={h}
                    className={`py-3 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap ${h === 'Actions' ? 'text-right pr-6' : ''
                      }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(viewArchived ? archivedLoading : listLoading) ? (
                <TableSkeleton rows={PAGE_SIZE} cols={7} />
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
                          : <PigSnout className="w-5 h-5 text-slate-300" />}
                      </div>
                      <p className="text-xs font-semibold text-slate-400">
                        {viewArchived ? 'No archived records found' : 'No swine match your filters'}
                      </p>
                      {!viewArchived && (
                        <button
                          onClick={() => { setFilterPen('all'); setFilterCat('all'); setFilterBreed('all'); setFilterStatus('all'); setSearchInput(''); setSearch(''); }}
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
                    className={`border-b border-slate-100/70 transition-colors group cursor-pointer ${viewArchived
                      ? 'opacity-70 hover:opacity-100 hover:bg-amber-50/40'
                      : 'hover:bg-slate-50/80'
                      }`}
                  >
                    {/* 1. Swine Tag */}
                    <td className="py-3.5 px-4">
                      <span className={`text-xs font-bold transition-colors ${viewArchived
                        ? 'text-slate-400 group-hover:text-slate-600'
                        : 'text-emerald-600 group-hover:text-emerald-700'
                        }`}>
                        {pig.pig_tag
                          ? (pig.pig_tag.startsWith('#') ? pig.pig_tag : `#${pig.pig_tag}`)
                          : (pig.id ? `#${pig.id}` : '—')}
                      </span>
                    </td>

                    {/* 2. Pen */}
                    <td className="py-3.5 px-4">
                      {(() => {
                        const penName = pig.pen_code || pens.find(p => String(p.id) === String(pig.pen_id))?.name || null;
                        return penName ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200/60">
                            {penName}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-medium text-xs">—</span>
                        );
                      })()}
                    </td>

                    {/* 3. Breed */}
                    <td className="py-3.5 px-4">
                      <span className="text-xs font-semibold text-slate-700">
                        {pig.breed && pig.breed.trim() ? pig.breed : <span className="text-slate-300 font-medium text-xs">—</span>}
                      </span>
                    </td>

                    {/* 4. Age */}
                    <td className="py-3.5 px-4">
                      {pig.age_weeks !== null && pig.age_weeks !== undefined && pig.age_weeks !== '' ? (
                        pig.age_weeks === 0 || pig.age_weeks === '0' ? (
                          <span className="text-xs font-semibold text-slate-600">&lt; 1 wk</span>
                        ) : (
                          <span className="text-xs font-semibold text-slate-700">{pig.age_weeks} wks</span>
                        )
                      ) : (
                        <span className="text-slate-300 font-medium text-xs">—</span>
                      )}
                    </td>

                    {/* 5. Category */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-700">
                          {pig.category ?? '—'}
                        </span>
                        {pig.category === 'Piglet Batch' && (pig.current_count != null || pig.total_born_alive != null) && (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-extrabold rounded-md bg-slate-100 text-slate-600 border border-slate-200/60">
                            {(() => {
                              const count = pig.current_count ?? pig.total_born_alive ?? 0;
                              return `${count} ${count === 1 ? 'head' : 'heads'}`;
                            })()}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 7. Status */}
                    <td className="py-3.5 px-4">
                      {viewArchived ? (
                        <div title={pig.archive_reasoning || 'Archived'}>
                          <StatusBadge status={getArchiveStatus(pig.archive_reasoning)} />
                        </div>
                      ) : (
                        <StatusBadge status={pig.status} />
                      )}
                    </td>

                    {/* 8. Actions */}
                    <td className="py-3.5 px-4 text-right pr-6 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {!viewArchived ? (
                          <>
                            {/* Edit Action */}
                            <button
                              type="button"
                              onClick={() => { setSelectedPig(pig); setIsEditModalOpen(true); }}
                              className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors active:scale-95 cursor-pointer"
                              title="Edit Record"
                              id={`swine-edit-${pig.id ?? idx}`}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Archive Action */}
                            <button
                              type="button"
                              onClick={() => promptArchive(pig)}
                              className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors active:scale-95 cursor-pointer"
                              title="Archive Record"
                              id={`swine-archive-${pig.id ?? idx}`}
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => promptUnarchive(pig)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/60 rounded-lg transition-colors active:scale-95 cursor-pointer"
                            title="Restore Swine to Active Herd"
                            id={`swine-unarchive-${pig.id ?? idx}`}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Restore</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={viewArchived ? archivedPage : page}
          totalPages={viewArchived ? archivedTotalPages : totalPages}
          onPageChange={viewArchived ? setArchivedPage : setPage}
          disabled={viewArchived ? archivedLoading : listLoading}
          totalItems={viewArchived ? archivedTotal : totalCount}
          itemsPerPage={PAGE_SIZE}
          itemName="records"
        />
      </div>

      {/* Portal-based confirm dialog (from useConfirmDialog hook) */}
      {confirmDialog}

      <AddPigModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSavePig}
        onSaveBatch={handleSaveBatch}
        loggedInUser={loggedInUser}
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
        onArchive={!viewArchived ? (pig) => promptArchive(pig) : null}
        onUnarchive={viewArchived ? (pig) => promptUnarchive(pig) : null}
        pigData={selectedPig}
        loggedInUser={loggedInUser}
      />

      <ArchiveSwineModal
        isOpen={!!selectedArchiveSwine}
        onClose={() => setSelectedArchiveSwine(null)}
        archiveData={selectedArchiveSwine}
        onConfirmSuccess={handleArchiveModalSuccess}
        loggedInUser={loggedInUser}
      />
    </div>
  );
}