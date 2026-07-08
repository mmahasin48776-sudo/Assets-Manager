import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { 
  Clock,
  User, 
  Laptop, 
  Key, 
  History, 
  ChevronLeft, 
  Mail, 
  Phone, 
  MapPin, 
  Briefcase,
  DollarSign,
  Trash2,
  FileText,
  Download,
  Upload,
  File as FileIcon,
  X,
  Plus,
  Monitor,
  Users,
  Building2
} from "lucide-react";
import { Toaster, toast } from "react-hot-toast";
import axios from "axios";
import { format } from "date-fns";
import { HashLoader } from "react-spinners";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useAuth, useData } from "../App";
import ConfirmModal from "../components/ConfirmModal";
import LoadingSpinner from "../components/LoadingSpinner";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { downloadFile, viewFile } from "../utils/downloadHelper";
import { SearchableSelect } from "../components/SearchableSelect";
import logo from "../assets/logo.png";

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
};

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, isSystemAdmin } = useAuth();
  const { refreshData } = useData();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showAssignAssetModal, setShowAssignAssetModal] = useState(false);
  const [showAssignLicenseModal, setShowAssignLicenseModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnType, setReturnType] = useState<"Asset" | "License" | null>(null);
  const [returnItemId, setReturnItemId] = useState<string | null>(null);
  const [returnData, setReturnData] = useState({ notes: "" });
  const [availableAssets, setAvailableAssets] = useState<any[]>([]);
  const [availableLicenses, setAvailableLicenses] = useState<any[]>([]);
  const [assignData, setAssignData] = useState({ item_id: "", notes: "" });
  const [assignmentFile, setAssignmentFile] = useState<File | null>(null);
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  useEffect(() => {
    fetchProfile();
  }, [id]);

  const fetchProfile = () => {
    axios.get(`/api/employees/${id}/profile`).then((res) => {
      setData(res.data);
      setLoading(false);
    });
  };

  const openAssignAssetModal = async () => {
    const res = await axios.get('/api/assets');
    setAvailableAssets((Array.isArray(res.data) ? res.data : []).filter((a: any) => (a.status || 'Available') === 'Available'));
    setAssignData({ item_id: "", notes: "" });
    setAssignmentFile(null);
    setShowAssignAssetModal(true);
  };

  const openAssignLicenseModal = async () => {
    const res = await axios.get('/api/licenses');
    setAvailableLicenses((Array.isArray(res.data) ? res.data : []).filter((l: any) => (l.status || 'Available') === 'Available'));
    setAssignData({ item_id: "", notes: "" });
    setAssignmentFile(null);
    setShowAssignLicenseModal(true);
  };

  const handleAssignAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("employee_id", id!);
    formData.append("notes", assignData.notes);
    if (assignmentFile) {
      if (assignmentFile.size > 10 * 1024 * 1024) {
        toast.error("File is too large. Maximum allow: 10MB");
        return;
      }
      formData.append("pdf", assignmentFile);
    }
    const assignPromise = (async () => {
      await axios.post(`/api/assets/${assignData.item_id}/assign`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      fetchProfile();
      refreshData("assets");
      setShowAssignAssetModal(false);
    })();

    toast.promise(assignPromise, {
      loading: 'Assigning asset...',
      success: 'Asset assigned successfully!',
      error: 'Failed to assign asset'
    });
  };

  const handleAssignLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("employee_id", id!);
    formData.append("notes", assignData.notes);
    if (assignmentFile) {
      if (assignmentFile.size > 10 * 1024 * 1024) {
        toast.error("File is too large. Maximum allow: 10MB");
        return;
      }
      formData.append("pdf", assignmentFile);
    }
    const assignPromise = (async () => {
      await axios.post(`/api/licenses/${assignData.item_id}/assign`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      fetchProfile();
      refreshData("licenses");
      setShowAssignLicenseModal(false);
    })();

    toast.promise(assignPromise, {
      loading: 'Assigning license...',
      success: 'License assigned successfully!',
      error: 'Failed to assign license'
    });
  };

  const handleReturnAsset = (assetId: string) => {
    setReturnType("Asset");
    setReturnItemId(assetId);
    setReturnData({ notes: "" });
    setShowReturnModal(true);
  };

  const handleReturnLicense = (licenseId: string) => {
    setReturnType("License");
    setReturnItemId(licenseId);
    setReturnData({ notes: "" });
    setShowReturnModal(true);
  };

  const submitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnItemId || !returnType) return;

    const returnPromise = (async () => {
      const endpoint = returnType === "Asset" 
        ? `/api/assets/${returnItemId}/return` 
        : `/api/licenses/${returnItemId}/return`;

      await axios.post(endpoint, { notes: returnData.notes });

      fetchProfile();
      refreshData(returnType === "Asset" ? "assets" : "licenses");
      setShowReturnModal(false);
    })();

    toast.promise(returnPromise, {
      loading: `Returning ${returnType?.toLowerCase()}...`,
      success: `${returnType} returned successfully!`,
      error: `Failed to return ${returnType?.toLowerCase()}`
    });
  };

  const handleDelete = () => {
    setConfirmState({
      isOpen: true,
      title: "Delete Employee",
      message: "Are you sure you want to delete this employee? This will unassign all their assets and licenses.",
      onConfirm: () => {
        const deletePromise = (async () => {
          await axios.post(`/api/employees/${id}`, { _method: 'DELETE' });
          refreshData("employees");
        })();

        toast.promise(deletePromise, {
          loading: 'Deleting employee...',
          success: 'Employee deleted successfully!',
          error: 'Failed to delete employee'
        });
        
        deletePromise.then(() => navigate("/employees"));
      }
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File is too large. Maximum allow: 10MB");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const uploadPromise = (async () => {
      setUploading(true);
      try {
        await axios.post(`/api/employees/${id}/files`, formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        fetchProfile();
      } finally {
        setUploading(false);
      }
    })();

    toast.promise(uploadPromise, {
      loading: 'Uploading file...',
      success: 'File uploaded successfully!',
      error: 'Failed to upload file'
    });
  };

  const handleDeleteFile = async (fileId: number) => {
    setConfirmState({
      isOpen: true,
      title: "Delete File",
      message: "Are you sure you want to delete this file?",
      onConfirm: async () => {
        const deletePromise = (async () => {
          await axios.post(`/api/employees/files/${fileId}`, { _method: 'DELETE' });
          fetchProfile();
        })();

        toast.promise(deletePromise, {
          loading: 'Deleting file...',
          success: 'File deleted successfully!',
          error: 'Failed to delete file'
        });
      }
    });
  };

  if (loading) return <LoadingSpinner />;

  const { employee, assets, licenses, history, files } = data;

  const getActionDisplay = (item: any) => {
    if (item.action_type === 'Returned') {
      if (item.notes?.includes('Assigned to ')) {
        const match = item.notes.match(/Assigned to (.*)/);
        return match ? `assign to ${match[1]}` : 'assign to employee';
      }
      return 'return to stock';
    }
    if (item.action_type === 'Transferred' || item.action_type === 'Assigned') {
      if (item.notes?.includes('Assigned from stock')) {
        return 'assign from stock';
      }
      const match = item.notes?.match(/Assigned from (.*?) to/);
      if (match) {
        return `assign from ${match[1]}`;
      }
      return item.action_type === 'Assigned' ? 'assign from stock' : 'assign from employee';
    }
    return item.action_type.toLowerCase();
  };

  const totalAssetCost = (Array.isArray(assets) ? assets : []).reduce((acc: number, curr: any) => acc + (Number(curr.cost) || 0), 0);
  const totalLicenseCost = (Array.isArray(licenses) ? licenses : []).reduce((acc: number, curr: any) => acc + (Number(curr.cost) || 0), 0);
  const totalCost = totalAssetCost + totalLicenseCost;

  const stats = [
    { label: "Assigned Assets", value: assets.length, icon: Laptop, color: "bg-emerald-500" },
    { label: "Assigned Licenses", value: licenses.length, icon: Key, color: "bg-violet-500" },
    { label: "Total Asset Cost", value: `SR ${Number(totalAssetCost).toLocaleString()}`, icon: DollarSign, color: "bg-blue-500" },
    { label: "Total License Cost", value: `SR ${Number(totalLicenseCost).toLocaleString()}`, icon: DollarSign, color: "bg-amber-500" },
    { label: "Total Cost", value: `SR ${Number(totalCost).toLocaleString()}`, icon: DollarSign, color: "bg-rose-500" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/employees" className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <ChevronLeft className="w-6 h-6 text-slate-400" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{employee.name}</h1>
            <p className="text-slate-500 mt-1">Employee Profile & Asset History</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          {isAdmin && (
            <button 
              onClick={async () => {
                const safeName = employee.name ? employee.name.replace(/[^a-zA-Z0-9]/g, '_') : employee.sn;
                const doc = new jsPDF();
                
                // Generate QR Code
                const qrData = [
                  `Employee ID: ${employee.sn || 'N/A'}`,
                  `Name: ${employee.name || 'N/A'}`,
                  `Email: ${employee.email || 'N/A'}`,
                  `Mobile: ${employee.mobile || 'N/A'}`,
                  `Position: ${employee.position || 'N/A'}`,
                  `Department: ${employee.department || 'N/A'}`,
                  `Location: ${employee.location || 'N/A'}`,
                  `Company: ${employee.company_name || 'N/A'}`,
                  `Status: ${employee.status || 'N/A'}`
                ].join('\n');
                let qrCodeDataUrl = "";
                try {
                  qrCodeDataUrl = await QRCode.toDataURL(qrData, { width: 300, margin: 1 });
                } catch(e) {
                  console.error("QR Code Error", e);
                }
                
                // Load Logo Image
                let logoImg: HTMLImageElement | null = null;
                try {
                  logoImg = await loadImage(logo);
                } catch (e) {
                  console.error("Failed to load logo image", e);
                }
                
                // Title
                doc.setFontSize(20);
                doc.text("Homes Contracting Company", 105, 12, { align: "center" });
                
                // Date
                doc.setFontSize(10);
                doc.text("IT Asset Management Report", 105, 19, { align: "center" });
                doc.setFontSize(7);
                doc.text(`Export Date: ${new Date().toLocaleString()}`, 105, 25, { align: "center" });
                
                // Add Logo to top left
                if (logoImg) {
                  doc.addImage(logoImg, 'PNG', 14, 8, 20, 15);
                }
                
                // Employee Info
                doc.setFontSize(14);
                doc.text("Employee Information", 14, 35);
                
                autoTable(doc, {
                  startY: 38,
                  head: [],
                  body: [
                    ["Employee ID:", employee.sn || "N/A"],
                    ["Name:", employee.name || "N/A"],
                    ["Email:", employee.email || "N/A"],
                    ["Mobile:", employee.mobile || "N/A"],
                    ["Position:", employee.position || "N/A"],
                    ["Department:", employee.department || "N/A"],
                    ["Location:", employee.location || "N/A"],
                    ["Company:", employee.company_name || "N/A"],
                    ["Status:", employee.status || "N/A"],
                  ],
                  theme: 'plain',
                  styles: { cellPadding: 2, fontSize: 11 },
                  columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
                  tableWidth: 140
                });
                
                // Add QR Code Image to PDF (Aligned with Employee Info)
                if (qrCodeDataUrl) {
                  doc.addImage(qrCodeDataUrl, 'PNG', 160, 32, 35, 35);
                }
                
                let finalY = (doc as any).lastAutoTable.finalY + 10;
                
                // Assets Section
                doc.setFontSize(14);
                doc.text("Assigned Assets", 14, finalY);
                
                const assetData = (assets || []).map((a: any) => [
                  a.name || 'N/A', 
                  a.model_name || 'N/A', 
                  a.asset_tag || 'N/A', 
                  a.vendor_name || 'N/A', 
                  a.po_number || 'N/A',
                  a.assigned_date ? format(new Date(a.assigned_date), 'MMM d, yyyy') : 'N/A'
                ]);
                
                autoTable(doc, {
                  startY: finalY + 5,
                  head: [["Asset Name", "Model", "Asset Serial / Tag", "Vendor", "PO", "Assigned Date"]],
                  body: assetData.length > 0 ? assetData : [["No assets assigned", "", "", "", "", ""]],
                  theme: 'striped',
                  headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold' },
                  styles: { fontSize: 9 }
                });
                
                finalY = (doc as any).lastAutoTable.finalY + 15;
                
                // Licenses Section
                doc.setFontSize(14);
                doc.text("Assigned Licenses", 14, finalY);
                
                const licenseData = (licenses || []).map((l: any) => [
                  l.name || 'N/A', 
                  l.type_name || 'N/A', 
                  l.validity_type || 'Yearly', 
                  l.vendor_name || 'N/A', 
                  l.po_number || 'N/A',
                  l.assigned_date ? format(new Date(l.assigned_date), 'MMM d, yyyy') : 'N/A'
                ]);
                
                autoTable(doc, {
                  startY: finalY + 5,
                  head: [["License Name", "Category", "Type", "Vendor", "PO", "Assigned Date"]],
                  body: licenseData.length > 0 ? licenseData : [["No licenses assigned", "", "", "", "", ""]],
                  theme: 'striped',
                  headStyles: { fillColor: [139, 92, 246], textColor: [255, 255, 255], fontStyle: 'bold' },
                  styles: { fontSize: 9 }
                });
                
                finalY = (doc as any).lastAutoTable.finalY + 20;
                
                // Signatures Section
                const pageHeight = doc.internal.pageSize.height;
                const sigSectionHeight = 25; // Height reserved for markers and text
                const bottomMargin = 20; // Margin from bottom edge
                
                // If the current content ends too low to fit signatures at the fixed bottom, add a new page
                if (finalY > pageHeight - sigSectionHeight - bottomMargin) {
                  doc.addPage();
                }
                
                // Set finalY to the bottom of the page minus margin and section height
                finalY = pageHeight - sigSectionHeight - bottomMargin;

                doc.setFontSize(8);
                doc.setFont("helvetica", "bold");
                
                const col1 = 14;
                const col2 = 78;
                const col3 = 140;
                const sigWidth = 55;
                const sigHeight = 15;
                
                // Row 1
                doc.line(col1, finalY + sigHeight, col1 + sigWidth, finalY + sigHeight);
                doc.text("Employee Signature", col1, finalY + sigHeight + 4);
                
                doc.line(col2, finalY + sigHeight, col2 + sigWidth, finalY + sigHeight);
                doc.text("IT Approved Signature", col2, finalY + sigHeight + 4);

                doc.line(col3, finalY + sigHeight, col3 + sigWidth, finalY + sigHeight);
                doc.text("Head of Department Approved", col3, finalY + sigHeight + 4);

                doc.save(`employee_report_${safeName}.pdf`);
              }}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm w-full sm:w-auto"
            >
              <Download className="w-5 h-5" />
              Export Report (PDF)
            </button>
          )}
          {isSystemAdmin && (
            <button 
              onClick={handleDelete}
              className="flex items-center justify-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-all font-bold w-full sm:w-auto"
            >
              <Trash2 className="w-5 h-5" />
              Delete Employee
            </button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <User className="w-12 h-12 text-slate-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">{employee.name}</h2>
              <p className="text-slate-500 text-sm">{employee.position}</p>
              <span className={cn(
                "mt-4 px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                (employee.status || "Active") === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
              )}>
                {employee.status || "Active"}
              </span>
            </div>

            <div className="mt-8 space-y-4 border-t border-slate-100 pt-8">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600">{employee.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600">{employee.mobile || "-"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600">{employee.location}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Briefcase className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600">{employee.position}</span>
              </div>
              {employee.department && (
                <div className="flex items-center gap-3 text-sm">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">{employee.department}</span>
                </div>
              )}
              {employee.reporting_manager && (
                <div className="flex items-center gap-3 text-sm">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">Reports to: {employee.reporting_manager}</span>
                </div>
              )}
              {employee.company_name && (
                <div className="flex items-center gap-3 text-sm">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">{employee.company_name}</span>
                </div>
              )}
            </div>

            {employee.notes && (
              <div className="mt-8 border-t border-slate-100 pt-8">
                <h4 className="text-sm font-bold text-slate-900 mb-2">Notes</h4>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{employee.notes}</p>
              </div>
            )}
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <FileIcon className="w-5 h-5 text-blue-500" />
                Files
              </h3>
              <label className="cursor-pointer p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all">
                <Upload className="w-4 h-4" />
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
              </label>
            </div>
            <div className="space-y-3">
              {uploading && (
                <div className="flex items-center gap-2 text-sm text-blue-600 font-medium bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                  <HashLoader color="#2563eb" size={16} />
                  <span className="italic">Uploading file...</span>
                </div>
              )}
              {files?.map((file: any) => (
                <div key={file.id} className="group flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all">
                  <div className="flex items-center gap-3 truncate flex-1">
                    <FileText className="w-5 h-5 flex-shrink-0 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    <div className="flex flex-col truncate">
                      <button 
                        onClick={() => viewFile(encodeURI(file.file_path.startsWith('/') ? file.file_path : `/${file.file_path}`))}
                        className="text-sm font-bold text-slate-700 hover:text-blue-600 truncate text-left"
                        title="View File"
                      >
                        {file.file_name}
                      </button>
                      <span className="text-[10px] text-slate-400 capitalize">{file.file_name.split('.').pop()} File</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => downloadFile(encodeURI(file.file_path.startsWith('/') ? file.file_path : `/${file.file_path}`), file.file_name)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    {(isAdmin || isSystemAdmin) && (
                      <button 
                        onClick={() => handleDeleteFile(file.id)} 
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {(!files || files.length === 0) && !uploading && (
                <p className="text-sm text-slate-400 italic text-center py-4">No files uploaded.</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-500" />
              <h3 className="text-lg font-bold text-slate-900">Assignment History</h3>
            </div>
            <div className="p-6">
              <div className="relative border-l-2 border-slate-100 ml-3 space-y-8">
                {(Array.isArray(history) ? history : []).map((item: any, i: number) => (
                  <div key={i} className="relative pl-8">
                    {/* Dot */}
                    <div className={cn(
                      "absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-4 border-white",
                      item.action_type === "Assigned" ? "bg-emerald-500" : 
                      item.action_type === "Transferred" ? "bg-blue-500" : 
                      (item.action_type === "Returned" && item.notes?.startsWith('Transferred to ')) ? "bg-blue-500" : "bg-slate-400"
                    )} />
                    
                    {/* Card */}
                    <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                          <span className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap",
                            item.action_type === "Assigned" ? "bg-emerald-100 text-emerald-700" : 
                            item.action_type === "Transferred" ? "bg-blue-100 text-blue-700" : 
                            (item.action_type === "Returned" && item.notes?.startsWith('Transferred to ')) ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-700"
                          )}>
                            {getActionDisplay(item)}
                          </span>
                          <span className="font-bold text-slate-900 break-words">{item.item_name}</span>
                          {item.item_tag && (
                            <span className="text-sm text-slate-500 whitespace-nowrap">({item.item_tag})</span>
                          )}
                        </div>
                        <span className="text-xs font-medium text-slate-400 whitespace-nowrap">
                          {format(new Date(item.action_date), "M/d/yyyy")}
                        </span>
                      </div>
                      {item.notes && (
                        <div className="bg-white border border-slate-100 p-3 rounded-xl">
                          <p className="text-sm text-slate-600">"{item.notes}"</p>
                        </div>
                      )}
                      {item.pdf_path && (
                        <a 
                          href={encodeURI(item.pdf_path.startsWith('/') ? item.pdf_path : `/${item.pdf_path}`)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 mt-3 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors border border-emerald-100"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Handover PDF
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                {history.length === 0 && (
                  <div className="pl-8 text-slate-400 text-sm italic">
                    No assignment history found.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className={`${stat.color} p-3 rounded-xl text-white`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                    <h3 className="text-2xl font-bold text-slate-900">{stat.value}</h3>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Laptop className="w-5 h-5 text-emerald-500" />
                Assigned Assets
              </h3>
              {isAdmin && (
                <button
                  onClick={openAssignAssetModal}
                  className="flex items-center justify-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4" />
                  Assign Asset
                </button>
              )}
            </div>
            
            {/* Responsive Table View */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                    <th className="px-6 py-4">Asset Name</th>
                    <th className="px-6 py-4">Model</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Vendor</th>
                    <th className="px-6 py-4">Asset Serial / Tag</th>
                    <th className="px-6 py-4">Cost</th>
                    <th className="px-6 py-4 text-right">Document</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assets.map((asset: any) => (
                    <tr key={asset.id} className="hover:bg-emerald-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{asset.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono italic">{asset.po_number || 'No PO'}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{asset.model_name || '-'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{asset.category_name || '-'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{asset.vendor_name || '-'}</td>
                      <td className="px-6 py-4">
                        <div className="font-mono text-sm text-slate-500">{asset.asset_tag || '-'}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        SR {Number(asset.cost || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {asset.pdf_path ? (
                          <button 
                            onClick={() => viewFile(encodeURI(asset.pdf_path.startsWith('/') ? asset.pdf_path : `/${asset.pdf_path}`))} 
                            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            View PDF
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs italic">No PDF</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isAdmin && (
                          <button
                            onClick={() => handleReturnAsset(asset.id)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Return
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {assets.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">
                        No assets assigned to this employee.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Key className="w-5 h-5 text-violet-500" />
                Assigned Licenses
              </h3>
              {isAdmin && (
                <button
                  onClick={openAssignLicenseModal}
                  className="flex items-center justify-center gap-2 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 transition-colors w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4" />
                  Assign License
                </button>
              )}
            </div>
            
            {/* Responsive Table View */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                    <th className="px-6 py-4">License Name</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Vendor</th>
                    <th className="px-6 py-4">Serial Key</th>
                    <th className="px-6 py-4">Cost</th>
                    <th className="px-6 py-4 text-right">Document</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {licenses.map((license: any) => (
                    <tr key={license.id} className="hover:bg-emerald-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{license.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono italic">{license.po_number || 'No PO'}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <div>{license.type_name || '-'}</div>
                        <div className="text-[10px] text-slate-400 uppercase font-bold">{license.validity_type || 'Yearly'}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{license.vendor_name || '-'}</td>
                      <td className="px-6 py-4">
                        <div className="font-mono text-sm text-slate-500 truncate max-w-[150px]">{license.serial_key || '-'}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        SR {Number(license.cost || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {license.pdf_path ? (
                          <button 
                            onClick={() => viewFile(encodeURI(license.pdf_path.startsWith('/') ? license.pdf_path : `/${license.pdf_path}`))} 
                            className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-700 bg-violet-50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            View PDF
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs italic">No PDF</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isAdmin && (
                          <button
                            onClick={() => handleReturnLicense(license.id)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Return
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {licenses.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                        No licenses assigned.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {showAssignAssetModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-slate-900">Assign Asset</h2>
              <button onClick={() => setShowAssignAssetModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAssignAsset} className="p-6 space-y-6 overflow-y-auto">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Select Asset</label>
                <SearchableSelect
                  required
                  options={(Array.isArray(availableAssets) ? availableAssets : []).map(a => ({ value: a.id, label: a.name, sublabel: `SN: ${a.sn}` }))}
                  value={assignData.item_id}
                  onChange={(value) => setAssignData({...assignData, item_id: value})}
                  placeholder="Select an available asset"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Assignment Notes</label>
                <textarea className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" rows={3}
                  value={assignData.notes} onChange={(e) => setAssignData({...assignData, notes: e.target.value})} />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowAssignAssetModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors">
                  Assign Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAssignLicenseModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-slate-900">Assign License</h2>
              <button onClick={() => setShowAssignLicenseModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAssignLicense} className="p-6 space-y-6 overflow-y-auto">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Select License</label>
                <SearchableSelect
                  required
                  options={(Array.isArray(availableLicenses) ? availableLicenses : []).map(l => ({ value: l.id, label: l.name, sublabel: `SN: ${l.sn}` }))}
                  value={assignData.item_id}
                  onChange={(value) => setAssignData({...assignData, item_id: value})}
                  placeholder="Select an available license"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Assignment Notes</label>
                <textarea className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500" rows={3}
                  value={assignData.notes} onChange={(e) => setAssignData({...assignData, notes: e.target.value})} />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowAssignLicenseModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 px-4 py-3 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 transition-colors">
                  Assign License
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in duration-300">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-900">Return {returnType}</h2>
              <button onClick={() => setShowReturnModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={submitReturn} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Return Notes</label>
                <textarea className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500" rows={3}
                  value={returnData.notes} onChange={(e) => setReturnData({...returnData, notes: e.target.value})} />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowReturnModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 px-4 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-colors">
                  Return {returnType}
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
    </div>
  );
}
