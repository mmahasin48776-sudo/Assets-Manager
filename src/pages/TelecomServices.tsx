import React, { useState, useEffect } from "react";
import axios from "axios";
import { Plus, Edit2, Trash2, Search, Download, FileText, X, Eye } from "lucide-react";
import { SearchableSelect } from "../components/SearchableSelect";
import { toast } from "react-hot-toast";
import { useAuth, useData } from "../App";
import LoadingSpinner from "../components/LoadingSpinner";
import ConfirmModal from "../components/ConfirmModal";
import AlertModal from "../components/AlertModal";
import { useLocation } from "react-router-dom";
import { downloadFile, viewFile } from "../utils/downloadHelper";

export default function TelecomServices() {
  const { isAdmin, isSystemAdmin } = useAuth();
  const { data, refreshData } = useData();
  const locationRouter = useLocation();
  const queryParams = new URLSearchParams(locationRouter.search);
  const targetId = queryParams.get("id");
  const highlightId = queryParams.get("highlight");
  const searchParam = queryParams.get("search");

  const [services, setServices] = useState<any[]>([]);
  const locations = data.locations || [];
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterLocation, setFilterLocation] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ 
    name: "", 
    provider: "", 
    account_number: "", 
    cost: "0", 
    status: "Active",
    contract_start_date: "",
    end_date: "",
    facility: "",
    po_number: "",
    contact_info: "",
    location_id: "",
    notes: ""
  });
  const [files, setFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<any[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [alertState, setAlertState] = useState<{ isOpen: boolean, title: string, message: string, type: 'success' | 'error' | 'info' }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info"
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const res = await axios.get("/api/telecom-services");
      if (Array.isArray(res.data)) {
        setServices(res.data);
      } else {
        console.error("Expected array but got:", res.data);
        setServices([]);
      }
    } catch (error) {
      console.error("Failed to fetch telecom services", error);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchParam) {
      setSearch(searchParam);
    } else if (targetId && services.length > 0) {
      const target = services.find((s: any) => s.id === parseInt(targetId));
      if (target && !search) {
        setSearch(target.account_number || target.name || target.service_name);
      }
    } else if (!searchParam && !targetId) {
      setSearch("");
    }
  }, [targetId, searchParam, services.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    const savePromise = (async () => {
      const fd = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        fd.append(key, value as string);
      });
      
      if (files.length > 0) {
        for (const f of files) {
          if (f.size > 10 * 1024 * 1024) {
            throw new Error(`File "${f.name}" is too large. Maximum allow: 10MB`);
          }
          fd.append("files", f);
        }
      }

      if (editingId) {
        fd.append("_method", "PUT");
        await axios.post(`/api/telecom-services/${editingId}`, fd, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      } else {
        await axios.post("/api/telecom-services", fd, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      }
      setIsSaving(false);
      setIsModalOpen(false);
      fetchServices();
      refreshData("stats");
    })();

    toast.promise(savePromise, {
      loading: editingId ? 'Updating service...' : 'Saving service...',
      success: 'Service saved successfully!',
      error: (err) => `Failed to save service: ${err.response?.data?.message || err.message}`
    });
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const deletePromise = (async () => {
      await axios.delete(`/api/telecom-services/${confirmDelete}`);
      setConfirmDelete(null);
      fetchServices();
      refreshData("stats");
    })();

    toast.promise(deletePromise, {
      loading: 'Deleting service...',
      success: 'Service deleted successfully!',
      error: 'Failed to delete service'
    });
  };

  const handleDeleteFile = async (fileId: number) => {
    const deletePromise = (async () => {
      await axios.delete(`/api/telecom-services/files/${fileId}`);
      setExistingFiles(prev => prev.filter(f => f.id !== fileId));
      fetchServices();
    })();

    toast.promise(deletePromise, {
      loading: 'Deleting file...',
      success: 'File deleted successfully!',
      error: 'Failed to delete file'
    });
  };

  const openModal = (service?: any) => {
    if (service) {
      setEditingId(service.id);
      setFormData({ 
        name: service.name, 
        provider: service.provider || "", 
        account_number: service.account_number || "",
        cost: service.cost || "0",
        status: service.status || "Active",
        contract_start_date: service.contract_start_date || "",
        end_date: service.end_date || "",
        facility: service.facility || "",
        po_number: service.po_number || "",
        contact_info: service.contact_info || "",
        location_id: service.location_id || "",
        notes: service.notes || ""
      });
      setExistingFiles(service.files || []);
    } else {
      setEditingId(null);
      setFormData({ 
        name: "", 
        provider: "", 
        account_number: "", 
        cost: "0", 
        status: "Active",
        contract_start_date: "",
        end_date: "",
        facility: "",
        po_number: "",
        contact_info: "",
        location_id: "",
        notes: ""
      });
      setExistingFiles([]);
    }
    setFiles([]);
    setIsModalOpen(true);
  };

  const filteredServices = services.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || 
      (s.provider && s.provider.toLowerCase().includes(search.toLowerCase())) ||
      (s.account_number && s.account_number.toLowerCase().includes(search.toLowerCase())) ||
      (s.po_number && s.po_number.toLowerCase().includes(search.toLowerCase())) ||
      (s.contact_info && s.contact_info.toLowerCase().includes(search.toLowerCase()));
    
    const matchesLocation = filterLocation === "All" || String(s.location_id) === filterLocation;
    const matchesStatus = filterStatus === "All" || s.status === filterStatus;

    return matchesSearch && matchesLocation && matchesStatus;
  }).sort((a: any, b: any) => b.id - a.id);

  useEffect(() => {
    if (highlightId && !loading && filteredServices.length > 0) {
      // Small timeout to ensure DOM is ready
      const timer = setTimeout(() => {
        const isMobile = window.innerWidth < 1024;
        const idPrefix = isMobile ? 'tel-mobile-' : 'tel-';
        const element = document.getElementById(`${idPrefix}${highlightId}`);
        
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          // Fallback to any element with that ID if the specific prefix one isn't found
          const fallback = document.getElementById(`tel-${highlightId}`) || document.getElementById(`tel-mobile-${highlightId}`);
          if (fallback) {
            fallback.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [highlightId, loading, filteredServices.length]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="sticky top-[-16px] md:top-[-32px] z-30 bg-slate-50 pt-4 md:pt-8 pb-4 -mt-4 md:-mt-8 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-900">Telecom & Services</h1>
          {isAdmin && (
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <button 
                onClick={() => downloadFile('/api/export/telecom-services', 'telecom_services_report.csv')}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm font-bold"
              >
                <Download className="w-4 h-4" />
                Export to Excel
              </button>
              <button
                onClick={() => openModal()}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Service
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-200 shrink-0">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search services..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm shadow-sm"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Project:</label>
                  <div className="min-w-[200px]">
                    <SearchableSelect
                      value={filterLocation}
                      onChange={(val) => setFilterLocation(val)}
                      options={[
                        { label: "All Projects", value: "All" },
                        ...locations.map((loc: any) => ({ label: loc.name, value: String(loc.id) }))
                      ]}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Status:</label>
                  <div className="min-w-[150px]">
                    <SearchableSelect
                      value={filterStatus}
                      onChange={(val) => setFilterStatus(val)}
                      options={[
                        { label: "All Status", value: "All" },
                        { label: "Active", value: "Active" },
                        { label: "Inactive", value: "Inactive" }
                      ]}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-separate border-spacing-0">
            <thead className="sticky top-0 z-20 bg-white shadow-sm">
              <tr className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200">
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Provider</th>
                <th className="px-6 py-4">Account Number</th>
                <th className="px-6 py-4">PO Number</th>
                <th className="px-6 py-4">Contact Info</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Facility</th>
                <th className="px-6 py-4">Start Date</th>
                <th className="px-6 py-4">End Date</th>
                <th className="px-6 py-4">Cost</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">File</th>
                {isAdmin && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredServices.map((service) => (
                <tr 
                  key={service.id} 
                  id={`tel-${service.id}`}
                  className={highlightId && String(highlightId) === String(service.id) ? "bg-emerald-200 ring-2 ring-inset ring-emerald-500 shadow-md relative z-10" : "hover:bg-slate-50"}
                >
                  <td className="px-6 py-4 font-medium text-slate-900">{service.name}</td>
                  <td className="px-6 py-4 text-slate-600">{service.provider}</td>
                  <td className="px-6 py-4 text-slate-600">{service.account_number}</td>
                  <td className="px-6 py-4 text-slate-600">{service.po_number}</td>
                  <td className="px-6 py-4 text-slate-600">{service.contact_info}</td>
                  <td className="px-6 py-4 text-slate-600">{service.location_name || locations.find((l: any) => l.id == service.location_id)?.name}</td>
                  <td className="px-6 py-4 text-slate-600">{service.facility}</td>
                  <td className="px-6 py-4 text-slate-600">{service.contract_start_date}</td>
                  <td className="px-6 py-4 text-slate-600">{service.end_date}</td>
                  <td className="px-6 py-4 text-slate-900 font-medium">
                    SR {Number(service.cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      service.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {service.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-2">
                      {service.files && service.files.length > 0 ? (
                        service.files.map((f: any) => (
                          <div key={f.id} className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 truncate max-w-[100px]" title={f.file_name}>{f.file_name}</span>
                            <div className="flex gap-1">
                              <a href={`/${f.file_path}`} target="_blank" rel="noopener noreferrer" className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="View">
                                <Eye className="w-3 h-3" />
                              </a>
                              <a href={`/${f.file_path}`} download={f.file_name} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Download">
                                <Download className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        ))
                      ) : (
                        service.file_url ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 truncate max-w-[100px]">{service.file_name || "Old File"}</span>
                            <div className="flex gap-1">
                              <a href={`/${service.file_url}`} target="_blank" rel="noopener noreferrer" className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="View">
                                <Eye className="w-3 h-3" />
                              </a>
                              <a href={`/${service.file_url}`} download={service.file_name || "file"} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Download">
                                <Download className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">No files</span>
                        )
                      )}
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openModal(service)}
                          className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {isSystemAdmin && (
                          <button
                            onClick={() => setConfirmDelete(service.id)}
                            className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filteredServices.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 11 : 10} className="px-6 py-8 text-center text-slate-500">
                    No services found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-900">
                {editingId ? "Edit Service" : "Add Service"}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-full transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Service Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Fiber Internet"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Provider</label>
                    <input
                      type="text"
                      placeholder="e.g. STC, Mobily"
                      value={formData.provider}
                      onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Account Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 1000928374"
                      value={formData.account_number}
                      onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Facility/Building</label>
                    <input
                      type="text"
                      placeholder="e.g. Main HQ"
                      value={formData.facility}
                      onChange={(e) => setFormData({ ...formData, facility: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">PO Number</label>
                    <input
                      type="text"
                      placeholder="e.g. PO-2024-001"
                      value={formData.po_number}
                      onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contact Number/Email</label>
                    <input
                      type="text"
                      placeholder="e.g. +966 50 123 4567 or contact@provider.com"
                      value={formData.contact_info}
                      onChange={(e) => setFormData({ ...formData, contact_info: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Location</label>
                    <SearchableSelect
                      value={formData.location_id}
                      onChange={(val) => setFormData({ ...formData, location_id: val })}
                      placeholder="Select Location"
                      options={locations.map((loc: any) => ({ label: loc.name, value: String(loc.id) }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Status</label>
                    <SearchableSelect
                      value={formData.status}
                      onChange={(val) => setFormData({ ...formData, status: val })}
                      options={[
                        { label: "Active", value: "Active" },
                        { label: "Inactive", value: "Inactive" }
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contract Start</label>
                    <input
                      type="date"
                      value={formData.contract_start_date}
                      onChange={(e) => setFormData({ ...formData, contract_start_date: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contract End</label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Monthly Cost (SR)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.cost}
                      onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Attachments (Multiple)</label>
                    <div className="relative group">
                      <input
                        type="file"
                        multiple
                        onChange={(e) => {
                          const newFiles = Array.from(e.target.files || []);
                          setFiles(prev => [...prev, ...newFiles]);
                        }}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 border-dashed rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs text-slate-500 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all cursor-pointer"
                      />
                    </div>
                    
                    {/* Display existing files */}
                    {existingFiles.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Existing Files</p>
                        {existingFiles.map((f: any) => (
                          <div key={f.id} className="flex items-center justify-between bg-white border border-slate-100 px-2 py-1 rounded text-[10px]">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <FileText className="w-3 h-3 text-slate-400 flex-shrink-0" />
                              <span className="truncate text-slate-600">{f.file_name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => viewFile(`/${f.file_path}`)} className="text-blue-600">
                                <Eye className="w-3 h-3" />
                              </button>
                              {isSystemAdmin && (
                                <button 
                                  type="button" 
                                  onClick={() => handleDeleteFile(f.id)} 
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Display newly selected files */}
                    {files.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-[10px] font-bold text-blue-400 uppercase">New Files to Upload</p>
                        {files.map((f, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-blue-50/50 border border-blue-100 px-2 py-1 rounded text-[10px]">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <FileText className="w-3 h-3 text-blue-400 flex-shrink-0" />
                              <span className="truncate text-blue-600">{f.name}</span>
                            </div>
                            <button 
                              type="button" 
                              onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))} 
                              className="text-slate-400 hover:text-red-500"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {editingId && services.find(s => s.id === editingId)?.file_url && (
                      <div className="mt-2">
                         <p className="text-[10px] font-bold text-slate-400 uppercase">Old Single Attachment</p>
                         <div className="flex items-center gap-2 text-[10px] text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                           <FileText className="w-3 h-3" />
                           <span className="truncate">{services.find(s => s.id === editingId).file_name || "Old File"}</span>
                           <button type="button" onClick={() => viewFile(`/${services.find(s => s.id === editingId).file_url}`)} className="ml-auto text-blue-600">
                             <Eye className="w-3 h-3" />
                           </button>
                         </div>
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Additional Notes</label>
                    <textarea
                      placeholder="Enter any additional service details or terms..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                      rows={3}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  {formData.location_id && (
                    <button
                      type="submit"
                      disabled={isSaving}
                      className={`px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 active:scale-95 transition-all flex items-center gap-2 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                      {isSaving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Saving...
                        </>
                      ) : (
                        editingId ? "Update Service" : "Save Service"
                      )}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmDelete}
        title="Delete Service"
        message="Are you sure you want to delete this service? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
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
