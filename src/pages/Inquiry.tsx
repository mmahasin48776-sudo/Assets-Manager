import React, { useState, useEffect } from "react";
import axios from "axios";
import { 
  ClipboardList, 
  Search, 
  Filter, 
  Calendar,
  History,
  ArrowRightLeft,
  Plus,
  Trash2,
  Edit2,
  User,
  ShieldAlert,
  ArrowRight,
  Download,
  LogIn,
  LogOut,
  Monitor,
  MapPin
} from "lucide-react";
import { format } from "date-fns";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useAuth } from "../App";
import { motion, AnimatePresence } from "motion/react";
import { ScaleLoader } from "react-spinners";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ActivityLog {
  id: number;
  entity_type: string;
  entity_id: number;
  entity_name: string;
  entity_identity: string;
  action: string;
  user_name: string;
  details: string;
  created_at: string;
}

export default function Inquiry() {
  const { isAdmin, isSystemAdmin } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logUsers, setLogUsers] = useState<{user_name: string}[]>([]);
  const [exporting, setExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    from_date: "",
    to_date: "",
    entity_type: "All",
    user_name: "All",
    search: ""
  });

  // Login session log state
  const [activeTab, setActiveTab] = useState<'activity' | 'login'>('activity');
  const [loginLogs, setLoginLogs] = useState<any[]>([]);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginSearch, setLoginSearch] = useState("");

  const fetchLoginLogs = async () => {
    setLoginLoading(true);
    try {
      const res = await axios.get("/api/login-logs");
      setLoginLogs(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Failed to fetch login logs", error);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleClearLoginLogs = async () => {
    if (!window.confirm("Are you sure you want to clear all login session logs? This action cannot be undone.")) return;
    try {
      await axios.post("/api/login-logs/clear");
      setLoginLogs([]);
    } catch (error) {
      console.error("Failed to clear login logs", error);
    }
  };

  const handleLocationClick = (locationStr: string) => {
    if (!locationStr) return;
    
    // Check if location string has latitude/longitude inside parentheses, e.g. "San Francisco, USA (37.774929, -122.419416)"
    const coordsRegex = /\((-?\d+\.\d+),\s*(-?\d+\.\d+)\)/;
    const match = locationStr.match(coordsRegex);
    
    let mapUrl = "";
    if (match) {
      const lat = match[1];
      const lon = match[2];
      mapUrl = `https://www.google.com/maps?q=${lat},${lon}`;
    } else {
      // Check if it is purely simple coordinates e.g. "37.774929, -122.419416"
      const simpleCoordsRegex = /^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/;
      const simpleMatch = locationStr.match(simpleCoordsRegex);
      if (simpleMatch) {
        mapUrl = `https://www.google.com/maps?q=${simpleMatch[1]},${simpleMatch[2]}`;
      } else {
        // Fallback to text search on Google Maps
        mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationStr)}`;
      }
    }
    
    window.open(mapUrl, '_blank', 'noopener,noreferrer');
  };

  const filteredLoginLogs = loginLogs.filter(log => {
    if (!loginSearch) return true;
    const term = loginSearch.toLowerCase();
    return (
      (log.username || '').toLowerCase().includes(term) ||
      (log.device_name || '').toLowerCase().includes(term) ||
      (log.ip || '').toLowerCase().includes(term) ||
      (log.location || '').toLowerCase().includes(term)
    );
  });

  const handleExportLoginLogs = () => {
    if (filteredLoginLogs.length === 0) return;
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID,Username,Device & Browser,IP Address,Location,Login Time,Logout Time,Status\n";
    filteredLoginLogs.forEach(log => {
      const row = [
        log.id,
        `"${log.username}"`,
        `"${log.device_name}"`,
        `"${log.ip}"`,
        `"${log.location}"`,
        `"${log.login_time ? format(new Date(log.login_time), 'yyyy-MM-dd HH:mm:ss') : ''}"`,
        `"${log.logout_time ? format(new Date(log.logout_time), 'yyyy-MM-dd HH:mm:ss') : 'Active Session'}"`,
        `"${log.logout_time ? 'Closed' : 'Active'}"`
      ].join(",");
      csvContent += row + "\n";
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `login_logs_export_${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  useEffect(() => {
    if ((isAdmin || isSystemAdmin) && activeTab === 'login') {
      fetchLoginLogs();
    }
  }, [activeTab]);

  const fetchUsers = async () => {
    try {
      const res = await axios.get("/api/activity-logs/users");
      setLogUsers(res.data);
    } catch (error) {
      console.error("Failed to fetch log users", error);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.from_date) params.append("from_date", filters.from_date);
      if (filters.to_date) params.append("to_date", filters.to_date);
      if (filters.entity_type !== "All") params.append("entity_type", filters.entity_type);
      if (filters.user_name !== "All") params.append("user_name", filters.user_name);
      if (filters.search) params.append("search", filters.search);
      
      const res = await axios.get(`/api/activity-logs?${params.toString()}`);
      setLogs(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Failed to fetch activity logs", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin || isSystemAdmin) {
      fetchLogs();
    }
  }, [filters]);

  useEffect(() => {
    if (isAdmin || isSystemAdmin) {
      fetchUsers();
    }
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filters.from_date) params.append("from_date", filters.from_date);
      if (filters.to_date) params.append("to_date", filters.to_date);
      if (filters.entity_type !== "All") params.append("entity_type", filters.entity_type);
      if (filters.user_name !== "All") params.append("user_name", filters.user_name);
      if (filters.search) params.append("search", filters.search);
      
      const response = await axios.get(`/api/export/activity-logs?${params.toString()}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `activity_logs_export_${format(new Date(), 'yyyyMMdd')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Failed to export logs", error);
    } finally {
      setExporting(false);
    }
  };

  if (!isAdmin && !isSystemAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
        <p className="text-slate-500 max-w-md">
          You do not have the required permissions to view the inquiry history. 
          Please contact a system administrator if you believe this is an error.
        </p>
      </div>
    );
  }

  if (loading && logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <ScaleLoader color="#2563eb" height={50} width={5} radius={2} margin={3} />
        <div className="mt-8 flex flex-col items-center gap-2">
          <span className="text-sm font-bold tracking-[0.3em] uppercase text-slate-900">Inquiry Logs</span>
          <p className="text-xs text-slate-400 animate-pulse font-medium">Connecting to secure audit database...</p>
        </div>
      </div>
    );
  }

  const getActionColor = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('add')) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (act.includes('delete')) return 'bg-red-50 text-red-700 border-red-100';
    if (act.includes('transfer')) return 'bg-orange-50 text-orange-700 border-orange-100';
    if (act.includes('update') || act.includes('edit')) return 'bg-blue-50 text-blue-700 border-blue-100';
    return 'bg-slate-50 text-slate-700 border-slate-100';
  };

  const getActionIcon = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('add')) return <Plus className="w-3.5 h-3.5" />;
    if (act.includes('delete')) return <Trash2 className="w-3.5 h-3.5" />;
    if (act.includes('transfer')) return <ArrowRightLeft className="w-3.5 h-3.5" />;
    if (act.includes('update') || act.includes('edit')) return <Edit2 className="w-3.5 h-3.5" />;
    return <History className="w-3.5 h-3.5" />;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Sticky Header & Filters Section */}
      <div className="sticky top-[-16px] md:top-[-32px] z-30 bg-slate-50 pt-4 md:pt-8 pb-6 -mt-4 md:-mt-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
              <ClipboardList className="w-8 h-8 text-blue-600" />
              Inquiry History
            </h1>
            <p className="text-slate-500 mt-1">Audit logs for system activities, changes, and user login logs</p>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'login' && (isAdmin || isSystemAdmin) && (
              <button 
                onClick={handleClearLoginLogs}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm shadow-red-100 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Clear Session Logs
              </button>
            )}
            <button 
              onClick={activeTab === 'activity' ? handleExport : handleExportLoginLogs}
              disabled={activeTab === 'activity' ? (exporting || logs.length === 0) : (filteredLoginLogs.length === 0)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Download className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
              {activeTab === 'activity' ? (exporting ? 'Exporting...' : 'Export Logs') : 'Export Session Logs'}
            </button>
            <button 
              onClick={activeTab === 'activity' ? fetchLogs : fetchLoginLogs}
              className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
              title="Refresh logs"
            >
              <History className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('activity')}
            className={cn(
              "flex items-center gap-2 px-6 py-3 font-semibold text-sm border-b-2 transition-all cursor-pointer",
              activeTab === 'activity'
                ? "border-blue-600 text-blue-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            <History className="w-4 h-4" />
            Activity Audit Logs
          </button>
          <button
            onClick={() => setActiveTab('login')}
            className={cn(
              "flex items-center gap-2 px-6 py-3 font-semibold text-sm border-b-2 transition-all cursor-pointer",
              activeTab === 'login'
                ? "border-blue-600 text-blue-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            <LogIn className="w-4 h-4" />
            Login Session Logs
          </button>
        </div>

        {/* Filters Header (Activity Logs) */}
        {activeTab === 'activity' && (
          <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden shrink-0">
            <div className="p-4 md:p-6 flex flex-col gap-4 bg-slate-50/50">
              <div className="flex flex-col md:flex-row gap-4 justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name, ID, user or details..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm shadow-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={fetchLogs}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm flex items-center gap-2"
                  >
                    <Search className="w-5 h-5" />
                    Search
                  </button>
                  <button 
                    onClick={() => setShowFilters(!showFilters)}
                    className={cn(
                      "flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all shadow-sm",
                      showFilters ? "bg-blue-100 text-blue-700" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <Filter className="w-5 h-5" />
                    Filters
                  </button>
                </div>
              </div>

              {showFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-200 animate-in slide-in-from-top-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600 ml-1">Entity Category</label>
                    <div className="relative">
                      <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <select
                        value={filters.entity_type}
                        onChange={(e) => setFilters({ ...filters, entity_type: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm appearance-none shadow-sm"
                      >
                        <option value="All">All Categories</option>
                        <option value="Asset">Assets</option>
                        <option value="License">Licenses</option>
                        <option value="Employee">Employees</option>
                        <option value="Telecom">Telecom Services</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600 ml-1">Performed By</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <select
                        value={filters.user_name}
                        onChange={(e) => setFilters({ ...filters, user_name: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm appearance-none shadow-sm"
                      >
                        <option value="All">All Users</option>
                        {logUsers.map((user, idx) => (
                          <option key={idx} value={user.user_name}>{user.user_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600 ml-1">From Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="date"
                        value={filters.from_date}
                        onChange={(e) => setFilters({ ...filters, from_date: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600 ml-1">To Date</label>
                    <div className="relative flex gap-2">
                      <div className="relative flex-1">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="date"
                          value={filters.to_date}
                          onChange={(e) => setFilters({ ...filters, to_date: e.target.value })}
                          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm shadow-sm"
                        />
                      </div>
                      <button
                        onClick={() => setFilters({ from_date: "", to_date: "", entity_type: "All", user_name: "All", search: "" })}
                        className="py-2.5 px-4 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                        title="Clear All"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Filters Header (Login Logs) */}
        {activeTab === 'login' && (
          <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden shrink-0">
            <div className="p-4 md:p-6 flex flex-col md:flex-row gap-4 bg-slate-50/50 justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by user, device, IP or location..."
                  value={loginSearch}
                  onChange={(e) => setLoginSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm shadow-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={fetchLoginLogs}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <History className="w-5 h-5" />
                  Refresh
                </button>
                {loginSearch && (
                  <button
                    onClick={() => setLoginSearch("")}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-bold transition-all cursor-pointer"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Logs Table Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {activeTab === 'activity' ? (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-20 bg-white shadow-sm">
                  <tr className="bg-slate-50/80 border-b border-slate-200">
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[150px]">Name</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[150px]">Identity</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[120px]">Performed By</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[100px]">Entity</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[120px]">Action</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[140px]">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <AnimatePresence mode="popLayout">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-24 text-center">
                          <div className="flex flex-col items-center justify-center gap-4">
                            <ScaleLoader color="#2563eb" height={35} width={4} radius={2} margin={2} />
                            <span className="text-sm font-medium text-slate-500 uppercase tracking-[0.2em] animate-pulse">Loading Logs</span>
                          </div>
                        </td>
                      </tr>
                    ) : logs.length > 0 ? (
                      logs.map((log) => (
                        <motion.tr 
                          key={log.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-slate-900 line-clamp-1" title={log.entity_name}>
                              {(!log.entity_name || log.entity_name === "null") ? "—" : log.entity_name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium line-clamp-1 mt-0.5" title={log.details}>
                              {(!log.details || log.details === "null") ? "—" : log.details}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm font-mono text-slate-600 bg-slate-100/50 px-2 py-0.5 rounded border border-slate-200 inline-block">
                              {(!log.entity_identity || log.entity_identity === "null") ? "—" : log.entity_identity}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                                <User className="w-3 h-3 text-slate-500" />
                              </div>
                              <span className="text-sm font-medium text-slate-700">{log.user_name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                              log.entity_type === 'Asset' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                              log.entity_type === 'License' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                              log.entity_type === 'Employee' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                              'bg-amber-50 text-amber-600 border-amber-100'
                            }`}>
                              {log.entity_type}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${getActionColor(log.action)}`}>
                              {getActionIcon(log.action)}
                              {log.action}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-slate-900">
                              {format(new Date(log.created_at), 'MMM dd, yyyy')}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {format(new Date(log.created_at), 'HH:mm:ss')}
                            </div>
                          </td>
                        </motion.tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <History className="w-8 h-8 text-slate-200" />
                            <p className="text-slate-400 text-sm">No activity logs found matching the filters.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-slate-100">
              <AnimatePresence mode="popLayout">
                {loading ? (
                  <div className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <ScaleLoader color="#2563eb" height={35} width={4} radius={2} margin={2} />
                      <span className="text-sm font-medium text-slate-500 uppercase tracking-[0.2em] animate-pulse">Loading Logs</span>
                    </div>
                  </div>
                ) : logs.length > 0 ? (
                  logs.map((log) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="p-4 bg-white active:bg-slate-50 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-slate-900">
                            {(!log.entity_name || log.entity_name === "null") ? "N/A" : log.entity_name}
                          </h3>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {(!log.entity_identity || log.entity_identity === "null") ? "N/A" : log.entity_identity}
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                          log.entity_type === 'Asset' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                          log.entity_type === 'License' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                          log.entity_type === 'Employee' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                          'bg-amber-50 text-amber-600 border-amber-100'
                        }`}>
                          {log.entity_type}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${getActionColor(log.action)}`}>
                          {getActionIcon(log.action)}
                          {log.action}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium ml-auto">
                          <User className="w-3 h-3" />
                          {log.user_name}
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[10px]">
                        <p className="text-slate-400 italic line-clamp-1 flex-1 mr-4 pr-1 border-r border-slate-100">
                          {log.details}
                        </p>
                        <div className="text-slate-500 font-mono text-right whitespace-nowrap">
                          {format(new Date(log.created_at), 'M/d/yy HH:mm')}
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="p-12 text-center text-slate-400 italic bg-white">
                    No logs found.
                  </div>
                )}
              </AnimatePresence>
            </div>

            {logs.length > 0 && (
              <div className="p-4 bg-slate-50/30 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs text-slate-400 font-medium font-mono uppercase tracking-tighter">
                  Showing {logs.length} activities
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">Secure Audit Trail</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Desktop Login Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-20 bg-white shadow-sm">
                  <tr className="bg-slate-50/80 border-b border-slate-200">
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[120px]">User</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[180px]">Device & Browser</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[130px]">IP Address</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[160px]">Location</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[140px]">Login Time</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[140px]">Logout Time</th>
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[100px]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <AnimatePresence mode="popLayout">
                    {loginLoading ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-24 text-center">
                          <div className="flex flex-col items-center justify-center gap-4">
                            <ScaleLoader color="#2563eb" height={35} width={4} radius={2} margin={2} />
                            <span className="text-sm font-medium text-slate-500 uppercase tracking-[0.2em] animate-pulse">Loading Sessions</span>
                          </div>
                        </td>
                      </tr>
                    ) : filteredLoginLogs.length > 0 ? (
                      filteredLoginLogs.map((log) => (
                        <motion.tr 
                          key={log.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                                <User className="w-4 h-4 text-blue-600" />
                              </div>
                              <span className="text-sm font-semibold text-slate-800">{log.username}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Monitor className="w-4 h-4 text-slate-400 flex-shrink-0" />
                              <span className="text-sm font-medium text-slate-700">{log.device_name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                              {log.ip}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <button 
                              onClick={() => handleLocationClick(log.location)}
                              className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-blue-600 hover:underline transition-colors text-left font-medium group"
                              title="Click to view this live location on Google Maps"
                            >
                              <MapPin className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                              <span>{log.location}</span>
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-slate-900">
                              {log.login_time ? format(new Date(log.login_time), 'MMM dd, yyyy') : '—'}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {log.login_time ? format(new Date(log.login_time), 'HH:mm:ss') : '—'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {log.logout_time ? (
                              <>
                                <div className="text-sm font-medium text-slate-900">
                                  {format(new Date(log.logout_time), 'MMM dd, yyyy')}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  {format(new Date(log.logout_time), 'HH:mm:ss')}
                                </div>
                              </>
                            ) : (
                              <span className="text-xs font-semibold text-slate-400 italic">Still Active</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                              !log.logout_time 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100 animate-pulse' 
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              {!log.logout_time ? 'Active' : 'Closed'}
                            </span>
                          </td>
                        </motion.tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <History className="w-8 h-8 text-slate-200" />
                            <p className="text-slate-400 text-sm">No login logs found.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Mobile Login Card View */}
            <div className="md:hidden divide-y divide-slate-100">
              <AnimatePresence mode="popLayout">
                {loginLoading ? (
                  <div className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center justify-center gap-4">
                      <ScaleLoader color="#2563eb" height={35} width={4} radius={2} margin={2} />
                      <span className="text-sm font-medium text-slate-500 uppercase tracking-[0.2em] animate-pulse">Loading Sessions</span>
                    </div>
                  </div>
                ) : filteredLoginLogs.length > 0 ? (
                  filteredLoginLogs.map((log) => (
                    <motion.div 
                      key={log.id} 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="p-4 bg-white active:bg-slate-50 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center">
                            <User className="w-3.5 h-3.5 text-blue-600" />
                          </div>
                          <span className="text-sm font-bold text-slate-900">{log.username}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${
                          !log.logout_time 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {!log.logout_time ? 'Active' : 'Closed'}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-xs text-slate-600 my-2.5">
                        <div className="flex items-center gap-2">
                          <Monitor className="w-3.5 h-3.5 text-slate-400" />
                          <span>{log.device_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <button 
                            onClick={() => handleLocationClick(log.location)}
                            className="text-slate-600 hover:text-blue-600 hover:underline transition-colors text-left font-medium"
                            title="Click to view this live location on Google Maps"
                          >
                            {log.location}
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 text-[10px]">
                            IP: {log.ip}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-[10px] pt-2 border-t border-slate-50 text-slate-400">
                        <div>
                          <span className="font-semibold block text-slate-500">In</span>
                          {log.login_time ? format(new Date(log.login_time), 'M/d/yy HH:mm') : '—'}
                        </div>
                        <div className="text-right">
                          <span className="font-semibold block text-slate-500">Out</span>
                          {log.logout_time ? format(new Date(log.logout_time), 'M/d/yy HH:mm') : <span className="italic text-slate-400">Still Active</span>}
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="p-12 text-center text-slate-400 italic bg-white">
                    No logs found.
                  </div>
                )}
              </AnimatePresence>
            </div>

            {filteredLoginLogs.length > 0 && (
              <div className="p-4 bg-slate-50/30 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs text-slate-400 font-medium font-mono uppercase tracking-tighter">
                  Showing {filteredLoginLogs.length} sessions
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">Secure Audit Trail</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
