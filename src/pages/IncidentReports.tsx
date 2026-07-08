import React, { useState, useEffect } from "react";
import axios from "axios";
import { 
  Plus, 
  Download, 
  X, 
  FileText, 
  Printer, 
  ArrowLeft,
  Check,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Upload,
  FileCheck
} from "lucide-react";
import { toast } from "react-hot-toast";
import { useAuth } from "../App";
import LoadingSpinner from "../components/LoadingSpinner";
import ConfirmModal from "../components/ConfirmModal";
import { viewFile, downloadFile } from "../utils/downloadHelper";
import { employeeService, Employee } from "../services/employeeService";
import logo from "../assets/logo.png";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface AutoGrowingTextareaProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  className?: string;
}

function AutoGrowingTextarea({
  value,
  onChange,
  placeholder,
  required,
  rows = 4,
  className = ""
}: AutoGrowingTextareaProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      rows={rows}
      required={required}
      placeholder={placeholder}
      className={`${className} overflow-hidden resize-none transition-all duration-150`}
      value={value}
      onChange={(e) => {
        onChange(e);
        const el = e.target;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      }}
    />
  );
}

export default function IncidentReports() {
  const { user, isAdmin, isSystemAdmin } = useAuth();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // App views: 'list' | 'view' | 'create' | 'edit'
  const [viewState, setViewState] = useState<'list' | 'view' | 'create' | 'edit'>('list');
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "Security",
    severity: "Critical",
    status: "Resolved",
    asset_id: "",
    action_taken: "",
    reporter_name: "",
    
    employee_name: "",
    employee_id: "",
    department: "",
    reporting_manager: "",
    incident_number: "",
    incident_date: "",
    incident_time: "",
    incident_taken_by: "",
    incident_old_ref: "",
    incident_definition: "",
    impact_of_incident: "",
    corrective_action: "",
    corrective_action_date: "",
    preventive_action: "",
    prepared_by_name: "",
    prepared_by_position: "",
    prepared_by_location: ""
  });

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    fetchIncidents();
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const emps = await employeeService.getEmployees();
      setEmployees(emps);
    } catch (err) {
      console.error("Failed to fetch employees:", err);
    }
  };

  const handleSelectEmployee = (emp: Employee) => {
    setFormData(prev => ({
      ...prev,
      employee_name: emp.name,
      reporter_name: emp.name,
      employee_id: emp.sn || emp.email || "",
      department: emp.department || "",
      title: emp.position || "",
      reporting_manager: emp.reporting_manager || ""
    }));
    setShowSuggestions(false);
  };

  const matchingEmployees = formData.employee_name.trim() === ""
    ? []
    : employees.filter(emp =>
        emp.name.toLowerCase().includes(formData.employee_name.toLowerCase())
      );

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/incident-reports");
      if (Array.isArray(res.data)) {
        setIncidents(res.data);
      } else {
        setIncidents([]);
      }
    } catch (error) {
      console.error("Failed to fetch incident reports", error);
      toast.error("Error retrieving incident log.");
    } finally {
      setLoading(false);
    }
  };

  const [uploadingId, setUploadingId] = useState<number | null>(null);

  const handleApprovalFileUpload = async (incidentId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error("File is too large. Maximum allowed: 15MB");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const uploadPromise = (async () => {
      setUploadingId(incidentId);
      try {
        const response = await axios.post(`/api/incident-reports/${incidentId}/approval-file`, formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        await fetchIncidents();
        
        if (response.data && response.data.success) {
          const fileUrl = response.data.url;
          const fileName = response.data.file_name;
          setSelectedIncident((prev: any) => {
            if (prev && prev.id === incidentId) {
              return {
                ...prev,
                approval_file_url: fileUrl,
                approval_file_name: fileName
              };
            }
            return prev;
          });
        }
      } finally {
        setUploadingId(null);
      }
    })();

    toast.promise(uploadPromise, {
      loading: 'Uploading approval file...',
      success: 'Approval file uploaded successfully!',
      error: 'Failed to upload approval file'
    });
  };

  const handleOpenCreate = () => {
    const nextNum = getNextIncidentNumber();
    
    const getLocalDateString = () => {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const getLocalTimeString = () => {
      const d = new Date();
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${hours}:${minutes} ${ampm}`;
    };

    const todayStr = getLocalDateString();
    const timeStr = getLocalTimeString();

    setFormData({
      title: "",
      description: "",
      type: "Security",
      severity: "Low",
      status: "Open",
      asset_id: "",
      action_taken: "",
      reporter_name: "",
      
      employee_name: "",
      employee_id: "",
      department: "",
      reporting_manager: "",
      incident_number: nextNum,
      incident_date: todayStr,
      incident_time: timeStr,
      incident_taken_by: "",
      incident_old_ref: "None",
      incident_definition: "",
      impact_of_incident: "",
      corrective_action: "",
      corrective_action_date: todayStr,
      preventive_action: "",
      prepared_by_name: "",
      prepared_by_position: "",
      prepared_by_location: ""
    });
    setViewState('create');
  };

  const getNextIncidentNumber = () => {
    try {
      if (incidents.length === 0) return "001";
      // Find max number
      const nums = incidents
        .map(i => {
          const match = i.incident_number?.match(/(?:AP-)?(\d+)/);
          return match ? parseInt(match[1]) : 0;
        })
        .filter(n => n > 0);
      const max = nums.length > 0 ? Math.max(...nums) : 0;
      return String(max + 1).padStart(3, '0');
    } catch {
      return "001";
    }
  };

  const handleEdit = (incident: any) => {
    setSelectedIncident(incident);
    setFormData({
      title: incident.title || "",
      description: incident.description || "",
      type: incident.type || "Other",
      severity: incident.severity || "Low",
      status: incident.status || "Open",
      asset_id: incident.asset_id ? String(incident.asset_id) : "",
      action_taken: incident.action_taken || "",
      reporter_name: incident.reporter_name || "",
      
      employee_name: incident.employee_name || "",
      employee_id: incident.employee_id || "",
      department: incident.department || "",
      reporting_manager: incident.reporting_manager || "",
      incident_number: incident.incident_number || "",
      incident_date: incident.incident_date || "",
      incident_time: incident.incident_time || "",
      incident_taken_by: incident.incident_taken_by || "",
      incident_old_ref: incident.incident_old_ref || "",
      incident_definition: incident.incident_definition || "",
      impact_of_incident: incident.impact_of_incident || "",
      corrective_action: incident.corrective_action || "",
      corrective_action_date: incident.corrective_action_date || "",
      preventive_action: incident.preventive_action || "",
      prepared_by_name: incident.prepared_by_name || "",
      prepared_by_position: incident.prepared_by_position || "",
      prepared_by_location: incident.prepared_by_location || ""
    });
    setViewState('edit');
  };

  const handleView = (incident: any) => {
    setSelectedIncident(incident);
    setViewState('view');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    if (!formData.title.trim()) {
      toast.error("Please provide an incident title.");
      return;
    }

    setIsSaving(true);
    const cleanedIncidentNumber = formData.incident_number.replace(/^AP-/i, '').trim();
    const apiPayload = {
      ...formData,
      incident_number: cleanedIncidentNumber,
      asset_id: formData.asset_id ? parseInt(formData.asset_id) : null,
      reporter_id: viewState === 'edit' ? undefined : (user?.id || null)
    };

    try {
      if (viewState === 'edit' && selectedIncident) {
        const res = await axios.put(`/api/incident-reports/${selectedIncident.id}`, apiPayload);
        toast.success("Incident report updated successfully.");
        const updatedIncident = {
          ...selectedIncident,
          ...apiPayload
        };
        setSelectedIncident(updatedIncident);
        setViewState('view');
        fetchIncidents();
      } else {
        const res = await axios.post("/api/incident-reports", apiPayload);
        toast.success("New incident form submitted and logged successfully!");
        
        // Auto-redirect: Fetch the updated incident list to locate the newly created report and open it
        const freshRes = await axios.get("/api/incident-reports");
        if (Array.isArray(freshRes.data)) {
          setIncidents(freshRes.data);
          const newlyCreated = freshRes.data.find((item: any) => 
            item.title === apiPayload.title && 
            item.description === apiPayload.description
          ) || freshRes.data[0];
          
          if (newlyCreated) {
            setSelectedIncident(newlyCreated);
            setViewState('view');
          } else {
            setViewState('list');
          }
        } else {
          setViewState('list');
          fetchIncidents();
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to save incident. Please check database permissions.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`/api/incident-reports/${id}`);
      toast.success("Incident report deleted successfully.");
      setConfirmDelete(null);
      setViewState('list');
      fetchIncidents();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete incident report.");
    }
  };

  const handleExportCSV = async () => {
    try {
      const res = await axios.get("/api/export/incident-reports", { responseType: "blob" });
      const blob = new Blob([res.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "corporate_incidents_report.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Incident report exported successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Could not construct export file.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('incident-print-sheet');
    if (!element) {
      toast.error("Error targetting print sheet.");
      return;
    }
    
    const toastId = toast.loading("Generating high-fidelity PDF, please wait...");
    
    // Fallback parser function for both styles sanitisation and getComputedStyle interception
    const sanitizeOklchOklab = (value: any): any => {
      if (typeof value !== "string") return value;
      if (!value.includes("oklch") && !value.includes("oklab")) return value;

      const toSRGB = (val: number) => {
        if (val <= 0) return 0;
        if (val >= 1) return 255;
        return Math.round(
          (val <= 0.0031308 ? 12.92 * val : 1.055 * Math.pow(val, 1 / 2.4) - 0.055) * 255
        );
      };

      // Handle oklch
      let sanitized = value.replace(/oklch\(([^)]+)\)/g, (match, inner) => {
        try {
          const parts = inner.trim().split(/[\s,/]+/);
          if (parts.length > 0) {
            const lVal = parts[0];
            let l = parseFloat(lVal);
            if (lVal.includes('%')) l = l / 100;
            
            const cVal = parts[1] || '0';
            let c = parseFloat(cVal);
            if (cVal.includes('%')) c = c / 100;
            
            const hVal = parts[2] || '0';
            let h = parseFloat(hVal);
            
            let alpha = '1';
            if (parts.length >= 4) {
              const aVal = parts[3];
              let aNum = parseFloat(aVal);
              if (aVal.includes('%')) aNum = aNum / 100;
              alpha = isNaN(aNum) ? '1' : String(aNum);
            }

            if (isNaN(l)) {
              return `rgba(100, 100, 100, ${alpha})`;
            }

            const hRad = (h * Math.PI) / 180;
            const a = c * Math.cos(hRad);
            const b = c * Math.sin(hRad);

            const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
            const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
            const s_ = l - 0.0894841775 * a - 1.2914855480 * b;

            const l_cube = l_ * l_ * l_;
            const m_cube = m_ * m_ * m_;
            const s_cube = s_ * s_ * s_;

            const rLinear = +4.0767416621 * l_cube - 3.3077115913 * m_cube + 0.2309699292 * s_cube;
            const gLinear = -1.2684380046 * l_cube + 2.6097574011 * m_cube - 0.3413193965 * s_cube;
            const bLinear = -0.0041960863 * l_cube - 0.7034186147 * m_cube + 1.7076147010 * s_cube;

            const finalR = toSRGB(rLinear);
            const finalG = toSRGB(gLinear);
            const finalB = toSRGB(bLinear);

            return `rgba(${finalR}, ${finalG}, ${finalB}, ${alpha})`;
          }
        } catch (e) {
          console.error("Failed to parse oklch color:", match, e);
        }
        return 'rgb(100, 100, 100)';
      });

      // Handle oklab
      sanitized = sanitized.replace(/oklab\(([^)]+)\)/g, (match, inner) => {
        try {
          const parts = inner.trim().split(/[\s,/]+/);
          if (parts.length > 0) {
            const lVal = parts[0];
            let l = parseFloat(lVal);
            if (lVal.includes('%')) l = l / 100;
            
            const aVal = parts[1] || '0';
            let a = parseFloat(aVal);
            if (aVal.includes('%')) a = a / 100;
            
            const bVal = parts[2] || '0';
            let b = parseFloat(bVal);
            if (bVal.includes('%')) b = b / 100;
            
            let alpha = '1';
            if (parts.length >= 4) {
              const alphaVal = parts[3];
              let aNum = parseFloat(alphaVal);
              if (alphaVal.includes('%')) aNum = aNum / 100;
              alpha = isNaN(aNum) ? '1' : String(aNum);
            }

            if (isNaN(l)) {
              return `rgba(100, 100, 100, ${alpha})`;
            }

            const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
            const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
            const s_ = l - 0.0894841775 * a - 1.2914855480 * b;

            const l_cube = l_ * l_ * l_;
            const m_cube = m_ * m_ * m_;
            const s_cube = s_ * s_ * s_;

            const rLinear = +4.0767416621 * l_cube - 3.3077115913 * m_cube + 0.2309699292 * s_cube;
            const gLinear = -1.2684380046 * l_cube + 2.6097574011 * m_cube - 0.3413193965 * s_cube;
            const bLinear = -0.0041960863 * l_cube - 0.7034186147 * m_cube + 1.7076147010 * s_cube;

            const finalR = toSRGB(rLinear);
            const finalG = toSRGB(gLinear);
            const finalB = toSRGB(bLinear);

            return `rgba(${finalR}, ${finalG}, ${finalB}, ${alpha})`;
          }
        } catch (e) {
          console.error("Failed to parse oklab color:", match, e);
        }
        return 'rgb(100, 100, 100)';
      });

      return sanitized;
    };

    const originalGetComputedStyle = window.getComputedStyle;
    
    // Override standard getComputedStyle during the export to intercept computed oklch/oklab styles dynamically queried by html2canvas
    window.getComputedStyle = function (elt: Element, pseudoElt?: string | null): CSSStyleDeclaration {
      const style = originalGetComputedStyle(elt, pseudoElt);
      return new Proxy(style, {
        get(target, prop, receiver) {
          const val = Reflect.get(target, prop, target);
          if (typeof val === 'function') {
            if (prop === 'getPropertyValue') {
              return function(propertyName: string) {
                const originalVal = target.getPropertyValue(propertyName);
                return sanitizeOklchOklab(originalVal);
              };
            }
            return val.bind(target);
          }
          return sanitizeOklchOklab(val);
        }
      }) as any;
    };
    
    // Sanitize any stylesheets containing oklch/oklab functions which html2canvas fails to parse
    const restoreStylesheets = (() => {
      const originalSheetsState: { sheet: CSSStyleSheet; disabled: boolean }[] = [];
      const tempStyleTags: HTMLStyleElement[] = [];
      const sheetsSnapshot = Array.from(document.styleSheets);

      for (let i = 0; i < sheetsSnapshot.length; i++) {
        const sheet = sheetsSnapshot[i];
        try {
          const rules = sheet.cssRules || sheet.rules;
          if (!rules) continue;

          let hasInvalidColorFunc = false;
          let fullCssText = "";
          
          for (let j = 0; j < rules.length; j++) {
            const ruleText = rules[j].cssText;
            fullCssText += ruleText + "\n";
            if (ruleText.includes("oklch") || ruleText.includes("oklab")) {
              hasInvalidColorFunc = true;
            }
          }

          if (hasInvalidColorFunc) {
            originalSheetsState.push({ sheet, disabled: sheet.disabled });
            sheet.disabled = true;

            const sanitizedCss = sanitizeOklchOklab(fullCssText);

            const styleTag = document.createElement("style");
            styleTag.setAttribute("data-html2canvas-temp", "true");
            styleTag.innerHTML = sanitizedCss;
            document.head.appendChild(styleTag);
            tempStyleTags.push(styleTag);
          }
        } catch (err) {
          console.warn("Could not check/sanitize stylesheet rules:", err);
        }
      }

      return () => {
        originalSheetsState.forEach(({ sheet, disabled }) => {
          sheet.disabled = disabled;
        });
        tempStyleTags.forEach(tag => {
          tag.remove();
        });
      };
    })();

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      });
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const marginT = 16;
      const marginB = 16;
      const marginL = 12;
      const marginR = 12;

      const pw = 210 - marginL - marginR;
      const ph = 297 - marginT - marginB;

      // Slice the canvas dynamic-height into multiple pages with perfect margins top & bottom
      const pxPageHeight = (ph * canvas.width) / pw;
      let srcY = 0;
      let pageIndex = 1;
      const totalPages = Math.ceil(canvas.height / pxPageHeight);

      while (srcY < canvas.height) {
        const sliceHeight = Math.min(pxPageHeight, canvas.height - srcY);
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = sliceHeight;
        
        const ctx = tempCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(
            canvas,
            0, srcY, canvas.width, sliceHeight,
            0, 0, canvas.width, sliceHeight
          );
        }
        
        const sliceImgData = tempCanvas.toDataURL('image/png');
        
        if (srcY > 0) {
          pdf.addPage();
          pageIndex++;
        }
        
        const destHeight = (sliceHeight * pw) / canvas.width;
        pdf.addImage(sliceImgData, 'PNG', marginL, marginT, pw, destHeight, undefined, 'FAST');

        // Draw crisp vector boundary around each page slice to complete sliced borders perfectly
        pdf.setDrawColor(203, 213, 225); // Slate-300 color matching border-slate-350 perfectly
        pdf.setLineWidth(0.35); // Clean professional thin border line
        pdf.rect(marginL, marginT, pw, destHeight);

        // Add subtle elegant page numbering if there is more than one page
        if (totalPages > 1) {
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8);
          pdf.setTextColor(148, 163, 184); // Slate-400 text color
          pdf.text(`Page ${pageIndex} of ${totalPages}`, marginL + pw - 24, 297 - 8);
        }
        
        srcY += pxPageHeight;
      }
      
      const filename = selectedIncident 
         ? `Incident_Report_${(selectedIncident.incident_number ? selectedIncident.incident_number.replace(/^AP-/i, '') : '') || selectedIncident.id}.pdf`
         : 'Incident_Report.pdf';
         
      pdf.save(filename);
      toast.success("PDF Downloaded!", { id: toastId });
    } catch (error) {
      console.error("PDF engine failure:", error);
      toast.error("Could not compile HTML template to PDF.", { id: toastId });
    } finally {
      restoreStylesheets();
      window.getComputedStyle = originalGetComputedStyle;
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 px-4 sm:px-6">
      
      {/* ========================================================
          LIST VIEW (Keep only export button & Add Report button)
          ======================================================== */}
      {viewState === 'list' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">Incident Logs</h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">Official EHCO CO. Incident Dispatch Hub</p>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                onClick={handleExportCSV}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-600 rounded-xl transition-all shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
              
              {user?.role !== 'user' && (
                <button
                  onClick={handleOpenCreate}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white rounded-xl transition-all shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Report Incident
                </button>
              )}
            </div>
          </div>

          {incidents.length === 0 ? (
            <div className="bg-slate-50/50 border border-slate-200/80 border-dashed rounded-3xl p-12 text-center max-w-lg mx-auto">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">No Incidents Logged</h3>
              <p className="text-xs text-slate-400 mt-1">Submit a new incident report to log events onto the secure database.</p>
              {user?.role !== 'user' && (
                <button
                  onClick={handleOpenCreate}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-lg hover:bg-slate-800 transition-all"
                >
                  Create First Report
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse font-sans">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10.5px] font-bold text-black uppercase tracking-wider font-mono">
                      <th className="py-3 px-5">Num</th>
                      <th className="py-3 px-5">Reporter</th>
                      <th className="py-3 px-5">Incident Title</th>
                      <th className="py-3 px-5">Department</th>
                      <th className="py-3 px-5">Date</th>
                      <th className="py-3 px-5">Severity</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-105 text-xs text-slate-600">
                    {incidents.map((inc) => (
                      <tr key={inc.id} className="hover:bg-slate-50/50 transition-all">
                        <td className="py-3.5 px-5 font-mono text-[11px] font-bold text-slate-500">
                          {(inc.incident_number ? inc.incident_number.replace(/^AP-/i, '') : '') || `INC-${inc.id}`}
                        </td>
                        <td className="py-3.5 px-5 font-bold text-slate-800">
                          {inc.employee_name || inc.reporter_name}
                        </td>
                        <td className="py-3.5 px-5 max-w-xs truncate font-medium text-slate-705">
                          {inc.title}
                        </td>
                        <td className="py-3.5 px-5 text-slate-500">
                          {inc.department || "IT Dept"}
                        </td>
                        <td className="py-3.5 px-5 font-mono text-[11px] text-slate-400">
                          {inc.incident_date || (inc.created_at ? new Date(inc.created_at).toLocaleDateString() : '—')}
                        </td>
                        <td className="py-3.5 px-5">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                            inc.severity === 'Critical' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            inc.severity === 'High' ? 'bg-red-50 text-red-600 border-red-200' :
                            inc.severity === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-blue-50 text-blue-600 border-blue-200'
                          }`}>
                            {inc.severity || 'Low'}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right space-x-1 whitespace-nowrap">
                          <button
                            onClick={() => handleView(inc)}
                            className="px-2.5 py-1 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            View Form
                          </button>

                          {inc.approval_file_url ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => downloadFile(encodeURI(inc.approval_file_url.startsWith('/') ? inc.approval_file_url : `/${inc.approval_file_url}`), inc.approval_file_name || "approval_document.pdf")}
                                className="px-2 py-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                                title={inc.approval_file_name || "Download Approval File"}
                              >
                                <FileCheck className="w-3 h-3 inline mr-1" />
                                View Approval
                              </button>
                              {user?.role !== 'user' && (
                                <label className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer transition-all inline-flex items-center" title="Re-upload Approval File">
                                  <Upload className="w-3 h-3" />
                                  <input
                                    type="file"
                                    className="hidden"
                                    disabled={uploadingId !== null}
                                    onChange={(e) => handleApprovalFileUpload(inc.id, e)}
                                  />
                                </label>
                              )}
                            </div>
                          ) : (
                            user?.role !== 'user' && (
                              <label className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg cursor-pointer transition-all">
                                {uploadingId === inc.id ? (
                                  <>
                                    <span className="w-3 h-3 border-2 border-indigo-600 border-t-transparent animate-spin rounded-full"></span>
                                    Uploading...
                                  </>
                                ) : (
                                  <>
                                    <Upload className="w-3 h-3" />
                                    Upload Approval
                                  </>
                                )}
                                <input
                                  type="file"
                                  className="hidden"
                                  disabled={uploadingId !== null}
                                  onChange={(e) => handleApprovalFileUpload(inc.id, e)}
                                />
                              </label>
                            )
                          )}
                          
                          {user?.role !== 'user' && (
                            <button
                              onClick={() => handleEdit(inc)}
                              className="px-2 py-1 text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-3 h-3 inline" />
                            </button>
                          )}

                          {isSystemAdmin && (
                            <button
                              onClick={() => setConfirmDelete(inc.id)}
                              className="px-2 py-1 text-[11px] font-bold text-red-650 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3 inline" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          FORM MODE: CREATE OR EDIT
          ======================================================== */}
      {(viewState === 'create' || viewState === 'edit') && (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setViewState('list')}
                className="p-2 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  {viewState === 'create' ? "New Official Incident Form" : `Modify Incident Report #${formData.incident_number ? formData.incident_number.replace(/^AP-/i, '') : ''}`}
                </h1>
                <p className="text-xs text-slate-400 font-mono">Fill in precise fields to output print-ready incident documentation</p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setViewState('list')}
                className="flex-1 sm:flex-none px-4 py-2 border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 sm:flex-none px-5 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white rounded-xl transition-all"
              >
                {isSaving ? "Saving..." : "Save Record"}
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
            
            {/* Top Form Meta info */}
            <div className="border-b border-slate-150 pb-5">
              <h3 className="text-[11px] font-bold text-slate-400 font-mono uppercase tracking-wider mb-3">1. Incident Core Metadata</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 font-mono">Incident Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 001"
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl placeholder-slate-400 focus:ring-1 focus:ring-slate-400 focus:border-slate-400 font-mono"
                    value={formData.incident_number}
                    onChange={(e) => setFormData({ ...formData, incident_number: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 font-mono">Incident Date</label>
                  <input
                    type="date"
                    required
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-400 focus:border-slate-400 font-mono"
                    value={formData.incident_date}
                    onChange={(e) => setFormData({ ...formData, incident_date: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 font-mono">Incident Time</label>
                  <input
                    type="text"
                    placeholder="e.g. 10:30 AM"
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-400 focus:border-slate-400"
                    value={formData.incident_time}
                    onChange={(e) => setFormData({ ...formData, incident_time: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 font-mono">Incident Old Ref</label>
                  <input
                    type="text"
                    placeholder="e.g. None"
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-400 focus:border-slate-400 font-mono"
                    value={formData.incident_old_ref}
                    onChange={(e) => setFormData({ ...formData, incident_old_ref: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Affected Employee Details */}
            <div className="border-b border-slate-150 pb-5">
              <h3 className="text-[11px] font-bold text-slate-400 font-mono uppercase tracking-wider mb-3">2. Employee & Reporter Identification</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1 relative">
                  <label className="text-[10px] font-bold text-slate-500 font-mono">Employee / Person Name</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-400"
                    value={formData.employee_name}
                    onChange={(e) => {
                      setFormData({ ...formData, employee_name: e.target.value, reporter_name: e.target.value });
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => {
                      setTimeout(() => setShowSuggestions(false), 200);
                    }}
                    placeholder="Type name to search or add..."
                  />
                  {showSuggestions && matchingEmployees.length > 0 && (
                    <ul className="absolute z-55 left-0 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto text-xs divide-y divide-slate-100">
                      {matchingEmployees.map((emp) => (
                        <li
                          key={emp.id}
                          className="px-3.5 py-2 cursor-pointer hover:bg-slate-50 transition-colors flex flex-col gap-0.5 text-left"
                          onMouseDown={() => handleSelectEmployee(emp)}
                        >
                          <div className="font-bold text-slate-800">{emp.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1.5 flex-wrap">
                            <span>ID: {emp.sn || "—"}</span>
                            <span>•</span>
                            <span>{emp.department || "No Dept"}</span>
                            <span>•</span>
                            <span>{emp.position || "No Job Title"}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 font-mono">Employee ID / Email</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-400 font-mono"
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 font-mono">Department Name</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-400"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 font-mono">Job Title</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-400"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 font-mono">Reporting Manager Name</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-400"
                    value={formData.reporting_manager}
                    onChange={(e) => setFormData({ ...formData, reporting_manager: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 font-mono">Incident Taken By (Operator)</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-400"
                    value={formData.incident_taken_by}
                    onChange={(e) => setFormData({ ...formData, incident_taken_by: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Incident Definitions */}
            <div className="border-b border-slate-150 pb-5 space-y-4">
              <h3 className="text-[11px] font-bold text-slate-400 font-mono uppercase tracking-wider">3. Incident Anatomy & Descriptions</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 font-mono">Event General Type</label>
                  <div className="space-y-1.5">
                    <select
                      className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white font-bold text-slate-700 focus:ring-1 focus:ring-slate-400"
                      value={["IT", "Security", "Safety", "Facilities", "Other"].includes(formData.type) ? formData.type : "custom"}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "custom") {
                          setFormData({ ...formData, type: "" });
                        } else {
                          setFormData({ ...formData, type: val });
                        }
                      }}
                    >
                      <option value="IT">IT & Networks</option>
                      <option value="Security">Security Threats</option>
                      <option value="Safety">Safety & Health</option>
                      <option value="Facilities">Facilities & Worksite</option>
                      <option value="Other">Other Issues</option>
                      <option value="custom">Custom (Type manually...)</option>
                    </select>

                    {(!["IT", "Security", "Safety", "Facilities", "Other"].includes(formData.type) || formData.type === "") && (
                      <input
                        type="text"
                        required
                        placeholder="Type custom event type..."
                        className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-400 font-bold text-slate-700 bg-white"
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 font-mono">Severity Tier</label>
                  <select
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white font-bold text-slate-700"
                    value={formData.severity}
                    onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 font-mono">Current Process Status</label>
                  <select
                    className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl bg-white font-bold text-slate-700"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 font-mono">Incident Definition (One-sentence Brief)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Detection of suspected malware activity on a company-assigned laptop..."
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-400"
                  value={formData.incident_definition}
                  onChange={(e) => setFormData({ ...formData, incident_definition: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 font-mono">Description of Incident (Detailed Narrative)</label>
                <AutoGrowingTextarea
                  rows={5}
                  required
                  placeholder="Provide a step-by-step review of how the incident unfolded, diagnostics involved, etc."
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-400 leading-relaxed bg-white"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 font-mono">Impact of Incident (Risk Assessment & Downside)</label>
                <AutoGrowingTextarea
                  rows={4}
                  required
                  placeholder="Detail the operational downtime, financial, security or licensing bypass risks created."
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-400 leading-relaxed bg-white"
                  value={formData.impact_of_incident}
                  onChange={(e) => setFormData({ ...formData, impact_of_incident: e.target.value })}
                />
              </div>
            </div>

            {/* Resolutions & Signatures */}
            <div className="space-y-5">
              <h3 className="text-[11px] font-bold text-slate-400 font-mono uppercase tracking-wider">4. Operational Actions & Sign-Off</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 font-mono">Corrective Action Taken</label>
                  <AutoGrowingTextarea
                    rows={4}
                    required
                    placeholder="Enter completed mitigations (one per line or complete text)."
                    className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-400 leading-relaxed bg-white"
                    value={formData.corrective_action}
                    onChange={(e) => setFormData({ ...formData, corrective_action: e.target.value, action_taken: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 font-mono">Preventive Action Plan</label>
                  <AutoGrowingTextarea
                    rows={4}
                    required
                    placeholder="Enter long-term preventive procedures (one per line)."
                    className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:ring-1 focus:ring-slate-400 leading-relaxed bg-white"
                    value={formData.preventive_action}
                    onChange={(e) => setFormData({ ...formData, preventive_action: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 font-mono">Prepared By Name</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 bg-white rounded-xl focus:ring-1 focus:ring-slate-400"
                    value={formData.prepared_by_name}
                    onChange={(e) => setFormData({ ...formData, prepared_by_name: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 font-mono">Prepared By Title</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 bg-white rounded-xl focus:ring-1 focus:ring-slate-400"
                    value={formData.prepared_by_position}
                    onChange={(e) => setFormData({ ...formData, prepared_by_position: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 font-mono">Work Location / Site</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 bg-white rounded-xl focus:ring-1 focus:ring-slate-400"
                    value={formData.prepared_by_location}
                    onChange={(e) => setFormData({ ...formData, prepared_by_location: e.target.value })}
                  />
                </div>
              </div>
            </div>

          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setViewState('list')}
              className="px-6 py-2.5 border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-all"
            >
              Discard Changes
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-8 py-2.5 bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white rounded-xl transition-all shadow-md hover:shadow-lg"
            >
              {isSaving ? "Saving..." : "Save Record"}
            </button>
          </div>
        </form>
      )}

      {/* ========================================================
          SPECIFIC HIGH-FIDELITY PRINT-READY VIEWING SHEET
          ======================================================== */}
      {viewState === 'view' && selectedIncident && (
        <div className="space-y-8 max-w-4xl mx-auto">
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5 no-print">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewState('list')}
                className="p-2 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-xl transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Form #{selectedIncident.incident_number ? selectedIncident.incident_number.replace(/^AP-/i, '') : selectedIncident.id}</h1>
                <p className="text-xs text-slate-400 font-mono">Interactive Al-Boyout Homes Print Preview</p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {user?.role !== 'user' && (
                <button
                  onClick={() => handleEdit(selectedIncident)}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit Form
                </button>
              )}

              <button
                onClick={handleDownloadPDF}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-bold text-white rounded-xl transition-all shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Download PDF
              </button>
            </div>
          </div>

          {/* Approval Document Control Box (Non-Printable) */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 no-print shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                {selectedIncident.approval_file_url ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                )}
              </div>
              <div className="text-left">
                <h3 className="text-sm font-bold text-slate-800">Approval Documentation</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedIncident.approval_file_url ? (
                    <>Covered by: <span className="font-mono font-medium text-slate-700">{selectedIncident.approval_file_name}</span></>
                  ) : (
                    "No approval document uploaded yet for this incident report."
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {selectedIncident.approval_file_url && (
                <button
                  onClick={() => downloadFile(encodeURI(selectedIncident.approval_file_url.startsWith('/') ? selectedIncident.approval_file_url : `/${selectedIncident.approval_file_url}`), selectedIncident.approval_file_name || "approval_document.pdf")}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-50 border border-emerald-150 text-xs font-bold text-emerald-700 hover:bg-emerald-100 rounded-xl transition-all"
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  View Approval File
                </button>
              )}
              {user?.role !== 'user' && (
                <label className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-xl cursor-pointer transition-all">
                  {uploadingId === selectedIncident.id ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-slate-605 border-t-transparent animate-spin rounded-full"></span>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5 text-slate-500" />
                      {selectedIncident.approval_file_url ? "Change File" : "Upload Approval File"}
                    </>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    disabled={uploadingId !== null}
                    onChange={(e) => handleApprovalFileUpload(selectedIncident.id, e)}
                  />
                </label>
              )}
            </div>
          </div>
                    {/* PRINT SHEET - ACCURATE REPLICATION OF THE UPLOADED FORM */}
          <div 
            id="incident-print-sheet" 
            className="auth-print-sheet bg-white border border-slate-350 shadow-2xl mx-auto rounded-none print:shadow-none print:border-none overflow-hidden font-sans text-slate-800 p-8 sm:p-12 print:p-6" 
            style={{ maxWidth: '820px', minHeight: '1050px' }}
          >
            {/* Elegant Framing representing an official document */}
            <div className="h-full flex flex-col justify-between">
              
              {/* Form Header Box */}
              <div className="w-full text-center border-b-2 border-slate-900 pb-4 mb-4">
                <div className="text-[10px] tracking-[0.25em] font-bold text-slate-400 uppercase font-mono mb-1">Official Registry Document</div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-widest leading-none">INCIDENT REPORT FORM</h1>
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1.5">EHCO CORPORATION</h2>
              </div>

              {/* Split Contact / Logo Section */}
              <div className="grid grid-cols-3 border-b-2 border-slate-900 pb-4 mb-4 items-center">
                <div className="col-span-2 text-[10px] sm:text-xs leading-relaxed text-slate-600 font-sans pr-4">
                  <div className="space-y-0.5">
                    <div><span className="font-bold text-slate-800">Head Office:</span> Exit 13, Khurais Road, Riyadh, KSA</div>
                    <div><span className="font-bold text-slate-800">Post Box:</span> PB 10236, Riyadh 11646, Kingdom of Saudi Arabia</div>
                    <div><span className="font-bold text-slate-800">Tel / Fax:</span> +966 11 497 2727 | Fax: 011 20 86167</div>
                    <div><span className="font-bold text-slate-800">Email:</span> info@ehco.com.sa • <span className="font-bold text-slate-800">Web:</span> www.ehco.com.sa</div>
                  </div>
                </div>

                {/* Brand Logo imported from assets folder */}
                <div className="col-span-1 flex flex-col justify-center items-center p-2 select-none border-l border-slate-200">
                  <img src={logo} alt="EHCO Logo" className="h-[46px] w-auto object-contain" referrerPolicy="no-referrer" />
                </div>
              </div>

              {/* Grid Metadata Fields Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 text-xs border border-slate-900 rounded-lg overflow-hidden mb-5 divide-y md:divide-y-0 md:divide-x divide-slate-900 bg-slate-50/50">
                {/* Left Column Fields */}
                <div className="divide-y divide-slate-200">
                  <div className="grid grid-cols-3 p-2.5 items-center">
                    <span className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">Employee Name</span>
                    <span className="col-span-2 font-semibold text-slate-900 pl-2">: {selectedIncident.employee_name || "—"}</span>
                  </div>
                  <div className="grid grid-cols-3 p-2.5 items-center">
                    <span className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">Employee ID</span>
                    <span className="col-span-2 font-mono font-medium text-slate-800 pl-2">: {selectedIncident.employee_id || "—"}</span>
                  </div>
                  <div className="grid grid-cols-3 p-2.5 items-center">
                    <span className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">Department</span>
                    <span className="col-span-2 font-semibold text-slate-900 pl-2">: {selectedIncident.department || "—"}</span>
                  </div>
                  <div className="grid grid-cols-3 p-2.5 items-center">
                    <span className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">Job Title</span>
                    <span className="col-span-2 font-semibold text-slate-900 pl-2">: {selectedIncident.title || "—"}</span>
                  </div>
                  <div className="grid grid-cols-3 p-2.5 items-center">
                    <span className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">Reporter Mgr</span>
                    <span className="col-span-2 font-semibold text-slate-900 pl-2">: {selectedIncident.reporting_manager || "—"}</span>
                  </div>
                </div>

                {/* Right Column Fields */}
                <div className="divide-y divide-slate-200 border-t md:border-t-0 border-slate-900">
                  <div className="grid grid-cols-3 p-2.5 items-center">
                    <span className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">Report No</span>
                    <span className="col-span-2 font-mono font-bold text-red-650 pl-2">: {selectedIncident.incident_number ? selectedIncident.incident_number.replace(/^AP-/i, '') : "—"}</span>
                  </div>
                  <div className="grid grid-cols-3 p-2.5 items-center">
                    <span className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">Report Date</span>
                    <span className="col-span-2 font-semibold font-mono text-slate-900 pl-2">: {selectedIncident.incident_date || "—"}</span>
                  </div>
                  <div className="grid grid-cols-3 p-2.5 items-center">
                    <span className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">Report Time</span>
                    <span className="col-span-2 font-semibold text-slate-900 pl-2">: {selectedIncident.incident_time || "—"}</span>
                  </div>
                  <div className="grid grid-cols-3 p-2.5 items-center">
                    <span className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">Incident Operator</span>
                    <span className="col-span-2 font-semibold text-slate-900 pl-2">: {selectedIncident.incident_taken_by || "—"}</span>
                  </div>
                  <div className="grid grid-cols-3 p-2.5 items-center">
                    <span className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">Old Reference</span>
                    <span className="col-span-2 font-semibold text-slate-900 font-mono pl-2">: {selectedIncident.incident_old_ref || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Brief Definition Banner */}
              <div className="py-2.5 px-3.5 border-l-4 border-slate-900 bg-slate-50 rounded-r-lg text-xs font-sans leading-relaxed mb-4">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px] block mb-0.5">Incident summary</span>
                <span className="text-slate-900 font-semibold">{selectedIncident.incident_definition || "—"}</span>
              </div>

              {/* Dynamic content sections where layout sizes perfectly expand and shrink based on contents */}
              <div className="space-y-4">
                
                {/* Description Box */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-100 border-b border-slate-200 px-3.5 py-1.5 text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    Detailed Narrative / Description
                  </div>
                  <div className="p-4 text-xs text-slate-900 whitespace-pre-line leading-relaxed">
                    {selectedIncident.description}
                  </div>
                </div>

                {/* Impact Assessment Box */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-100 border-b border-slate-200 px-3.5 py-1.5 text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    Downside Operational Risk & Impact Assessment
                  </div>
                  <div className="p-4 text-xs text-slate-900 whitespace-pre-line leading-relaxed">
                    {selectedIncident.impact_of_incident || "No operational impact recorded."}
                  </div>
                </div>

                {/* Operations corrective & preventive section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Corrective Box */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-100 border-b border-slate-200 px-3.5 py-1.5 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Corrective Action</span>
                      <span className="text-[9px] font-mono text-slate-400 uppercase">Target Date: {selectedIncident.corrective_action_date || selectedIncident.incident_date}</span>
                    </div>
                    <div className="p-4 text-xs text-slate-905 leading-relaxed">
                      {selectedIncident.corrective_action ? (
                        <ul className="list-disc pl-4 space-y-1.5">
                          {selectedIncident.corrective_action.split('\n').filter((line: string) => line.trim() !== '').map((item: string, idx: number) => {
                            const clean = item.replace(/^[•\-\*]\s*/, '');
                            return <li key={idx} className="font-semibold text-slate-900">{clean}</li>;
                          })}
                        </ul>
                      ) : (
                        <span className="text-slate-400 italic">No corrective actions logged.</span>
                      )}
                    </div>
                  </div>

                  {/* Preventive Box */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-100 border-b border-slate-200 px-3.5 py-1.5 text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      Preventive Procedure Plan
                    </div>
                    <div className="p-4 text-xs text-slate-905 leading-relaxed">
                      {selectedIncident.preventive_action ? (
                        <ul className="list-disc pl-4 space-y-1.5">
                          {selectedIncident.preventive_action.split('\n').filter((line: string) => line.trim() !== '').map((item: string, idx: number) => {
                            const clean = item.replace(/^[•\-\*]\s*/, '');
                            return <li key={idx} className="font-semibold text-slate-900">{clean}</li>;
                          })}
                        </ul>
                      ) : (
                        <span className="text-slate-400 italic">No long-term preventive procedures detailed.</span>
                      )}
                    </div>
                  </div>
                </div>

              </div>
              {/* End Signatures Grid Panel */}
              <div className="mt-6 pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                
                {/* Prepared By Registry Reporter Block */}
                <div className="border border-slate-300 rounded-lg overflow-hidden h-[155px] bg-white shadow-sm relative">
                  <div className="bg-slate-50 p-2 text-center font-bold uppercase tracking-wider text-[9px] text-black border-b border-slate-300 h-[30px] flex items-center justify-center">
                    Prepared By Registry Reporter
                  </div>
                  <div className="p-3 h-[125px] relative">
                    <table className="w-full text-[9.5px] border-collapse table-fixed">
                      <tbody>
                        <tr className="border-b border-slate-200">
                          <td className="py-1 font-semibold text-black text-left w-[50%]">Prepared By Name</td>
                          <td className="py-1 font-bold text-black text-right w-[50%] truncate">{selectedIncident.prepared_by_name || "—"}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="py-1 font-semibold text-black text-left w-[50%]">Prepared By Title</td>
                          <td className="py-1 font-bold text-black text-right w-[50%] truncate">{selectedIncident.prepared_by_position || "—"}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="py-1 font-semibold text-black text-left w-[50%]">Work Location / Site</td>
                          <td className="py-1 font-bold text-black text-right w-[50%] truncate">{selectedIncident.prepared_by_location || "—"}</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="absolute bottom-2 left-3 right-3 border-t border-slate-400 border-dashed pt-1">
                      <table className="w-full text-[8px] text-black uppercase tracking-wider font-bold">
                        <tbody>
                          <tr>
                            <td className="text-left text-black">Authorized Signature</td>
                            <td className="text-right text-black">Date</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Employee Sign-Off Validation Block */}
                <div className="border border-slate-300 rounded-lg overflow-hidden h-[155px] bg-white shadow-sm relative">
                  <div className="bg-slate-50 p-2 text-center font-bold uppercase tracking-wider text-[9px] text-black border-b border-slate-300 h-[30px] flex items-center justify-center">
                    Employee Sign-Off Validation
                  </div>
                  <div className="p-3 h-[125px] relative">
                    <table className="w-full text-[9.5px] border-collapse table-fixed">
                      <tbody>
                        <tr className="border-b border-slate-200">
                          <td className="py-1 font-semibold text-black text-left w-[50%]">Employee Name</td>
                          <td className="py-1 font-bold text-black text-right w-[50%] truncate">{selectedIncident.employee_name || "—"}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="py-1 font-semibold text-black text-left w-[50%]">Employee ID</td>
                          <td className="py-1 font-bold text-black text-right w-[50%] truncate">{selectedIncident.employee_id || "—"}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="py-1 font-semibold text-black text-left w-[50%]">Department</td>
                          <td className="py-1 font-bold text-black text-right w-[50%] truncate">{selectedIncident.department || "—"}</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="absolute bottom-2 left-3 right-3 border-t border-slate-400 border-dashed pt-1">
                      <table className="w-full text-[8px] text-black uppercase tracking-wider font-bold">
                        <tbody>
                          <tr>
                            <td className="text-left text-black">Employee Signature</td>
                            <td className="text-right text-black">Date</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Supervisor / Reporting Manager Block */}
                <div className="border border-slate-300 rounded-lg overflow-hidden h-[155px] bg-white shadow-sm relative">
                  <div className="bg-slate-50 p-2 text-center font-bold uppercase tracking-wider text-[9px] text-black border-b border-slate-300 h-[30px] flex items-center justify-center">
                    Supervisor / Reporting Manager
                  </div>
                  <div className="p-3 h-[125px] relative">
                    <table className="w-full text-[9.5px] border-collapse table-fixed">
                      <tbody>
                        <tr className="border-b border-slate-200">
                          <td className="py-1 font-semibold text-black text-left w-[50%]">Reporting Manager</td>
                          <td className="py-1 font-bold text-black text-right w-[50%] truncate">{selectedIncident.reporting_manager || "—"}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="py-1 font-semibold text-black text-left w-[50%]">Incident Taken By</td>
                          <td className="py-1 font-bold text-black text-right w-[50%] truncate">{selectedIncident.incident_taken_by || "—"}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="py-1 font-semibold text-black text-left w-[40%]">Incident Date / Time</td>
                          <td className="py-1 font-bold text-black text-right w-[60%] truncate">
                            {selectedIncident.incident_date || "—"} {selectedIncident.incident_time ? `@ ${selectedIncident.incident_time}` : ""}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="absolute bottom-2 left-3 right-3 border-t border-slate-400 border-dashed pt-1">
                      <table className="w-full text-[8px] text-black uppercase tracking-wider font-bold">
                        <tbody>
                          <tr>
                            <td className="text-left text-black">Manager Signature</td>
                            <td className="text-right text-black">Date</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Project Director / General Manager Approval Block */}
                <div className="border border-slate-300 rounded-lg overflow-hidden h-[155px] bg-white shadow-sm relative">
                  <div className="bg-slate-50 p-2 text-center font-bold uppercase tracking-wider text-[9px] text-black border-b border-slate-300 h-[30px] flex items-center justify-center">
                    Project Director / General Manager Approval
                  </div>
                  <div className="p-3 h-[125px] relative">
                    <table className="w-full text-[9.5px] border-collapse table-fixed">
                      <tbody>
                        <tr className="border-b border-slate-200">
                          <td className="py-1 font-semibold text-black text-left w-[50%]">Incident Number</td>
                          <td className="py-1 font-bold text-black text-right w-[50%] truncate">{selectedIncident.incident_number ? selectedIncident.incident_number.replace(/^AP-/i, '') : "—"}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="py-1 font-semibold text-black text-left w-[50%]">Incident Definition</td>
                          <td className="py-1 font-bold text-black text-right w-[50%] truncate">{selectedIncident.incident_definition || "—"}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="py-1 font-semibold text-black text-left w-[50%]">Old Ref Number</td>
                          <td className="py-1 font-bold text-black text-right w-[50%] truncate">{selectedIncident.incident_old_ref || "—"}</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="absolute bottom-2 left-3 right-3 border-t border-slate-400 border-dashed pt-1">
                      <table className="w-full text-[8px] text-black uppercase tracking-wider font-bold">
                        <tbody>
                          <tr>
                            <td className="text-left text-black">Director Signature</td>
                            <td className="text-right text-black">Date</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 no-print pt-4">
            <button
              onClick={() => setViewState('list')}
              className="px-5 py-2.5 border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-all"
            >
              Back to Dispatch
            </button>
            <button
              onClick={handleDownloadPDF}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
            >
              <Download className="w-4 h-4" />
              Download PDF Form
            </button>
          </div>
        </div>
      )}

      {/* Confirmation of deletion */}
      {confirmDelete && (
        <ConfirmModal
          isOpen={true}
          title="Delete Incident Report"
          message="Are you sure you want to permanently erase this official incident report from database telemetry logs? This cannot be undone."
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
          confirmText="Yes, Delete"
          cancelText="Keep"
        />
      )}

    </div>
  );
}
