import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "motion/react";
import { UserPlus, ShieldCheck, Lock, User, Shield, ArrowRight, CheckCircle2, Key, MapPin, Plus, Trash2, Edit2, X, Save, Mail, Briefcase, ShieldOff } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import ConfirmModal from "../components/ConfirmModal";

export default function Registration() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Secret Verification, 2: Registration Form
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [projectKeys, setProjectKeys] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [editingKeyId, setEditingKeyId] = useState<number | null>(null);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<number | null>(null);
  const [confirmMfaResetUserId, setConfirmMfaResetUserId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"users" | "keys">("users");
  
  const [formData, setFormData] = useState({
    name: "",
    position: "",
    email: "",
    password: "",
    role: "user"
  });

  const [projectData, setProjectData] = useState({
    location_id: "",
    secret_key: ""
  });

  useEffect(() => {
    // Check if we already have a verified secret in this session
    const savedSecret = localStorage.getItem("admin_secret");
    if (savedSecret) {
      // We could verify it with the server again, or just trust it for now
      // Let's verify it silently to be safe
      const verifySaved = async () => {
        try {
          const res = await axios.post("/api/verify-secret", { secret: savedSecret }, getHeaders());
          if (res.data.success) {
            setSecret(savedSecret);
            setStep(2);
          } else {
            localStorage.removeItem("admin_secret");
          }
        } catch (error) {
          localStorage.removeItem("admin_secret");
        }
      };
      verifySaved();
    }
  }, []);

  useEffect(() => {
    if (step === 2) {
      fetchLocations();
      fetchProjectKeys();
      fetchUsers();
    }
  }, [step]);

  const getHeaders = () => {
    const token = localStorage.getItem("token");
    return { headers: { Authorization: `Bearer ${token}` } };
  };

  const fetchLocations = async () => {
    try {
      const res = await axios.get("/api/project-locations", getHeaders());
      setLocations(res.data);
    } catch (error) {
      console.error("Failed to fetch locations", error);
    }
  };

  const fetchProjectKeys = async () => {
    try {
      const res = await axios.get("/api/project-secret-keys", getHeaders());
      setProjectKeys(res.data);
    } catch (error) {
      console.error("Failed to fetch project keys", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get("/api/users", getHeaders());
      setUsers(res.data);
    } catch (error) {
      console.error("Failed to fetch users", error);
    }
  };

  const handleVerifySecret = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const verifyPromise = axios.post("/api/verify-secret", { secret }, getHeaders()).then((res) => {
      if (res.data.success) {
        localStorage.setItem("admin_secret", secret);
        setStep(2);
        return res.data;
      } else {
        throw new Error(res.data.message || "Invalid secret key");
      }
    });

    toast.promise(verifyPromise, {
      loading: 'Verifying identity...',
      success: 'Identity verified',
      error: (err) => err.response?.data?.message || err.message || 'Verification failed'
    }).catch(() => {
      // Ignore unhandled promise rejection
    }).finally(() => {
      setLoading(false);
    });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingUserId) {
        const res = await axios.put(`/api/users/${editingUserId}`, formData, getHeaders());
        if (res.data.success) {
          toast.success("User updated successfully");
          setFormData({ name: "", position: "", email: "", password: "", role: "user" });
          setEditingUserId(null);
          fetchUsers();
        }
      } else {
        const res = await axios.post("/api/register-user", formData, getHeaders());
        if (res.data.success) {
          toast.success(res.data.message || "User registered successfully");
          setFormData({ name: "", position: "", email: "", password: "", role: "user" });
          fetchUsers();
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || (editingUserId ? "Failed to update user" : "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user: any) => {
    setEditingUserId(user.id);
    setFormData({
      name: user.name || "",
      position: user.position || "",
      email: user.email || user.username || "",
      password: "", // Leave blank to keep existing password
      role: user.role || "user"
    });
    // Scroll to top or specific container
    window.scrollTo({ top: 100, behavior: 'smooth' });
  };

  const cancelEditUser = () => {
    setEditingUserId(null);
    setFormData({ name: "", position: "", email: "", password: "", role: "user" });
  };

  const handleResetMfa = async (userId: number) => {
    setLoading(true);
    try {
      const res = await axios.put(`/api/users/${userId}`, { mfa_enabled: false }, getHeaders());
      if (res.data.success) {
        toast.success("Authenticator (MFA) disabled for this user.");
        fetchUsers();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to disable Authenticator");
    } finally {
      setLoading(false);
      setConfirmMfaResetUserId(null);
    }
  };

  const handleAddProjectKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectData.location_id || !projectData.secret_key) {
      toast.error("Please fill all fields");
      return;
    }
    setLoading(true);
    try {
      if (editingKeyId) {
        await axios.put(`/api/project-secret-keys/${editingKeyId}`, projectData, getHeaders());
        toast.success("Project secret key updated");
        setEditingKeyId(null);
      } else {
        await axios.post("/api/project-secret-keys", projectData, getHeaders());
        toast.success("Project secret key added");
      }
      setProjectData({ location_id: "", secret_key: "" });
      fetchProjectKeys();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to save project key");
    } finally {
      setLoading(false);
    }
  };

  const handleEditKey = (key: any) => {
    setEditingKeyId(key.id);
    setProjectData({
      location_id: key.location_id.toString(),
      secret_key: key.secret_key
    });
    // Scroll to form
    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  const handleDeleteKey = async () => {
    if (!confirmDeleteId) return;
    try {
      await axios.delete(`/api/project-secret-keys/${confirmDeleteId}`, getHeaders());
      toast.success("Key deleted");
      fetchProjectKeys();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to delete key");
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!confirmDeleteUserId) return;
    try {
      await axios.delete(`/api/users/${confirmDeleteUserId}`, getHeaders());
      toast.success("User deleted");
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to delete user");
    } finally {
      setConfirmDeleteUserId(null);
    }
  };

  const cancelEdit = () => {
    setEditingKeyId(null);
    setProjectData({ location_id: "", secret_key: "" });
  };

  return (
    <div className="max-w-2xl mx-auto py-6 sm:py-12 px-4 sm:px-6">
      <div className="mb-8 text-center px-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center justify-center gap-3">
          <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
          System Administration
        </h1>
        <p className="text-sm sm:text-base text-slate-500 mt-2">Manage accounts and project security</p>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.div
            key="verify"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white p-5 sm:p-8 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200"
          >
            <div className="flex items-center gap-3 mb-6 p-4 bg-amber-50 text-amber-700 rounded-xl border border-amber-100 text-sm">
              <ShieldCheck className="w-5 h-5 shrink-0" />
              <p>Please enter the administrator secret registration key to continue.</p>
            </div>

            <form onSubmit={handleVerifySecret} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Secret Key</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify Identity"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="management"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Tab Switcher */}
            <div className="flex p-1 bg-slate-100 rounded-xl sm:rounded-2xl border border-slate-200">
              <button
                onClick={() => setActiveTab("users")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3 text-sm font-bold rounded-lg sm:rounded-xl transition-all ${
                  activeTab === "users" 
                    ? "bg-white text-blue-600 shadow-sm" 
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                <User className="w-4 h-4" />
                User Accounts
              </button>
              <button
                onClick={() => setActiveTab("keys")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3 text-sm font-bold rounded-lg sm:rounded-xl transition-all ${
                  activeTab === "keys" 
                    ? "bg-white text-blue-600 shadow-sm" 
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Key className="w-4 h-4" />
                Project Access
              </button>
            </div>

            <div className="bg-white p-5 sm:p-8 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200">
              {activeTab === "users" ? (
                <div key="users-tab" className="space-y-6">
                  <div className="flex items-start sm:items-center gap-3 p-3 sm:p-4 bg-emerald-50 text-emerald-700 rounded-lg sm:rounded-xl border border-emerald-100 text-xs sm:text-sm">
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 mt-0.5 sm:mt-0" />
                    <p>Register new system accounts. Regular users can manage assets, while admins have full system control.</p>
                  </div>

                  <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-sans text-slate-900"
                          placeholder="John Doe"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Job Position</label>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={formData.position}
                          onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-sans text-slate-900"
                          placeholder="Project Manager"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-sans text-slate-900"
                          placeholder="john.doe@example.com"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-sans text-slate-900"
                          placeholder={editingUserId ? "•••••••• (Leave blank to keep same)" : "••••••••"}
                          required={!editingUserId}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Access Role</label>
                      <div className="relative">
                        <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select
                          value={formData.role}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none font-sans text-slate-900"
                        >
                          <option value="user">Regular User</option>
                          <option value="admin">Administrator</option>
                          <option value="system_admin">System Administrator</option>
                        </select>
                      </div>
                    </div>

                    {editingUserId && users.find(u => u.id === editingUserId)?.mfa_enabled && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-3 text-xs text-amber-800">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div>
                            <p className="font-semibold text-slate-800">Authenticator (2FA) is Active</p>
                            <p className="text-[11px] text-slate-500">MFA is currently configured and enforced for this user.</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setConfirmMfaResetUserId(editingUserId)}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-colors text-xs flex items-center gap-1 shrink-0 shadow-sm"
                        >
                          <ShieldOff className="w-3.5 h-3.5" />
                          Reset
                        </button>
                      </div>
                    )}

                    <div className="flex gap-3">
                      {editingUserId && (
                        <button
                          type="button"
                          onClick={cancelEditUser}
                          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={loading}
                        className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 text-white rounded-xl font-bold transition-all disabled:opacity-50 shadow-lg ${editingUserId ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'}`}
                      >
                        {loading ? (editingUserId ? "Updating..." : "Creating...") : (editingUserId ? "Save Changes" : "Create User Account")}
                        {editingUserId ? <Save className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                      </button>
                    </div>
                  </form>

                  <div className="pt-8 border-t border-slate-100">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 font-sans">Current Registered Users</h3>
                    <div className="overflow-x-auto -mx-5 sm:mx-0 px-5 sm:px-0">
                      <table className="w-full text-left border-collapse min-w-[300px]">
                        <thead>
                          <tr className="border-b border-slate-100 text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">
                            <th className="pb-2">User Details</th>
                            <th className="pb-2">Role</th>
                            <th className="pb-2">Authenticator</th>
                            <th className="pb-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {users.map((u) => (
                            <tr key={u.id} className="text-xs sm:text-sm">
                              <td className="py-3 pr-2">
                                <div className="font-semibold text-slate-800">{u.name || "None Specified"}</div>
                                <div className="text-[11px] text-slate-400 flex flex-wrap gap-x-2 gap-y-0.5">
                                  <span>{u.position || "Staff"}</span>
                                  <span className="text-slate-200">•</span>
                                  <span className="font-mono">{u.email || u.username}</span>
                                </div>
                              </td>
                              <td className="py-3">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-tight ${
                                  u.role === 'system_admin' ? 'bg-red-50 text-red-600 border border-red-100' : 
                                  u.role === 'admin' ? 'bg-purple-50 text-purple-600 border border-purple-100' : 
                                  'bg-slate-50 text-slate-500 border border-slate-100'
                                }`}>
                                  {u.role ? u.role.replace('_', ' ') : 'user'}
                                </span>
                              </td>
                              <td className="py-3">
                                {u.mfa_enabled ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tight bg-emerald-50 text-emerald-600 border border-emerald-100">
                                    <ShieldCheck className="w-2.5 h-2.5" />
                                    Active
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tight bg-slate-50 text-slate-400 border border-slate-100">
                                    <ShieldOff className="w-2.5 h-2.5 text-slate-300" />
                                    Disabled
                                  </span>
                                )}
                              </td>
                              <td className="py-3 text-right">
                                <div className="flex justify-end items-center gap-1.5">
                                  {u.mfa_enabled && (
                                    <button
                                      onClick={() => setConfirmMfaResetUserId(u.id)}
                                      className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                      title="Disable Authenticator (MFA)"
                                    >
                                      <ShieldOff className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleEditUser(u)}
                                    className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                                    title="Edit User"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteUserId(u.id)}
                                    className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                    title="Delete User"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div key="keys-tab" className="space-y-6">
                  <div className="flex items-start sm:items-center gap-3 p-3 sm:p-4 bg-amber-50 text-amber-700 rounded-lg sm:rounded-xl border border-amber-100 text-xs sm:text-sm">
                    <Key className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 mt-0.5 sm:mt-0" />
                    <p>Assign access keys to project locations. Users will be prompted for this key before viewing specific project data.</p>
                  </div>

                  <form onSubmit={handleAddProjectKey} className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Select Project / Location</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select
                          value={projectData.location_id}
                          onChange={(e) => setProjectData({ ...projectData, location_id: e.target.value })}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                          required
                          disabled={!!editingKeyId}
                        >
                          <option value="">Select a location</option>
                          {locations.map(loc => (
                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Secret Access Key</label>
                      <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={projectData.secret_key}
                          onChange={(e) => setProjectData({ ...projectData, secret_key: e.target.value })}
                          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          placeholder="Enter project access key"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex gap-3">
                      {editingKeyId && (
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={loading}
                        className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 text-white rounded-xl font-bold transition-all disabled:opacity-50 shadow-lg ${editingKeyId ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' : 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/10'}`}
                      >
                        {loading ? (editingKeyId ? "Updating..." : "Adding...") : (editingKeyId ? "Save Changes" : "Assign Project Key")}
                        {editingKeyId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </button>
                    </div>
                  </form>

                  <div className="pt-8 border-t border-slate-100">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Secured Projects & Keys</h3>
                    <div className="overflow-x-auto -mx-5 sm:mx-0 px-5 sm:px-0">
                      <table className="w-full text-left border-collapse min-w-[400px]">
                        <thead>
                          <tr className="border-b border-slate-100 text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
                            <th className="pb-3 px-2">Project / Location</th>
                            <th className="pb-3 px-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {projectKeys.map((key) => (
                            <tr key={key.id} className="group hover:bg-slate-50/50 transition-colors">
                              <td className="py-4 px-2">
                                <div className="font-medium text-slate-900 text-sm sm:text-base">{key.location_name}</div>
                                <div className="text-[10px] sm:text-xs text-slate-400 font-mono mt-1">Key Assigned: ••••••••</div>
                              </td>
                              <td className="py-4 px-2 text-right">
                                <div className="flex justify-end items-center gap-1.5 sm:gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => handleEditKey(key)}
                                    className="p-2 text-slate-400 hover:text-blue-600 bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow transition-all"
                                    title="Edit Key"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteId(key.id)}
                                    className="p-2 text-slate-400 hover:text-red-600 bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow transition-all"
                                    title="Delete Key"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {projectKeys.length === 0 && (
                            <tr>
                              <td colSpan={2} className="py-8 text-center text-slate-400 text-sm">
                                No project keys assigned yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!confirmDeleteId}
        title="Delete Secret Key"
        message="Are you sure you want to delete this project secret key? This will prevent users from accessing the project until a new key is assigned."
        confirmText="Delete"
        onConfirm={handleDeleteKey}
        onCancel={() => setConfirmDeleteId(null)}
      />

      <ConfirmModal
        isOpen={!!confirmDeleteUserId}
        title="Delete User"
        message="Are you sure you want to delete this user? Their access will be immediately revoked."
        confirmText="Delete User"
        onConfirm={handleDeleteUser}
        onCancel={() => setConfirmDeleteUserId(null)}
      />

      <ConfirmModal
        isOpen={!!confirmMfaResetUserId}
        title="Disable Authenticator (MFA)"
        message="Are you sure you want to disable and reset Multi-Factor Authentication (Authenticator/MFA) for this user? They will be able to log in without MFA and configure a new Authenticator device on their next login if required."
        confirmText="Disable MFA"
        onConfirm={() => confirmMfaResetUserId && handleResetMfa(confirmMfaResetUserId)}
        onCancel={() => setConfirmMfaResetUserId(null)}
      />
    </div>
  );
}
