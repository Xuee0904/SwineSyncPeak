import React, { useState, useEffect } from 'react';
import { 
  Users, Download, Plus, BarChart2, Edit2, MoreVertical, 
  Activity, Search, X, Loader2, AlertCircle, ShieldCheck
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export default function Admin({ loggedInUser }) {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State for Add Staff
  const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', role: 'Staff' });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // ─── Fetch live staff accounts from the backend API ────────────────────────
  const loadStaffAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/api/admin/users`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server returned error ${res.status}`);
      }
      const data = await res.json();
      setStaffList(data.users ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaffAccounts();
  }, []);

  const handleAddStaffSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!newStaff.name || !newStaff.email || !newStaff.password) {
      setFormError('Please complete all fields.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/philippines-swine-news` ? `${API_BASE_URL}/api/philippines-swine-news` : `${API_BASE_URL}/api/philippines-swine-news`); // safety base url check
      
      // Perform the actual registration POST
      const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStaff)
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to register account.');
      }

      // Reload accounts and reset the form
      await loadStaffAccounts();
      setNewStaff({ name: '', email: '', password: '', role: 'Staff' });
      setIsAddStaffOpen(false);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const [isLoading, setIsLoading] = useState(false);

  // Static Activity Log elements for layout fidelity
  const activityLogs = [
    {
      timestamp: { date: 'Oct 24, 2024', time: '14:22:15 UTC' },
      user: { name: 'John Doe', email: 'j.doe@swinesync.ag', initials: 'JD', bg: 'bg-emerald-100 text-emerald-700' },
      event: { title: 'Record Updated', desc: 'Modified breeding cycle status for Pen B3.' },
      status: 'SUCCESS'
    },
    {
      timestamp: { date: 'Oct 24, 2024', time: '13:45:02 UTC' },
      user: { name: 'Admin System', email: 'system@internal', initials: 'AS', bg: 'bg-slate-100 text-slate-700' },
      event: { title: 'Bulk Export', desc: 'Financial audit log for Q3 2024 was exported.' },
      status: 'SUCCESS'
    },
    {
      timestamp: { date: 'Oct 24, 2024', time: '12:10:33 UTC' },
      user: { name: 'Unknown User', email: 'auth.fail@gateway', initials: '??', bg: 'bg-rose-100 text-rose-700' },
      event: { title: 'Failed Login', desc: 'Invalid credentials provided for portal access.' },
      status: 'BLOCKED'
    },
    {
      timestamp: { date: 'Oct 24, 2024', time: '11:58:19 UTC' },
      user: { name: 'Sarah Miller', email: 's.miller@swinesync.ag', initials: 'SM', bg: 'bg-sky-100 text-sky-700' },
      event: { title: 'Inventory Audit', desc: 'Feed storage silo #2 volume checked and logged.' },
      status: 'SUCCESS'
    },
    {
      timestamp: { date: 'Oct 24, 2024', time: '11:30:44 UTC' },
      user: { name: 'John Doe', email: 'j.doe@swinesync.ag', initials: 'JD', bg: 'bg-emerald-100 text-emerald-700' },
      event: { title: 'Permissions Changed', desc: 'Granted "Audit Viewer" role to visitor account.' },
      status: 'WARNING'
    }
  ];

  const handleExport = (tableName) => {
    alert(`Exporting ${tableName} dataset as CSV…`);
  };

  const filteredStaff = staffList.filter(staff => 
    staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    staff.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    staff.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-16 text-left animate-fade-in" id="admin-portal-view">
      
      {/* Header Action Bar */}
      <section className="border-b border-slate-100 pb-5 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold text-emerald-600 uppercase tracking-widest">Admin</h1>
          <p className="text-xs text-slate-400 mt-0.5">Manage administrative credentials, staff rosters, and audit records.</p>
        </div>
      </section>

      {/* ─── CARD 1: ACCOUNT MANAGEMENT ─────────────────────────────────────── */}
      <section className="bg-white border border-slate-150 rounded-2xl shadow-sm overflow-hidden" id="account-management-card">
        {/* Card Header */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Account Management</h2>
              <p className="text-xs text-slate-400">Add, edit, or deactivate farm caretaker accounts.</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button 
              onClick={() => handleExport('Account Management')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
            <button 
              onClick={() => setIsAddStaffOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-md shadow-emerald-650/15"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Staff
            </button>
          </div>
        </div>

        {/* Live Search Filter */}
        <div className="px-5 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Filter staff by name, email, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none text-xs text-slate-700 outline-none w-full placeholder-slate-400"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Table Area / State handlers */}
        {loading ? (
          <div className="flex items-center justify-center py-12 space-x-2 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            <span className="text-xs">Loading live credentials from Supabase…</span>
          </div>
        ) : error ? (
          <div className="p-5 flex items-center gap-3 text-xs text-rose-700 bg-rose-50 border-b border-slate-100">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>Could not fetch users: {error}. Make sure the server is configured with <code>SUPABASE_SERVICE_ROLE_KEY</code>.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/40 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-100">
                  <th className="p-4">User ID</th>
                  <th className="p-4">Staff Member</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Last Login</th>
                  <th className="p-4 text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredStaff.map((staff) => (
                  <tr key={staff.fullId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-mono font-bold text-slate-400">
                      #{staff.id}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img 
                          src={staff.avatar} 
                          alt={staff.name} 
                          className="w-8 h-8 rounded-full object-cover ring-2 ring-slate-100"
                        />
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            {staff.name}
                            {loggedInUser && staff.name.toLowerCase().includes(loggedInUser.toLowerCase()) && (
                              <span className="text-[9px] bg-emerald-50 text-emerald-600 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                You
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-slate-400">{staff.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase tracking-wider ${
                        staff.role.toLowerCase() === 'admin' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                          : 'bg-blue-50 text-blue-700 border border-blue-100'
                      }`}>
                        {staff.role}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="flex items-center gap-1.5 font-medium text-slate-600">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          staff.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'
                        }`} />
                        {staff.status}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500 font-medium">
                      {staff.lastLogin}
                    </td>
                    <td className="p-4 text-right pr-6 space-x-1 shrink-0">
                      <button className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title="View Audit Logs">
                        <BarChart2 className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 text-slate-400 hover:text-indigo-650 rounded-lg transition-all" title="Edit Profile">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button className="p-1.5 text-slate-400 hover:text-slate-650 rounded-lg transition-all">
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredStaff.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center py-10 text-slate-400">
                      No matching credentials found in Supabase Auth.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ─── CARD 2: REAL-TIME ACTIVITY LOG ─────────────────────────────────── */}
      <section className="bg-white rounded-3xl border border-slate-155 border-slate-150 shadow-sm overflow-hidden" id="activity-log-card">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-50 text-slate-600 rounded-xl">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Activity Log</h2>
              <p className="text-xs text-slate-400">System audit tracking trail of modifications and logins.</p>
            </div>
          </div>
          <button 
            onClick={() => handleExport('Activity Log')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/40 text-slate-400 uppercase tracking-wider font-bold border-b border-slate-100">
                <th className="p-4 pl-6">Timestamp</th>
                <th className="p-4">User</th>
                <th className="p-4">Event</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {activityLogs.map((log, idx) => (
                <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                  <td className="p-4 pl-6 font-medium text-slate-500 space-y-0.5">
                    <span className="block font-bold text-slate-700">{log.timestamp.date}</span>
                    <span className="block text-[10px] text-slate-450">{log.timestamp.time}</span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] ${log.user.bg}`}>
                        {log.user.initials}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700">{log.user.name}</span>
                        <span className="text-[10px] text-slate-400">{log.user.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 space-y-0.5 max-w-sm">
                    <span className="font-bold text-slate-800 block">{log.event.title}</span>
                    <span className="text-[11px] text-slate-500 block leading-relaxed">{log.event.desc}</span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase tracking-wider border ${
                      log.status === 'SUCCESS' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                        : log.status === 'BLOCKED'
                          ? 'bg-rose-50 text-rose-700 border-rose-100'
                          : 'bg-amber-50 text-amber-700 border-amber-100'
                    }`}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <span className="text-slate-500">Showing <strong>5</strong> latest system logs</span>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-650 cursor-pointer hover:bg-slate-50">Previous</button>
            <button className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-650 cursor-pointer hover:bg-slate-50">Next</button>
          </div>
        </div>
      </section>

      {/* ─── MODALS: ADD STAFF DIALOGUE (Supabase Integrated) ───────────────── */}
      {isAddStaffOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setIsAddStaffOpen(false)}
        >
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative text-left animate-scale-up">
            <div className="h-2 bg-gradient-to-r from-emerald-600 to-primary-500 w-full" />
            
            <button 
              onClick={() => setIsAddStaffOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <form onSubmit={handleAddStaffSubmit} className="p-8 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Add Staff Account</h3>
                <p className="text-xs text-slate-400 mt-1">Register a new caretaker credential directly inside Supabase Auth.</p>
              </div>

              {formError && (
                <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Input: Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Full Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Sarah Monroe"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-4 py-2.5 text-xs text-slate-900 outline-none transition-all"
                />
              </div>

              {/* Input: Email */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email Address</label>
                <input 
                  type="email" 
                  required
                  placeholder="sarah.m@swinesync.com"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-4 py-2.5 text-xs text-slate-900 outline-none transition-all"
                />
              </div>

              {/* Input: Password */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Temporary Password</label>
                <input 
                  type="password" 
                  required
                  placeholder="Min. 8 characters"
                  value={newStaff.password}
                  onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                  className="w-full bg-white border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-4 py-2.5 text-xs text-slate-900 outline-none transition-all"
                />
              </div>

              {/* Input: Role */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">System Access Role</label>
                <select 
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 outline-none transition-all"
                >
                  <option value="Staff">Staff (View/Update Logs)</option>
                  <option value="Admin">Admin (Full System Privilege)</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button 
                  type="button"
                  onClick={() => setIsAddStaffOpen(false)}
                  className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-650 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isLoading ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                  ) : (
                    'Create Account'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}