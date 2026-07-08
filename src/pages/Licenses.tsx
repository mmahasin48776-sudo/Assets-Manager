import React, { useState, useEffect } from "react";
import { SearchableSelect } from "../components/SearchableSelect";
import { 
  Key, 
  Plus, 
  Search, 
  Filter,
  Edit, 
  Trash2, 
  UserPlus, 
  RotateCcw,
  ShieldCheck,
  Calendar,
  Download,
  X,
  Upload,
  File as FileIcon,
  QrCode,
  History,
  FileText
} from "lucide-react";
import { toast } from "react-hot-toast";
import axios from "axios";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useLocation } from "react-router-dom";
import { useAuth, useData } from "../App";
import ConfirmModal from "../components/ConfirmModal";
import AlertModal from "../components/AlertModal";
import LoadingSpinner from "../components/LoadingSpinner";
import { downloadFile, viewFile } from "../utils/downloadHelper";
import { SearchableEmployeeSelect } from "../components/SearchableEmployeeSelect";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { QRCodeSVG } from "qrcode.react";
import Barcode from "react-barcode";

export default function Licenses() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const statusParam = queryParams.get("status");

  const { isAdmin, isSystemAdmin } = useAuth();
  const { data, ensureData, refreshData } = useData();
  const licenses = data.licenses;
  const employees = data.employees;
  const types = data.licenseTypes;
  const vendors = data.vendors;
  const licenseNames = data.licenseNames;
  const locations = data.locations;
  
  const [loading, setLoading] = useState(!licenses.length || !types.length);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showLabelsModal, setShowLabelsModal] = useState(false);
  const [filters, setFilters] = useState({
    status: statusParam || "Available",
    location: "All",
    serial_key: "",
    po_number: "",
    cost: ""
  });

  useEffect(() => {
    if (statusParam) {
      setFilters(prev => ({ ...prev, status: statusParam }));
    }
  }, [statusParam]);

  const targetId = queryParams.get("id");
  const highlightId = queryParams.get("highlight");
  const searchParam = queryParams.get("search");

  useEffect(() => {
    if (searchParam) {
      setSearch(searchParam);
      setFilters(prev => ({ ...prev, status: "All", location: "All", serial_key: "", po_number: "", cost: "" }));
    } else if (targetId && licenses.length > 0) {
      const target = licenses.find((l: any) => l.id === parseInt(targetId));
      if (target && !search) {
        // Let's use name or SN if available
        setSearch(target.serial_key || target.name);
        setFilters(prev => ({ ...prev, status: "All", location: "All", serial_key: "", po_number: "", cost: "" }));
      }
    } else if (!searchParam && !targetId && !statusParam) {
      // Clear filters if no specific parameters are set
      setSearch("");
      setFilters({
        status: "All",
        location: "All",
        serial_key: "",
        po_number: "",
        cost: ""
      });
    }
  }, [targetId, searchParam, statusParam, licenses.length]);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnLicense, setReturnLicense] = useState<any>(null);
  const [returnData, setReturnData] = useState({ notes: "" });
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });
  const [alertState, setAlertState] = useState<{ isOpen: boolean, title: string, message: string, type: 'success' | 'error' | 'info' }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info"
  });
  const [isEditing, setIsEditing] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState<any>(null);
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [licenseHistory, setLicenseHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  const [newLicense, setNewLicense] = useState({
    sn: "", name: "", type_id: "", validity_type: "Yearly", serial_key: "", cost: "", 
    vendor_id: "", po_number: "", expire_start: "", expire_end: "", status: "Available", location_id: ""
  });

  const [assignData, setAssignData] = useState({ employee_id: "", notes: "" });
  const [licensePdf, setLicensePdf] = useState<File | null>(null);

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        ensureData("licenses"),
        ensureData("employees"),
        ensureData("master") // loads licenseTypes, vendors, licenseNames, locations, etc.
      ]);
      setLoading(false);
    };
    loadData();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let licenseToSave = { ...newLicense };
    
    if (licenseToSave.validity_type !== 'Yearly') {
      licenseToSave.expire_start = "";
      licenseToSave.expire_end = "";
    }
    
    // Auto-generate numeric SN if not editing and SN is empty
    if (!isEditing && !licenseToSave.sn) {
      const licArray = Array.isArray(licenses) ? licenses : [];
      const maxSn = licArray.reduce((max, l) => {
        const num = parseInt(l.sn);
        return isNaN(num) ? max : Math.max(max, num);
      }, 0);
      licenseToSave.sn = (maxSn + 1).toString();
    }

    const savePromise = (async () => {
      const formData = new FormData();
      Object.entries(licenseToSave).forEach(([key, value]) => {
        formData.append(key, value as string);
      });

      if (licensePdf) {
        if (licensePdf.size > 10 * 1024 * 1024) {
          throw new Error("File is too large. Maximum allow: 10MB");
        }
        formData.append("pdf", licensePdf);
      }

      let res;
      if (isEditing && selectedLicense) {
        formData.append("_method", "PUT");
        res = await axios.post(`/api/licenses/${selectedLicense.id}`, formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      } else {
        res = await axios.post("/api/licenses", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      }
      if (res.data && res.data.success === false) {
        throw new Error(res.data.message || "Failed to save license");
      }
      refreshData("licenses");
      setShowAddModal(false);
      setIsEditing(false);
      setSelectedLicense(null);
      setLicensePdf(null);
      setNewLicense({
        sn: "", name: "", type_id: "", validity_type: "Yearly", serial_key: "", cost: "", 
        vendor_id: "", po_number: "", expire_start: "", expire_end: "", status: "Available", location_id: ""
      });
    })();

    toast.promise(savePromise, {
      loading: isEditing ? 'Updating license...' : 'Saving license...',
      success: 'License saved successfully!',
      error: (err) => `Failed to save license: ${err.response?.data?.message || err.message}`
    });
  };

  const generateSN = () => {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.floor(1000 + Math.random() * 9000);
    setNewLicense({ ...newLicense, sn: `LIC-${date}-${random}` });
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("employee_id", assignData.employee_id);
    formData.append("notes", assignData.notes);
    if (assignmentFile) {
      if (assignmentFile.size > 10 * 1024 * 1024) {
        toast.error("File is too large. Maximum allow: 10MB");
        return;
      }
      formData.append("pdf", assignmentFile);
    }
    const assignPromise = (async () => {
      const res = await axios.post(`/api/licenses/${selectedLicense.id}/assign`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      if (res.data && res.data.success === false) {
        throw new Error(res.data.message || "Failed to assign license");
      }
      refreshData("licenses");
      setShowAssignModal(false);
      setAssignData({ employee_id: "", notes: "" });
      setAssignmentFile(null);
    })();

    toast.promise(assignPromise, {
      loading: 'Assigning license...',
      success: 'License assigned successfully!',
      error: (err) => err.message || 'Failed to assign license.'
    });
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("employee_id", assignData.employee_id);
    formData.append("notes", assignData.notes);
    if (assignmentFile) {
      if (assignmentFile.size > 10 * 1024 * 1024) {
        toast.error("File is too large. Maximum allow: 10MB");
        return;
      }
      formData.append("pdf", assignmentFile);
    }
    const transferPromise = (async () => {
      const res = await axios.post(`/api/licenses/${selectedLicense.id}/transfer`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      if (res.data && res.data.success === false) {
        throw new Error(res.data.message || "Failed to transfer license");
      }
      refreshData("licenses");
      setShowTransferModal(false);
      setAssignData({ employee_id: "", notes: "" });
      setAssignmentFile(null);
    })();

    toast.promise(transferPromise, {
      loading: 'Transferring license...',
      success: 'License transferred successfully!',
      error: (err) => err.message || 'Failed to transfer license.'
    });
  };

  const handleReturn = (license: any) => {
    setReturnLicense(license);
    setReturnData({ notes: "" });
    setShowReturnModal(true);
  };

  const submitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnLicense) return;

    const returnPromise = (async () => {
      const res = await axios.post(`/api/licenses/${returnLicense.id}/return`, { notes: returnData.notes });
      if (res.data && res.data.success === false) {
        throw new Error(res.data.message || "Failed to return license");
      }

      refreshData("licenses");
      setShowReturnModal(false);
      setReturnLicense(null);
      setReturnData({ notes: "" });
    })();

    toast.promise(returnPromise, {
      loading: 'Returning license...',
      success: 'License returned successfully!',
      error: (err) => err.message || 'Failed to return license.'
    });
  };

  const handleDelete = async (id: number) => {
    setConfirmState({
      isOpen: true,
      title: "Delete License",
      message: "Are you sure you want to delete this license?",
      onConfirm: async () => {
        const deletePromise = (async () => {
          await axios.post(`/api/licenses/${id}`, { _method: 'DELETE' });
          refreshData("licenses");
          setShowAddModal(false);
          setIsEditing(false);
          setSelectedLicense(null);
        })();

        toast.promise(deletePromise, {
          loading: 'Deleting license...',
          success: 'License deleted successfully!',
          error: 'Failed to delete license.'
        });
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const fetchLicenseHistory = async (id: number) => {
    setHistoryLoading(true);
    setShowHistoryModal(true);
    try {
      const res = await axios.get(`/api/licenses/${id}/history`);
      setLicenseHistory(res.data);
    } catch (error) {
      console.error("Failed to fetch license history:", error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const filtered = (Array.isArray(licenses) ? licenses : []).filter(lic => {
    let matchesSearch = true;
    if (search.trim()) {
      const searchWords = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
      matchesSearch = searchWords.every(word => 
        Object.values(lic).some(val => 
          val !== null && val !== undefined && String(val).toLowerCase().includes(word)
        )
      );
    }
    
    const matchesStatus = filters.status === "All" || (lic.status || "Available") === filters.status;
    const matchesLocation = filters.location === "All" || lic.location_name === filters.location;
    const matchesSerial = !filters.serial_key || (lic.serial_key && lic.serial_key.toLowerCase().includes(filters.serial_key.toLowerCase()));
    const matchesPo = !filters.po_number || (lic.po_number && lic.po_number.includes(filters.po_number));
    const matchesCost = !filters.cost || (lic.cost && lic.cost.toString().includes(filters.cost));

    return matchesSearch && matchesStatus && matchesLocation && matchesSerial && matchesPo && matchesCost;
  }).sort((a, b) => b.id - a.id);

  useEffect(() => {
    if (highlightId && !loading && filtered.length > 0) {
      // Small timeout to ensure DOM is ready
      const timer = setTimeout(() => {
        const isMobile = window.innerWidth < 1024;
        const idPrefix = isMobile ? 'lic-mobile-' : 'lic-';
        const element = document.getElementById(`${idPrefix}${highlightId}`);
        
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          // Fallback to any element with that ID if the specific prefix one isn't found
          const fallback = document.getElementById(`lic-${highlightId}`) || document.getElementById(`lic-mobile-${highlightId}`);
          if (fallback) {
            fallback.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [highlightId, loading, filtered.length]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="sticky top-[-16px] md:top-[-32px] z-30 bg-slate-50 pt-4 md:pt-8 pb-4 -mt-4 md:-mt-8 space-y-6">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Licenses</h1>
            <p className="text-slate-500 mt-1">Manage software keys and seat assignments.</p>
          </div>
          {isAdmin && (
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <button 
                onClick={() => {
                  const params = new URLSearchParams();
                  if (filters.status !== "All") params.append("status", filters.status);
                  downloadFile(`/api/export/licenses?${params.toString()}`, 'licenses_report.csv');
                }}
                className="bg-white text-slate-700 border border-slate-200 px-6 py-3 rounded-xl font-bold shadow-sm hover:bg-slate-50 transition-all duration-300 flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <Download className="w-5 h-5" />
                Export to Excel
              </button>
              <button 
                onClick={() => setShowAddModal(true)}
                className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all duration-300 flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <Plus className="w-5 h-5" />
                Add License
              </button>
            </div>
          )}
        </header>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-md shrink-0">
          <div className="p-4 md:p-6 flex flex-col gap-4 bg-slate-50/50">
            <div className="flex flex-col md:flex-row gap-4 justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search...." 
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all shadow-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-sm",
                  showFilters ? "bg-emerald-100 text-emerald-700" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                <Filter className="w-5 h-5" />
                Filters
              </button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-200 animate-in slide-in-from-top-2">
                <SearchableSelect
                  className="w-full"
                  value={filters.status}
                  options={[
                    { label: "All Status", value: "All" },
                    { label: "Available", value: "Available" },
                    { label: "Assigned", value: "Assigned" },
                    { label: "Expired", value: "Expired" },
                    { label: "Cancel", value: "Cancel" }
                  ]}
                  onChange={(val) => setFilters({...filters, status: val})}
                  placeholder="All Status"
                />
                <SearchableSelect
                  className="w-full"
                  value={filters.location}
                  options={[
                    { label: "All Locations", value: "All" },
                    ...(Array.isArray(locations) ? locations : []).map(l => ({ label: l.name, value: l.name }))
                  ]}
                  onChange={(val) => setFilters({...filters, location: val})}
                  placeholder="All Locations"
                />
                <input 
                  type="text"
                  placeholder="Filter by Serial Key"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white shadow-sm"
                  value={filters.serial_key}
                  onChange={(e) => setFilters({...filters, serial_key: e.target.value})}
                />
                <input 
                  type="text"
                  placeholder="Filter by PO Number"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white shadow-sm"
                  value={filters.po_number}
                  onChange={(e) => setFilters({...filters, po_number: e.target.value})}
                />
                <input 
                  type="text"
                  placeholder="Filter by Cost"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white shadow-sm"
                  value={filters.cost}
                  onChange={(e) => setFilters({...filters, cost: e.target.value})}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead className="sticky top-0 z-20 bg-white shadow-sm">
              <tr className="bg-slate-50/80 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                <th className="px-6 py-4">System SN</th>
                <th className="px-6 py-4">License Name</th>
                <th className="px-6 py-4">Serial Key / Product Key</th>
                <th className="px-6 py-4">Vendor</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Assigned To</th>
                <th className="px-6 py-4">Cost</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Doc</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((lic) => (
                <tr 
                  key={lic.id} 
                  id={`lic-${lic.id}`}
                  className={cn(
                    "hover:bg-emerald-50/50 transition-colors group",
                    highlightId && String(highlightId) === String(lic.id) && "bg-emerald-200 outline outline-2 outline-emerald-500 shadow-md relative z-10"
                  )}
                >
                  <td className="px-6 py-4">
                    <span className="text-xs font-mono text-slate-600 font-bold">{lic.sn}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-slate-900">{lic.name}</span>
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-slate-600 font-bold break-all">{lic.serial_key || "-"}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-medium">{lic.vendor_name || "-"}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-medium">{lic.validity_type || 'Yearly'}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-medium">{lic.location_name || "-"}</td>
                  <td className="px-6 py-4">
                    {lic.employee_name ? (
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-700">{lic.employee_name}</span>
                        <span className="text-[10px] text-slate-400 uppercase">Employee</span>
                      </div>
                    ) : (
                      <span className="text-slate-300 text-sm italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-700">SR {Number(lic.cost).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      (lic.status || "Available") === "Available" ? "bg-emerald-100 text-emerald-700" : 
                      (lic.status || "Available") === "Assigned" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
                    )}>
                      {lic.status || "Available"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {lic.pdf_path && (
                      <button 
                        onClick={() => viewFile(encodeURI(lic.pdf_path.startsWith('/') ? lic.pdf_path : `/${lic.pdf_path}`))} 
                        className="p-1.5 text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                        title="View Document"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {isAdmin && (
                        <>
                          <button 
                            onClick={() => {
                              setSelectedLicense(lic);
                              setShowLabelsModal(true);
                            }}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                            title="View Labels"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => fetchLicenseHistory(lic.id)}
                            className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all"
                            title="View History"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          {(lic.status || "Available") === "Available" ? (
                            <button 
                              onClick={() => { 
                                setSelectedLicense(lic); 
                                setAssignData({ employee_id: "", notes: "" });
                                setAssignmentFile(null);
                                setShowAssignModal(true); 
                              }}
                              className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                              title="Assign to Employee"
                            >
                              <UserPlus className="w-4 h-4" />
                            </button>
                          ) : (
                            <>
                              <button 
                                onClick={() => { 
                                  setSelectedLicense(lic); 
                                  setAssignData({ employee_id: "", notes: "" });
                                  setAssignmentFile(null);
                                  setShowTransferModal(true); 
                                }}
                                className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                title="Transfer License"
                              >
                                <UserPlus className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleReturn(lic)}
                                className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors"
                                title="Return License"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Return
                              </button>
                            </>
                          )}
                          <button 
                            onClick={() => {
                              setSelectedLicense(lic);
                              setIsEditing(true);
                              setNewLicense({
                                sn: lic.sn || "",
                                name: lic.name || "",
                                type_id: lic.type_id?.toString() || "",
                                validity_type: lic.validity_type || "Yearly",
                                serial_key: lic.serial_key || "",
                                cost: lic.cost?.toString() || "",
                                vendor_id: lic.vendor_id?.toString() || "",
                                po_number: lic.po_number || "",
                                expire_start: lic.expire_start || "",
                                expire_end: lic.expire_end || "",
                                status: lic.status || "Available",
                                location_id: lic.location_id?.toString() || ""
                              });
                              setShowAddModal(true);
                            }}
                            className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {isSystemAdmin && (
                            <button 
                              onClick={() => handleDelete(lic.id)}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                    No licenses found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Add License Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl animate-in zoom-in duration-300 mt-10 mb-10">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-3xl">
              <h2 className="text-2xl font-bold text-slate-900">{isEditing ? "Edit License" : "Add New License"}</h2>
              <button onClick={() => { setShowAddModal(false); setIsEditing(false); setSelectedLicense(null); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2 hidden">
                  <label className="text-sm font-bold text-slate-700">System SN (Auto-generated if empty)</label>
                  <input type="text" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="Leave empty to auto-generate"
                    value={newLicense.sn} onChange={(e) => setNewLicense({...newLicense, sn: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">License Name</label>
                  <SearchableSelect
                    required
                    options={(Array.isArray(licenseNames) ? licenseNames : []).map(ln => ({ label: ln.name, value: ln.name }))}
                    value={newLicense.name}
                    onChange={(val) => setNewLicense({...newLicense, name: val})}
                    placeholder="Select License Name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">License Category</label>
                  <SearchableSelect
                    required
                    options={(Array.isArray(types) ? types : []).map(t => ({ label: t.name, value: t.id }))}
                    value={newLicense.type_id}
                    onChange={(val) => setNewLicense({...newLicense, type_id: val})}
                    placeholder="Select Category"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">License Type</label>
                  <SearchableSelect
                    required
                    options={[
                      { label: "Yearly", value: "Yearly" },
                      { label: "Lifetime", value: "Lifetime" }
                    ]}
                    value={newLicense.validity_type}
                    onChange={(val) => setNewLicense({...newLicense, validity_type: val})}
                    placeholder="Select Type"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-bold text-slate-700">Serial Key / Product Key</label>
                  <input required type="text" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                    value={newLicense.serial_key} onChange={(e) => setNewLicense({...newLicense, serial_key: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Cost (SR)</label>
                  <input required type="number" step="0.01" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    value={newLicense.cost} onChange={(e) => setNewLicense({...newLicense, cost: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Vendor</label>
                  <SearchableSelect
                    required
                    options={(Array.isArray(vendors) ? vendors : []).map(v => ({ label: v.name, value: v.id }))}
                    value={newLicense.vendor_id}
                    onChange={(val) => setNewLicense({...newLicense, vendor_id: val})}
                    placeholder="Select Vendor"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">PO Number</label>
                  <input type="text" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    value={newLicense.po_number} onChange={(e) => setNewLicense({...newLicense, po_number: e.target.value})} />
                </div>
                {newLicense.validity_type === 'Yearly' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Expiry Start</label>
                      <input type="date" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white"
                        value={newLicense.expire_start} onChange={(e) => setNewLicense({...newLicense, expire_start: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Expiry End</label>
                      <input type="date" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white"
                        value={newLicense.expire_end} onChange={(e) => setNewLicense({...newLicense, expire_end: e.target.value})} />
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Status</label>
                  <SearchableSelect
                    required
                    options={[
                      { label: "Available", value: "Available" },
                      { label: "Assigned", value: "Assigned" },
                      { label: "Expired", value: "Expired" },
                      { label: "Cancel", value: "Cancel" }
                    ]}
                    value={newLicense.status}
                    onChange={(val) => setNewLicense({...newLicense, status: val})}
                    placeholder="Select Status"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Location</label>
                  <SearchableSelect
                    options={(Array.isArray(locations) ? locations : []).map(l => ({ label: l.name, value: l.id }))}
                    value={newLicense.location_id}
                    onChange={(val) => setNewLicense({...newLicense, location_id: val})}
                    placeholder="Select Location"
                  />
                </div>

              </div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4 border-t border-slate-100">
                {isEditing && isSystemAdmin && (
                  <button 
                    type="button" 
                    onClick={() => handleDelete(selectedLicense.id)}
                    className="flex items-center justify-center w-full sm:w-auto gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-all font-bold"
                  >
                    <Trash2 className="w-5 h-5" />
                    Delete License
                  </button>
                )}
                <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto ml-auto">
                  <button type="button" onClick={() => setShowAddModal(false)} className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
                  {newLicense.location_id && (
                    <button type="submit" className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all">Save License</button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in duration-300 mt-10 mb-10">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-3xl">
              <h2 className="text-2xl font-bold text-slate-900">Assign License</h2>
              <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleAssign} className="p-8 space-y-6">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">License Selected</p>
                <p className="font-bold text-slate-900">{selectedLicense?.name}</p>
                <p className="text-xs font-mono text-slate-500">{selectedLicense?.sn}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Assign to Employee</label>
                <SearchableEmployeeSelect 
                  employees={employees}
                  value={assignData.employee_id}
                  onChange={(val) => setAssignData({...assignData, employee_id: val})}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Assignment Notes</label>
                <textarea className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" rows={3}
                  value={assignData.notes} onChange={(e) => setAssignData({...assignData, notes: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Handover Document (PDF)</label>
                <input 
                  type="file" 
                  accept=".pdf"
                  onChange={(e) => setAssignmentFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 transition-all font-sans"
                />
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-4 pt-4">
                <button type="button" onClick={() => setShowAssignModal(false)} className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
                <button type="submit" className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all">Confirm Assignment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in duration-300 mt-10 mb-10">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-3xl">
              <h2 className="text-2xl font-bold text-slate-900">Transfer License</h2>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleTransfer} className="p-8 space-y-6">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">License Selected</p>
                <p className="font-bold text-slate-900">{selectedLicense?.name}</p>
                <p className="text-xs font-mono text-slate-500">{selectedLicense?.sn}</p>
                <p className="text-xs font-bold text-slate-400 uppercase mt-2 mb-1">Current Employee</p>
                <p className="font-bold text-slate-900">{selectedLicense?.employee_name}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Transfer to Employee</label>
                <SearchableEmployeeSelect 
                  employees={employees}
                  value={assignData.employee_id}
                  onChange={(val) => setAssignData({...assignData, employee_id: val})}
                  excludeEmployeeId={selectedLicense?.assigned_employee_id}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Transfer Notes</label>
                <textarea className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" rows={3}
                  value={assignData.notes} onChange={(e) => setAssignData({...assignData, notes: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Transfer Document (PDF)</label>
                <input 
                  type="file" 
                  accept=".pdf"
                  onChange={(e) => setAssignmentFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all font-sans"
                />
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-4 pt-4">
                <button type="button" onClick={() => setShowTransferModal(false)} className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
                <button type="submit" className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold bg-blue-500 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-all">Confirm Transfer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReturnModal && returnLicense && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Return License</h2>
              <button onClick={() => setShowReturnModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={submitReturn} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Return Notes</label>
                <textarea
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  rows={3}
                  value={returnData.notes}
                  onChange={(e) => setReturnData({ ...returnData, notes: e.target.value })}
                  placeholder="Reason for return, condition, etc."
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowReturnModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors shadow-sm shadow-emerald-200">
                  Confirm Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState({ ...confirmState, isOpen: false })}
      />
      {/* Labels Modal */}
      {/* Labels Modal */}
      {showLabelsModal && selectedLicense && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold text-slate-900">License Labels</h2>
              <button onClick={() => setShowLabelsModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <div className="p-8 space-y-6 flex flex-col items-center">
              <div className="text-center space-y-2">
                <p className="font-bold text-slate-900 text-lg">{selectedLicense.name}</p>
                <p className="text-sm font-mono text-slate-500">{selectedLicense.serial_key}</p>
              </div>
              
              <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col items-center gap-4 w-full">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">QR Code</p>
                <QRCodeSVG 
                  value={`License: ${selectedLicense.name}\nKey: ${selectedLicense.serial_key}`} 
                  size={160} 
                  level="M" 
                  includeMargin={true}
                />
              </div>

              <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col items-center gap-4 w-full overflow-hidden">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Barcode</p>
                <Barcode value={selectedLicense.serial_key} width={2} height={60} fontSize={14} background="transparent" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl animate-in zoom-in duration-300 max-h-[90vh] flex flex-col">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-3xl">
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <History className="w-6 h-6 text-indigo-500" />
                License Assignment History
              </h2>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <div className="p-8 overflow-y-auto flex-1">
              {historyLoading ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner />
                </div>
              ) : licenseHistory.length === 0 ? (
                <div className="text-center py-12 text-slate-500 italic">
                  No history found for this license.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Action</th>
                        <th className="px-4 py-3">Summary</th>
                        <th className="px-4 py-3">Notes</th>
                        <th className="px-4 py-3 text-right">Doc</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(Array.isArray(licenseHistory) ? licenseHistory : []).map((h) => (
                        <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-4 text-sm text-slate-600 whitespace-nowrap">
                            {new Date(h.action_date).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-4">
                            <span className={cn(
                              "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider",
                              h.action_type === 'Assigned' ? "bg-emerald-100 text-emerald-700" :
                              h.action_type === 'Returned' ? "bg-amber-100 text-amber-700" :
                              h.action_type === 'Transferred' ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"
                            )}>
                              {h.action_type}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            <div className="flex flex-col">
                              {h.notes?.includes('Assigned from stock') ? (
                                <span>
                                  <span className="text-slate-500 mr-1 text-[10px] uppercase font-bold tracking-wider">assign from</span>
                                  <span className="font-bold text-slate-900">stock</span>
                                </span>
                              ) : h.action_type === 'Transferred' ? (
                                <span>
                                  <span className="text-slate-500 mr-1 text-[10px] uppercase font-bold tracking-wider">assign from</span>
                                  <span className="font-bold text-slate-900">{h.from_name || "employee"}</span>
                                </span>
                              ) : h.notes?.includes('Assigned to ') ? (
                                <span>
                                  <span className="text-slate-500 mr-1 text-[10px] uppercase font-bold tracking-wider">assign to</span>
                                  <span className="font-bold text-slate-900">{h.notes.match(/Assigned to (.*)/)?.[1] || h.to_name || "employee"}</span>
                                </span>
                              ) : h.action_type === 'Assigned' ? (
                                <span>
                                  <span className="text-slate-500 mr-1 text-[10px] uppercase font-bold tracking-wider">assign from</span>
                                  <span className="font-bold text-slate-900">stock</span>
                                </span>
                              ) : h.action_type === 'Returned' ? (
                                <span>
                                  <span className="text-slate-500 mr-1 text-[10px] uppercase font-bold tracking-wider">return to</span>
                                  <span className="font-bold text-slate-900">stock</span>
                                </span>
                              ) : (
                                <span>{h.to_name || h.employee_name || "-"}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-500 max-w-xs truncate" title={h.notes}>
                            {h.notes || "-"}
                          </td>
                          <td className="px-4 py-4 text-right">
                            {h.pdf_path && (
                              <button 
                                onClick={() => downloadFile(`/${h.pdf_path}`, `handover_${h.id}.pdf`)}
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                                title="Download Document"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end bg-slate-50 rounded-b-3xl">
              <button 
                onClick={() => setShowHistoryModal(false)}
                className="px-6 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertModal
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
        onClose={() => setAlertState({ ...alertState, isOpen: false })}
      />

    </div>
  );
}
