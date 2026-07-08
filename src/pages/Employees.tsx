import React, { useState, useEffect } from "react";
import { SearchableSelect } from "../components/SearchableSelect";
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Eye,
  UserPlus,
  Download
} from "lucide-react";
import axios from "axios";
import { Link } from "react-router-dom";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useAuth, useData } from "../App";
import ConfirmModal from "../components/ConfirmModal";
import AlertModal from "../components/AlertModal";
import LoadingSpinner from "../components/LoadingSpinner";
import { downloadFile } from "../utils/downloadHelper";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Employees() {
  const { isAdmin, isSystemAdmin } = useAuth();
  const { data, ensureData, refreshData } = useData();
  const employees = data.employees;
  const assets = data.assets;
  const positions = data.positions;
  const locations = data.locations;
  const departments = data.departments;
  
  const [loading, setLoading] = useState(!employees.length || !positions.length);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    position: "All",
    department: "All",
    location: "All",
    status: "Active",
    mobile: ""
  });
  const [showAddModal, setShowAddModal] = useState(false);
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
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [newEmployee, setNewEmployee] = useState<any>({
    sn: "", name: "", email: "", position: "", department: "", mobile: "", location: "", location_id: "", status: "Active", notes: "", reporting_manager: "", company_name: "Economic House Construction Company"
  });

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        ensureData("employees"),
        ensureData("assets"),
        ensureData("master") // loads positions, departments, locations, etc.
      ]);
      setLoading(false);
    };
    loadData();
  }, []);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    
    let employeeToSave = { ...newEmployee };
    
    // Auto-generate numeric SN if not editing and SN is empty
    if (!isEditing && !employeeToSave.sn) {
      const empArray = Array.isArray(employees) ? employees : [];
      const maxSn = empArray.reduce((max, emp) => {
        const num = parseInt(emp.sn);
        return isNaN(num) ? max : Math.max(max, num);
      }, 0);
      employeeToSave.sn = (maxSn + 1).toString();
    }

    if (isEditing && selectedEmployee) {
      axios.put(`/api/employees/${selectedEmployee.id}`, employeeToSave)
        .then((res) => {
          if (res.data && res.data.success === false) {
            setAlertState({ isOpen: true, title: "Error", message: res.data.message || "Failed to update employee", type: "error" });
            return;
          }
          refreshData("employees");
          setShowAddModal(false);
          setIsEditing(false);
          setSelectedEmployee(null);
          setNewEmployee({ sn: "", name: "", email: "", position: "", department: "", mobile: "", location: "", status: "Active", notes: "", reporting_manager: "", company_name: "Economic House Construction Company" });
          setAlertState({ isOpen: true, title: "Success", message: "Employee updated successfully!", type: "success" });
        })
        .catch((error) => {
          console.error("Failed to update employee:", error);
          const errorMessage = error.response?.data?.message || error.message || "Failed to update employee.";
          setAlertState({ isOpen: true, title: "Error", message: errorMessage, type: "error" });
        });
    } else {
      axios.post("/api/employees", employeeToSave)
        .then((res) => {
          if (res.data && res.data.success === false) {
            setAlertState({ isOpen: true, title: "Error", message: res.data.message || "Failed to add employee", type: "error" });
            return;
          }
          refreshData("employees");
          setShowAddModal(false);
          setNewEmployee({ sn: "", name: "", email: "", position: "", department: "", mobile: "", location: "", status: "Active", notes: "", reporting_manager: "", company_name: "Economic House Construction Company" });
          setAlertState({ isOpen: true, title: "Success", message: "Employee added successfully!", type: "success" });
        })
        .catch((error) => {
          console.error("Failed to add employee:", error);
          const errorMessage = error.response?.data?.message || error.message || "Failed to add employee.";
          setAlertState({ isOpen: true, title: "Error", message: errorMessage, type: "error" });
        });
    }
  };

  const handleDelete = (id: number) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Employee",
      message: "Are you sure you want to delete this employee?",
      onConfirm: () => {
        axios.delete(`/api/employees/${id}`)
          .then((res) => {
            if (res.data && res.data.success === false) {
              setAlertState({ isOpen: true, title: "Error", message: res.data.message || "Failed to delete employee", type: "error" });
              return;
            }
            refreshData("employees");
            setShowAddModal(false);
            setIsEditing(false);
            setSelectedEmployee(null);
          })
          .catch((error) => {
            console.error("Failed to delete employee:", error);
            const errorMessage = error.response?.data?.message || error.message || "Failed to delete employee.";
            setAlertState({ isOpen: true, title: "Error", message: errorMessage, type: "error" });
          });
      }
    });
  };

  const filtered = (Array.isArray(employees) ? employees : []).filter(emp => {
    let matchesSearch = true;
    if (search.trim()) {
      const searchWords = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
      matchesSearch = searchWords.every(word => 
        Object.values(emp).some(val => 
          val !== null && val !== undefined && String(val).toLowerCase().includes(word)
        )
      );
    }
    
    const matchesPosition = filters.position === "All" || emp.position === filters.position;
    const matchesDepartment = filters.department === "All" || emp.department === filters.department;
    const matchesLocation = filters.location === "All" || emp.location === filters.location;
    const matchesStatus = filters.status === "All" || (emp.status || "Active") === filters.status;
    const matchesMobile = !filters.mobile || (emp.mobile && emp.mobile.includes(filters.mobile));

    return matchesSearch && matchesPosition && matchesDepartment && matchesLocation && matchesStatus && matchesMobile;
  }).sort((a, b) => b.id - a.id);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="sticky top-[-16px] md:top-[-32px] z-30 bg-slate-50 pt-4 md:pt-8 pb-4 -mt-4 md:-mt-8 space-y-6">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Employees</h1>
            <p className="text-slate-500 mt-1">Manage your workforce and their assigned assets.</p>
          </div>
          {isAdmin && (
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <button 
                onClick={() => {
                  const params = new URLSearchParams();
                  if (filters.position !== "All") params.append("position", filters.position);
                  if (filters.department !== "All") params.append("department", filters.department);
                  if (filters.location !== "All") params.append("location", filters.location);
                  if (filters.status !== "All") params.append("status", filters.status);
                  downloadFile(`/api/export/employees?${params.toString()}`, 'employees_report.xlsx');
                }}
                className="bg-white text-slate-700 border border-slate-200 px-6 py-3 rounded-xl font-bold shadow-sm hover:bg-slate-50 transition-all duration-300 flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <Download className="w-5 h-5" />
                Export to Excel
              </button>
              <button 
                onClick={() => setShowAddModal(true)}
                className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all duration-300 flex items-center justify-center gap-2 w-full md:w-auto"
              >
                <UserPlus className="w-5 h-5" />
                Add Employee
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
                  placeholder="Search by name or email..." 
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
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-slate-200 animate-in slide-in-from-top-2">
                <SearchableSelect
                  className="w-full"
                  value={filters.position}
                  options={[
                    { label: "All Positions", value: "All" },
                    ...(Array.isArray(positions) ? positions : []).map(p => ({ label: p.name, value: p.name }))
                  ]}
                  onChange={(val) => setFilters({...filters, position: val})}
                  placeholder="All Positions"
                />
                <SearchableSelect
                  className="w-full"
                  value={filters.department}
                  options={[
                    { label: "All Departments", value: "All" },
                    ...(Array.isArray(departments) ? departments : []).map(d => ({ label: d.name, value: d.name }))
                  ]}
                  onChange={(val) => setFilters({...filters, department: val})}
                  placeholder="All Departments"
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
                <SearchableSelect
                  className="w-full"
                  value={filters.status}
                  options={[
                    { label: "All Status", value: "All" },
                    { label: "Active", value: "Active" },
                    { label: "Resign", value: "Resign" },
                    { label: "Terminate", value: "Terminate" },
                    { label: "Runaway", value: "Runaway" },
                    { label: "Cancel", value: "Cancel" },
                    { label: "Final Exit", value: "Final Exit" }
                  ]}
                  onChange={(val) => setFilters({...filters, status: val})}
                  placeholder="All Status"
                />
                <input 
                  type="text"
                  placeholder="Filter by Mobile"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white shadow-sm"
                  value={filters.mobile}
                  onChange={(e) => setFilters({...filters, mobile: e.target.value})}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-20 bg-white shadow-sm">
              <tr className="bg-slate-50/80 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                <th className="px-6 py-4">SN</th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Position</th>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4">Mobile</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Reporting Manager</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((emp) => (
                <tr key={emp.id} className="hover:bg-emerald-50/50 transition-colors group">
                  <td className="px-6 py-4 font-mono text-sm text-slate-500">{emp.sn}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">{emp.name}</span>
                      <span className="text-xs text-slate-400">{emp.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-medium">{emp.position}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{emp.department || "-"}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{emp.mobile || "-"}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{emp.location}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{emp.reporting_manager || "-"}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      (emp.status || "Active") === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                    )}>
                      {emp.status || "Active"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Link to={`/employees/${emp.id}`} className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all">
                        <Eye className="w-4 h-4" />
                      </Link>
                      {isAdmin && (
                        <>
                          <button 
                            onClick={() => {
                              setSelectedEmployee(emp);
                              setIsEditing(true);
                              setNewEmployee({
                                sn: emp.sn || "",
                                name: emp.name || "",
                                email: emp.email || "",
                                position: emp.position || "",
                                department: emp.department || "",
                                mobile: emp.mobile || "",
                                location: emp.location || "",
                                location_id: emp.location_id || (emp.location ? (locations.find((l:any) => l.name.trim().toLowerCase() === emp.location.trim().toLowerCase())?.id) : ""),
                                status: emp.status || "Active",
                                notes: emp.notes || "",
                                reporting_manager: emp.reporting_manager || "",
                                company_name: emp.company_name || ""
                              });
                              setShowAddModal(true);
                            }}
                            className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {isSystemAdmin && (
                            <button 
                              onClick={() => handleDelete(emp.id)}
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
                    No employees found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold text-slate-900">{isEditing ? "Edit Employee" : "Add New Employee"}</h2>
              <button onClick={() => { setShowAddModal(false); setIsEditing(false); setSelectedEmployee(null); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Full Name</label>
                  <input 
                    required 
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    value={newEmployee.name}
                    onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Email Address</label>
                  <input 
                    required 
                    type="email" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee({...newEmployee, email: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Position</label>
                  <SearchableSelect
                    required
                    options={(Array.isArray(positions) ? positions : []).map(p => ({ label: p.name, value: p.name }))}
                    value={newEmployee.position}
                    onChange={(val) => setNewEmployee({...newEmployee, position: val})}
                    placeholder="Select Position"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Department</label>
                  <SearchableSelect
                    options={(Array.isArray(departments) ? departments : []).map(d => ({ label: d.name, value: d.name }))}
                    value={newEmployee.department}
                    onChange={(val) => setNewEmployee({...newEmployee, department: val})}
                    placeholder="Select Department"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Mobile Number</label>
                  <input 
                    required 
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    value={newEmployee.mobile}
                    onChange={(e) => setNewEmployee({...newEmployee, mobile: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Location</label>
                  <SearchableSelect
                    required
                    options={(Array.isArray(locations) ? locations : []).map(l => ({ label: l.name, value: l.id }))}
                    value={newEmployee.location_id || ""}
                    onChange={(val) => {
                      const id = parseInt(val);
                      const loc = locations.find((l:any) => l.id === id);
                      setNewEmployee({...newEmployee, location_id: id, location: loc?.name || ""});
                    }}
                    placeholder="Select Location"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Status</label>
                  <SearchableSelect
                    required
                    options={[
                      { label: "Active", value: "Active" },
                      { label: "Resign", value: "Resign" },
                      { label: "Terminate", value: "Terminate" },
                      { label: "Runaway", value: "Runaway" },
                      { label: "Cancel", value: "Cancel" },
                      { label: "Final Exit", value: "Final Exit" }
                    ]}
                    value={newEmployee.status}
                    onChange={(val) => setNewEmployee({...newEmployee, status: val})}
                    placeholder="Select Status"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Reporting Manager</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    value={newEmployee.reporting_manager || ""}
                    onChange={(e) => setNewEmployee({...newEmployee, reporting_manager: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Company Name</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    value={newEmployee.company_name || ""}
                    onChange={(e) => setNewEmployee({...newEmployee, company_name: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Notes</label>
                <textarea 
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  rows={3}
                  value={newEmployee.notes || ""}
                  onChange={(e) => setNewEmployee({...newEmployee, notes: e.target.value})}
                />
              </div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4 border-t border-slate-100">
                {isEditing && isSystemAdmin && (
                  <button 
                    type="button" 
                    onClick={() => handleDelete(selectedEmployee.id)}
                    className="flex items-center justify-center w-full sm:w-auto gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-all font-bold"
                  >
                    <Trash2 className="w-5 h-5" />
                    Delete Employee
                  </button>
                )}
                <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto ml-auto">
                  <button 
                    type="button" 
                    onClick={() => setShowAddModal(false)}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all"
                  >
                    Save Employee
                  </button>
                </div>
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
