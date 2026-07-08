import React, { useState, useEffect } from "react";
import { SearchableSelect } from "../components/SearchableSelect";
import { 
  Laptop, 
  Plus, 
  Search, 
  Filter,
  Edit, 
  Trash2, 
  UserPlus, 
  RotateCcw,
  FileText,
  Download,
  QrCode,
  X,
  Upload,
  File as FileIcon,
  History,
  MapPin,
  Printer,
  File as FileDown
} from "lucide-react";
import { toast } from "react-hot-toast";
import axios from "axios";
import { QRCodeSVG } from "qrcode.react";
import logo from "../assets/logo.png";
import { downloadFile, viewFile } from "../utils/downloadHelper";

import * as htmlToImage from "html-to-image";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useLocation } from "react-router-dom";
import { useAuth, useData } from "../App";
import ConfirmModal from "../components/ConfirmModal";
import AlertModal from "../components/AlertModal";
import LoadingSpinner from "../components/LoadingSpinner";
import { SearchableEmployeeSelect } from "../components/SearchableEmployeeSelect";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Assets() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const statusParam = queryParams.get("status");

  const { isAdmin, isSystemAdmin } = useAuth();
  const { data, ensureData, refreshData } = useData();
  const stickerRef = React.useRef<HTMLDivElement>(null);
  const highlightRef = React.useRef<HTMLTableRowElement | HTMLDivElement | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const assets = data.assets;
  const employees = data.employees;
  const categories = data.categories;
  const models = data.models;
  const manufacturers = data.manufacturers;
  const vendors = data.vendors;
  const featuresList = data.features;
  const assetNames = data.assetNames;
  const locations = data.locations;
  
  const [loading, setLoading] = useState(!assets.length || !categories.length);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: statusParam || "Available",
    category: "All",
    location: "All",
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
      setFilters(prev => ({ ...prev, status: "All", category: "All", location: "All", po_number: "", cost: "" }));
    } else if (targetId && assets.length > 0) {
      const target = assets.find((a: any) => a.id === parseInt(targetId));
      if (target && !search) {
        setSearch(target.asset_tag || target.sn);
        setFilters(prev => ({ ...prev, status: "All", category: "All", location: "All", po_number: "", cost: "" }));
      }
    } else if (!searchParam && !targetId && !statusParam) {
      // Clear filters if no specific parameters are set
      setSearch("");
      setFilters({
        status: "All",
        category: "All",
        location: "All",
        po_number: "",
        cost: ""
      });
    }
  }, [targetId, searchParam, statusParam, assets.length]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnAsset, setReturnAsset] = useState<any>(null);
  const [returnData, setReturnData] = useState({ notes: "" });
  const [showLabelsModal, setShowLabelsModal] = useState(false);
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });
  const [isEditing, setIsEditing] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
  const [assetPdf, setAssetPdf] = useState<File | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [assetHistory, setAssetHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [alertState, setAlertState] = useState<{ isOpen: boolean, title: string, message: string, type: 'success' | 'error' | 'info' }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info"
  });
  
  const [newAsset, setNewAsset] = useState({
    sn: "", name: "", model_id: "", manufacturer_id: "", category_id: "", 
    asset_tag: "", hostname: "", feature: "", cost: "", vendor_id: "", po_number: "", purchase_date: "",
    expire_start: "", expire_end: "", depreciation_period: "", status: "Available", location_id: ""
  });

  const [assignData, setAssignData] = useState({ employee_id: "", notes: "" });

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        ensureData("assets"),
        ensureData("employees"),
        ensureData("master") // loads categories, models, features, assetNames, vendors, manufacturers, locations, departments, positions, licenseTypes, licenseNames
      ]);
      setLoading(false);
    };
    loadData();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let assetToSave = { ...newAsset };
    
    // Auto-generate numeric SN if not editing and SN is empty
    if (!isEditing && !assetToSave.sn) {
      const maxSn = (Array.isArray(assets) ? assets : []).reduce((max, a) => {
        const num = parseInt(a.sn);
        return isNaN(num) ? max : Math.max(max, num);
      }, 0);
      assetToSave.sn = String(maxSn + 1).padStart(4, '0');
    }

    const formData = new FormData();
    Object.keys(assetToSave).forEach(key => {
      formData.append(key, (assetToSave as any)[key]);
    });
    if (assetPdf) {
      if (assetPdf.size > 10 * 1024 * 1024) {
        toast.error("File is too large. Maximum allow: 10MB");
        return;
      }
      formData.append("pdf", assetPdf);
    }

    const savePromise = (async () => {
      let res;
      if (isEditing && selectedAsset) {
        formData.append("_method", "PUT");
        res = await axios.post(`/api/assets/${selectedAsset.id}`, formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      } else {
        res = await axios.post("/api/assets", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      }
      if (res.data && res.data.success === false) {
        throw new Error(res.data.message || "Failed to save asset");
      }
      refreshData("assets");
      setShowAddModal(false);
      setIsEditing(false);
      setSelectedAsset(null);
      setAssetPdf(null);
      setNewAsset({
        sn: "", name: "", model_id: "", manufacturer_id: "", category_id: "", 
        asset_tag: "", hostname: "", feature: "", cost: "", vendor_id: "", po_number: "", purchase_date: "",
        expire_start: "", expire_end: "", depreciation_period: "", status: "Available", location_id: ""
      });
    })();

    toast.promise(savePromise, {
      loading: isEditing ? 'Updating asset...' : 'Saving asset...',
      success: 'Asset saved successfully!',
      error: (err) => `Failed to save asset: ${err.response?.data?.message || err.message}`
    });
  };

  const generateSN = () => {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.floor(1000 + Math.random() * 9000);
    setNewAsset({ ...newAsset, sn: `AST-${date}-${random}` });
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
      const res = await axios.post(`/api/assets/${selectedAsset.id}/assign`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      if (res.data && res.data.success === false) {
        throw new Error(res.data.message || "Failed to assign asset");
      }
      refreshData("assets");
      setShowAssignModal(false);
      setAssignData({ employee_id: "", notes: "" });
      setAssignmentFile(null);
    })();

    toast.promise(assignPromise, {
      loading: 'Assigning asset...',
      success: 'Asset assigned successfully!',
      error: (err) => err.message || 'Failed to assign asset.'
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
      const res = await axios.post(`/api/assets/${selectedAsset.id}/transfer`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      if (res.data && res.data.success === false) {
        throw new Error(res.data.message || "Failed to transfer asset");
      }
      refreshData("assets");
      setShowTransferModal(false);
      setAssignData({ employee_id: "", notes: "" });
      setAssignmentFile(null);
    })();

    toast.promise(transferPromise, {
      loading: 'Transferring asset...',
      success: 'Asset transferred successfully!',
      error: (err) => err.message || 'Failed to transfer asset.'
    });
  };

  const handleReturn = (asset: any) => {
    setReturnAsset(asset);
    setReturnData({ notes: "" });
    setShowReturnModal(true);
  };

  const submitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnAsset) return;

    const returnPromise = (async () => {
      const res = await axios.post(`/api/assets/${returnAsset.id}/return`, { notes: returnData.notes });
      if (res.data && res.data.success === false) {
        throw new Error(res.data.message || "Failed to return asset");
      }

      refreshData("assets");
      setShowReturnModal(false);
      setReturnAsset(null);
      setReturnData({ notes: "" });
    })();

    toast.promise(returnPromise, {
      loading: 'Returning asset...',
      success: 'Asset returned successfully!',
      error: (err) => err.message || 'Failed to return asset.'
    });
  };

  const fetchAssetHistory = async (assetId: number) => {
    setHistoryLoading(true);
    try {
      const response = await axios.get(`/api/assets/${assetId}/history`);
      setAssetHistory(response.data);
      setShowHistoryModal(true);
    } catch (error) {
      console.error("Failed to fetch asset history:", error);
      setAlertState({ isOpen: true, title: "Error", message: "Failed to fetch asset history.", type: "error" });
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Asset",
      message: "Are you sure you want to delete this asset?",
      onConfirm: async () => {
        const deletePromise = (async () => {
          await axios.post(`/api/assets/${id}`, { _method: 'DELETE' });
          refreshData("assets");
          setShowAddModal(false);
          setIsEditing(false);
          setSelectedAsset(null);
        })();

        toast.promise(deletePromise, {
          loading: 'Deleting asset...',
          success: 'Asset deleted successfully!',
          error: 'Failed to delete asset.'
        });
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const filtered = (Array.isArray(assets) ? assets : []).filter(asset => {
    const searchLower = search.toLowerCase();
    const matchesSearch = !searchLower || Object.values(asset).some(val => 
      val !== null && val !== undefined && String(val).toLowerCase().includes(searchLower)
    );
    
    const matchesStatus = filters.status === "All" || (asset.status || "Available") === filters.status;
    const matchesCategory = filters.category === "All" || asset.category_name === filters.category;
    const matchesLocation = filters.location === "All" || asset.location_name === filters.location;
    const matchesPo = !filters.po_number || (asset.po_number && asset.po_number.includes(filters.po_number));
    const matchesCost = !filters.cost || (asset.cost && asset.cost.toString().includes(filters.cost));

    return matchesSearch && matchesStatus && matchesCategory && matchesLocation && matchesPo && matchesCost;
  }).sort((a, b) => b.id - a.id);

  useEffect(() => {
    if (highlightId && !loading && filtered.length > 0) {
      // Small timeout to ensure DOM is ready
      const timer = setTimeout(() => {
        const isMobile = window.innerWidth < 1024;
        const idPrefix = isMobile ? 'asset-mobile-' : 'asset-';
        const element = document.getElementById(`${idPrefix}${highlightId}`);
        
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          // Fallback to any element with that ID if the specific prefix one isn't found
          const fallback = document.getElementById(`asset-${highlightId}`) || document.getElementById(`asset-mobile-${highlightId}`);
          if (fallback) {
            fallback.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [highlightId, loading, filtered.length]);

  const handlePrintSticker = async () => {
    if (!stickerRef.current || !selectedAsset) return;
    
    setIsDownloading(true);
    try {
      // Ensure the element is fully captured - wait a bit for any images or SVG rendering
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const dataUrl = await htmlToImage.toJpeg(stickerRef.current, {
        quality: 1.0,
        pixelRatio: 4, // 4 is sufficient for 300dpi on a 58x40mm sticker
        backgroundColor: '#ffffff',
        cacheBust: true,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });
      
      const link = document.createElement('a');
      link.download = `HCC_Asset_${selectedAsset.asset_tag || selectedAsset.sn || 'Sticker'}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Error generating sticker image:', error);
      setAlertState({
        isOpen: true,
        title: "Download Error",
        message: "Failed to generate sticker image. Please try again.",
        type: "error"
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSystemPrint = () => {
    window.print();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="sticky top-[-16px] md:top-[-32px] z-30 bg-slate-50 pt-4 md:pt-8 pb-4 -mt-4 md:-mt-8 space-y-6">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Assets</h1>
            <p className="text-slate-500 mt-1">Manage hardware inventory and assignments.</p>
          </div>
          {isAdmin && (
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <button 
                onClick={() => {
                  const params = new URLSearchParams();
                  if (filters.category !== "All") {
                    const cat = categories.find((c: any) => c.name === filters.category);
                    if (cat) params.append("category_id", cat.id);
                  }
                  if (filters.status !== "All") params.append("status", filters.status);
                  downloadFile(`/api/export/assets?${params.toString()}`, 'assets_report.csv');
                }}
                className="bg-white text-slate-700 border border-slate-200 px-6 py-3 rounded-xl font-bold shadow-sm hover:bg-slate-50 transition-all duration-300 flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <Download className="w-5 h-5" />
                Export to Excel
              </button>
              <button 
                onClick={() => {
                  setAssetPdf(null);
                  setShowAddModal(true);
                }}
                className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all duration-300 flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <Plus className="w-5 h-5" />
                Add Asset
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
                  placeholder="Search..." 
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
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
                  value={filters.category}
                  options={[
                    { label: "All Categories", value: "All" },
                    ...(Array.isArray(categories) ? categories : []).map(c => ({ label: c.name, value: c.name }))
                  ]}
                  onChange={(val) => setFilters({...filters, category: val})}
                  placeholder="All Categories"
                />
                <SearchableSelect
                  className="w-full"
                  value={filters.status}
                  options={[
                    { label: "All Status", value: "All" },
                    { label: "Available", value: "Available" },
                    { label: "Assigned", value: "Assigned" },
                    { label: "Maintenance", value: "Maintenance" },
                    { label: "Retired", value: "Retired" },
                    { label: "Lost", value: "Lost" },
                    { label: "Damage", value: "Damage" }
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

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="overflow-x-auto overflow-y-auto max-h-[65vh]">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead className="sticky top-0 z-20 bg-white shadow-sm">
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                <th className="px-6 py-4">Asset SN</th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Serial/Tag</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Model</th>
                <th className="px-6 py-4">Vendor</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Assigned To</th>
                <th className="px-6 py-4">Cost</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Doc</th>
                <th className="px-6 py-4 text-right sticky right-0 z-20 bg-slate-50 shadow-[-12px_0_15px_-4px_rgba(0,0,0,0.05)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((asset) => {
                const modelName = asset.model_name || (models.find((m: any) => String(m.id) === String(asset.model_id))?.name) || "-";
                return (
                  <tr 
                  key={asset.id} 
                  id={`asset-${asset.id}`}
                  className={cn(
                    "bg-white hover:bg-emerald-50 transition-colors group",
                    highlightId && String(highlightId) === String(asset.id) && "bg-emerald-100 outline outline-2 outline-emerald-500 shadow-md relative z-10"
                  )}
                >
                  <td className="px-6 py-4">
                    <span className="text-xs font-mono text-slate-600 font-bold">{asset.sn}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-slate-900">{asset.name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600 font-bold bg-slate-100 px-2 py-1 rounded border border-slate-200">{asset.asset_tag || "-"}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{asset.category_name || "-"}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{modelName}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{asset.vendor_name || "-"}</td>
                  <td className="px-6 py-4">
                    {asset.location_name ? (
                      <div className="flex items-center gap-1.5 text-slate-700 bg-slate-100/80 px-2.5 py-1 rounded-md w-fit">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-sm font-semibold">{asset.location_name}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-sm italic">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {asset.employee_name ? (
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-700">{asset.employee_name}</span>
                        <span className="text-[10px] text-slate-400 uppercase">Employee</span>
                      </div>
                    ) : (
                      <span className="text-slate-300 text-sm italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-700">SR {Number(asset.cost).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      (asset.status || "Available") === "Available" ? "bg-emerald-100 text-emerald-700" : 
                      (asset.status || "Available") === "Assigned" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {asset.status || "Available"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {asset.pdf_path && (
                      <button 
                        onClick={() => viewFile(encodeURI(asset.pdf_path.startsWith('/') ? asset.pdf_path : `/${asset.pdf_path}`))} 
                        className="p-1.5 text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                        title="View Document"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                  <td className={cn(
                    "px-6 py-4 text-right sticky right-0 z-10 shadow-[-12px_0_15px_-4px_rgba(0,0,0,0.05)] transition-colors",
                    highlightId && String(highlightId) === String(asset.id) ? "bg-emerald-100" : "bg-white group-hover:bg-emerald-50"
                  )}>
                    <div className="flex justify-end gap-2">
                      {isAdmin && (
                        <>
                          {(asset.status || "Available") === "Available" ? (
                            <button 
                              onClick={() => { 
                                setSelectedAsset(asset); 
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
                                  setSelectedAsset(asset); 
                                  setAssignData({ employee_id: "", notes: "" });
                                  setAssignmentFile(null);
                                  setShowTransferModal(true); 
                                }}
                                className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                title="Transfer Asset"
                              >
                                <UserPlus className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleReturn(asset)}
                                className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors"
                                title="Return Asset"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Return
                              </button>
                            </>
                          )}
                          <button 
                            onClick={() => fetchAssetHistory(asset.id)}
                            className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all"
                            title="View History"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedAsset(asset);
                              setShowLabelsModal(true);
                            }}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                            title="Print Label"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedAsset(asset);
                              setIsEditing(true);
                              setAssetPdf(null);
                              setNewAsset({
                                sn: asset.sn || "",
                                name: asset.name || "",
                                model_id: asset.model_id?.toString() || "",
                                manufacturer_id: asset.manufacturer_id?.toString() || "",
                                category_id: asset.category_id?.toString() || "",
                                asset_tag: asset.asset_tag || "",
                                hostname: asset.hostname || "",
                                feature: asset.feature || "",
                                cost: asset.cost?.toString() || "",
                                vendor_id: asset.vendor_id?.toString() || "",
                                po_number: asset.po_number || "",
                                purchase_date: asset.purchase_date || "",
                                expire_start: asset.expire_start || "",
                                expire_end: asset.expire_end || "",
                                depreciation_period: asset.depreciation_period?.toString() || "",
                                status: asset.status || "Available",
                                location_id: asset.location_id?.toString() || ""
                              });
                              setShowAddModal(true);
                            }}
                            className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {isSystemAdmin && (
                            <button 
                              onClick={() => handleDelete(asset.id)}
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
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-slate-500">
                    No assets found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Add Asset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl animate-in zoom-in duration-300 mt-10 mb-10">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-3xl">
              <h2 className="text-2xl font-bold text-slate-900">{isEditing ? "Edit Asset" : "Add New Asset"}</h2>
              <button onClick={() => { setShowAddModal(false); setIsEditing(false); setSelectedAsset(null); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2 hidden">
                  <label className="text-sm font-bold text-slate-700">System SN (Auto-generated if empty)</label>
                  <input type="text" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="Leave empty to auto-generate"
                    value={newAsset.sn} onChange={(e) => setNewAsset({...newAsset, sn: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Asset Name</label>
                  <SearchableSelect
                    required
                    options={(Array.isArray(assetNames) ? assetNames : []).map(an => ({ label: an.name, value: an.name }))}
                    value={newAsset.name}
                    onChange={(val) => setNewAsset({...newAsset, name: val})}
                    placeholder="Select Asset Name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Category</label>
                  <SearchableSelect
                    required
                    options={(Array.isArray(categories) ? categories : []).map(c => ({ label: c.name, value: c.id }))}
                    value={newAsset.category_id}
                    onChange={(val) => setNewAsset({...newAsset, category_id: val})}
                    placeholder="Select Category"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Model</label>
                  <SearchableSelect
                    required
                    options={(Array.isArray(models) ? models : []).map(m => ({ label: m.name, value: m.id }))}
                    value={newAsset.model_id}
                    onChange={(val) => setNewAsset({...newAsset, model_id: val})}
                    placeholder="Select Model"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Manufacturer</label>
                  <SearchableSelect
                    required
                    options={(Array.isArray(manufacturers) ? manufacturers : []).map(m => ({ label: m.name, value: m.id }))}
                    value={newAsset.manufacturer_id}
                    onChange={(val) => setNewAsset({...newAsset, manufacturer_id: val})}
                    placeholder="Select Manufacturer"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Asset Serial / Tag</label>
                  <input type="text" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="Hardware Serial or Tag"
                    value={newAsset.asset_tag} onChange={(e) => setNewAsset({...newAsset, asset_tag: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Hostname</label>
                  <input type="text" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="e.g. LAPTOP-PRO-01"
                    value={newAsset.hostname} onChange={(e) => setNewAsset({...newAsset, hostname: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Vendor</label>
                  <SearchableSelect
                    required
                    options={(Array.isArray(vendors) ? vendors : []).map(v => ({ label: v.name, value: v.id }))}
                    value={newAsset.vendor_id}
                    onChange={(val) => setNewAsset({...newAsset, vendor_id: val})}
                    placeholder="Select Vendor"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Cost (SR)</label>
                  <input required type="number" step="0.01" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    value={newAsset.cost} onChange={(e) => setNewAsset({...newAsset, cost: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">PO Number</label>
                  <input type="text" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    value={newAsset.po_number} onChange={(e) => setNewAsset({...newAsset, po_number: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Purchase Date</label>
                  <input type="date" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white"
                    value={newAsset.purchase_date} onChange={(e) => setNewAsset({...newAsset, purchase_date: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Warranty Start</label>
                  <input type="date" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white"
                    value={newAsset.expire_start} onChange={(e) => setNewAsset({...newAsset, expire_start: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Warranty End</label>
                  <input type="date" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white"
                    value={newAsset.expire_end} onChange={(e) => setNewAsset({...newAsset, expire_end: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Depreciation Period (Years)</label>
                  <input type="number" min="0" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    value={newAsset.depreciation_period} onChange={(e) => setNewAsset({...newAsset, depreciation_period: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Status</label>
                <SearchableSelect
                  className="w-full"
                  value={newAsset.status}
                  options={[
                    { label: "Available", value: "Available" },
                    { label: "Assigned", value: "Assigned" },
                    { label: "Maintenance", value: "Maintenance" },
                    { label: "Retired", value: "Retired" },
                    { label: "Lost", value: "Lost" },
                    { label: "Damage", value: "Damage" }
                  ]}
                  onChange={(val) => setNewAsset({...newAsset, status: val})}
                  placeholder="Select Status"
                />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Location</label>
                  <SearchableSelect
                    required
                    options={(Array.isArray(locations) ? locations : []).map(l => ({ label: l.name, value: l.id }))}
                    value={newAsset.location_id}
                    onChange={(val) => setNewAsset({...newAsset, location_id: val})}
                    placeholder="Select Location"
                  />
                </div>

              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Features</label>
                <SearchableSelect
                  options={(Array.isArray(featuresList) ? featuresList : []).map(f => ({ label: f.name, value: f.name }))}
                  value={newAsset.feature}
                  onChange={(val) => setNewAsset({...newAsset, feature: val})}
                  placeholder="Select Feature"
                />
              </div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4 border-t border-slate-100">
                {isEditing && isSystemAdmin && (
                  <button 
                    type="button" 
                    onClick={() => handleDelete(selectedAsset.id)}
                    className="flex items-center justify-center w-full sm:w-auto gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-all font-bold"
                  >
                    <Trash2 className="w-5 h-5" />
                    Delete Asset
                  </button>
                )}
                <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto ml-auto">
                  <button type="button" onClick={() => setShowAddModal(false)} className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
                  {newAsset.location_id && (
                    <button type="submit" className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all">Save Asset</button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold text-slate-900">Assign Asset</h2>
              <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleAssign} className="p-8 space-y-6">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Asset Selected</p>
                <p className="font-bold text-slate-900">{selectedAsset?.name}</p>
                <p className="text-xs font-mono text-slate-500">{selectedAsset?.sn}</p>
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
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 transition-all"
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold text-slate-900">Transfer Asset</h2>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleTransfer} className="p-8 space-y-6">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Asset Selected</p>
                <p className="font-bold text-slate-900">{selectedAsset?.name}</p>
                <p className="text-xs font-mono text-slate-500">{selectedAsset?.sn}</p>
                <p className="text-xs font-bold text-slate-400 uppercase mt-2 mb-1">Current Employee</p>
                <p className="font-bold text-slate-900">{selectedAsset?.employee_name}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Transfer to Employee</label>
                <SearchableEmployeeSelect 
                  employees={employees}
                  value={assignData.employee_id}
                  onChange={(val) => setAssignData({...assignData, employee_id: val})}
                  excludeEmployeeId={selectedAsset?.assigned_employee_id}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Transfer Notes</label>
                <textarea className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" rows={3}
                  value={assignData.notes} onChange={(e) => setAssignData({...assignData, notes: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Transfer Document (PDF)</label>
                <input 
                  type="file" 
                  accept=".pdf"
                  onChange={(e) => setAssignmentFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all"
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
      {/* Labels Modal */}
      {showLabelsModal && selectedAsset && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl animate-in zoom-in duration-300">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white rounded-t-xl z-10">
              <h2 className="text-base font-bold text-slate-900">Print Preview (Sticker)</h2>
              <button onClick={() => setShowLabelsModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 flex flex-col items-center bg-slate-50/50 rounded-b-xl overflow-hidden">
              <div className="w-full flex items-center justify-center p-4 bg-slate-200/50 rounded-xl border border-dashed border-slate-300">
                {/* The Printable Sticker */}
                <div 
                  ref={stickerRef}
                  style={{
                    width: '58mm',
                    height: '40mm',
                    boxSizing: 'border-box',
                    padding: '2.5mm',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    background: '#fff',
                    fontFamily: "'Inter', sans-serif",
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                  }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', borderBottom: '0.5mm solid #0f172a', paddingBottom: '1.5mm', gap: '2mm' }}>
                      <div style={{ height: '7mm', width: '9mm', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
                        <img src={logo} alt="Logo" style={{ height: '100%', width: '100%', objectFit: 'contain' }} referrerPolicy="no-referrer" />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                         <p style={{ color: '#1d4ed8', fontWeight: 900, fontSize: '8px', margin: 0, letterSpacing: '-0.1px', lineHeight: 1 }}>Homes Contracting Company</p>
                         <p style={{ color: '#475569', fontSize: '5px', fontWeight: 600, margin: '0.5px 0 0 0' }}>Quality & Excellence</p>
                      </div>
                    </div>
                     
                     <div style={{ display: 'flex', alignItems: 'center', flexGrow: 1, padding: '2mm 0' }}>
                       <div style={{ width: '18mm', height: '18mm', padding: '1mm', border: '0.25mm solid #cbd5e1', position: 'relative', display: 'flex', alignItems: 'center', justifyItems: 'center' }}>
                          <div style={{ position: 'absolute', top: '-0.25mm', left: '-0.25mm', width: '2mm', height: '2mm', borderTop: '0.25mm solid #94a3b8', borderLeft: '0.25mm solid #94a3b8' }}></div>
                          <div style={{ position: 'absolute', top: '-0.25mm', right: '-0.25mm', width: '2mm', height: '2mm', borderTop: '0.25mm solid #94a3b8', borderRight: '0.25mm solid #94a3b8' }}></div>
                          <div style={{ position: 'absolute', bottom: '-0.25mm', left: '-0.25mm', width: '2mm', height: '2mm', borderBottom: '0.25mm solid #94a3b8', borderLeft: '0.25mm solid #94a3b8' }}></div>
                          <div style={{ position: 'absolute', bottom: '-0.25mm', right: '-0.25mm', width: '2mm', height: '2mm', borderBottom: '0.25mm solid #94a3b8', borderRight: '0.25mm solid #94a3b8' }}></div>
                          <QRCodeSVG 
                            value={`Tag: ${(selectedAsset.asset_tag || selectedAsset.sn || 'N/A').toUpperCase().startsWith('HCC-IT') ? (selectedAsset.asset_tag || selectedAsset.sn || 'N/A') : 'HCC-IT-' + (selectedAsset.asset_tag || selectedAsset.sn || 'N/A')}\nName: ${selectedAsset.name}\nSN: ${selectedAsset.sn}`} 
                            style={{ width: '100%', height: '100%' }} 
                            level="M" 
                            includeMargin={true}
                          />
                       </div>
                       <div style={{ marginLeft: '2.5mm', display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: '31mm' }}>
                          <p style={{ color: '#334155', fontSize: '6px', fontWeight: 800, margin: '0 0 1px 0', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedAsset.name}</p>
                          <p style={{ color: '#0f172a', fontSize: '11px', fontWeight: 900, margin: 0, letterSpacing: '-0.2px', lineHeight: 1.1, wordWrap: 'break-word', wordBreak: 'break-all' }}>
                            {`ECO-IT-${selectedAsset.sn}`}
                          </p>
                       </div>
                     </div>

                     <div style={{ borderTop: '0.5mm solid #0f172a', paddingTop: '1.5mm', textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: '6px', color: '#334155', fontWeight: 800 }}>Scan QR Code to view details</p>
                     </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="mt-6 grid grid-cols-2 gap-3 w-full">
                <button
                  onClick={handleSystemPrint}
                  className="flex items-center justify-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-lg font-bold shadow-md hover:bg-slate-800 transition-all"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
                <button
                  onClick={handlePrintSticker}
                  disabled={isDownloading}
                  className={cn(
                    "flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg font-bold shadow-md hover:bg-emerald-700 transition-all",
                    isDownloading && "opacity-70 cursor-not-allowed"
                  )}
                >
                  {isDownloading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {isDownloading ? "Generating..." : "Download"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print-only Container (Hidden from UI, shown only during window.print()) */}
      <div className="hidden print:block fixed inset-0 bg-white z-[9999]">
        <div className="flex items-center justify-center h-screen w-screen">
          <div 
            style={{
              width: '58mm',
              height: '40mm',
              boxSizing: 'border-box',
              padding: '2.5mm',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              background: '#fff',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {selectedAsset && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', borderBottom: '0.5mm solid #0f172a', paddingBottom: '1.5mm', gap: '2mm' }}>
                  <div style={{ height: '7mm', width: '9mm', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
                    <img src={logo} alt="Logo" style={{ height: '100%', width: '100%', objectFit: 'contain' }} referrerPolicy="no-referrer" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <p style={{ color: '#1d4ed8', fontWeight: 900, fontSize: '8px', margin: 0, letterSpacing: '-0.1px', lineHeight: 1 }}>Homes Contracting Company</p>
                    <p style={{ color: '#475569', fontSize: '5px', fontWeight: 600, margin: '0.5px 0 0 0' }}>Quality & Excellence</p>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', flexGrow: 1, padding: '2mm 0' }}>
                  <div style={{ width: '18mm', height: '18mm', padding: '1mm', border: '0.25mm solid #cbd5e1', position: 'relative', display: 'flex', alignItems: 'center', justifyItems: 'center' }}>
                    <QRCodeSVG 
                      value={`Tag: ${(selectedAsset.asset_tag || selectedAsset.sn || 'N/A').toUpperCase().startsWith('HCC-IT') ? (selectedAsset.asset_tag || selectedAsset.sn || 'N/A') : 'HCC-IT-' + (selectedAsset.asset_tag || selectedAsset.sn || 'N/A')}\nName: ${selectedAsset.name}\nSN: ${selectedAsset.sn}`} 
                      style={{ width: '100%', height: '100%' }} 
                      level="M" 
                      includeMargin={true}
                    />
                  </div>
                  <div style={{ marginLeft: '2.5mm', display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: '31mm' }}>
                    <p style={{ color: '#334155', fontSize: '6px', fontWeight: 800, margin: '0 0 1px 0', textTransform: 'uppercase' }}>{selectedAsset.name}</p>
                    <p style={{ color: '#0f172a', fontSize: '11px', fontWeight: 900, margin: 0, letterSpacing: '-0.2px', lineHeight: 1.1, wordWrap: 'break-word' }}>
                      {`ECO-IT-${selectedAsset.sn}`}
                    </p>
                  </div>
                </div>

                <div style={{ borderTop: '0.5mm solid #0f172a', paddingTop: '1.5mm', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '6px', color: '#334155', fontWeight: 800 }}>Scan QR Code to view details</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showReturnModal && returnAsset && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Return Asset</h2>
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

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl animate-in zoom-in duration-300 max-h-[90vh] flex flex-col">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-3xl">
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <History className="w-6 h-6 text-indigo-500" />
                Asset Assignment History
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
              ) : assetHistory.length === 0 ? (
                <div className="text-center py-12 text-slate-500 italic">
                  No history found for this asset.
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
                      {(Array.isArray(assetHistory) ? assetHistory : []).map((h) => (
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

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState({ ...confirmState, isOpen: false })}
      />

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
