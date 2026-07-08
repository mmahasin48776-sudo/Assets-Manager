import React, { useState, useEffect } from "react";
import { User, Mail, Briefcase, Shield, Lock, X, Save, RefreshCw, Eye, EyeOff, ShieldCheck, Smartphone, Copy, Check, ShieldAlert } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";
import { QRCodeSVG } from "qrcode.react";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onUserUpdated: (updatedUser: any) => void;
}

export default function UserProfileModal({ isOpen, onClose, currentUser, onUserUpdated }: UserProfileModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    position: "",
    email: "",
    password: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // MFA State
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; qrCodeUrl: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [isConfiguringMfa, setIsConfiguringMfa] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setFormData({
        name: currentUser.name || "",
        position: currentUser.position || "",
        email: currentUser.email || currentUser.username || "",
        password: "" // Clear password field by default
      });
      // Reset MFA setup flows on load
      setMfaSetup(null);
      setMfaCode("");
      setIsConfiguringMfa(false);
      setCopiedSecret(false);
    }
  }, [currentUser, isOpen]);

  if (!isOpen || !currentUser) return null;

  const handleStartMfaSetup = async () => {
    setMfaLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.post("/api/mfa/setup", {}, { headers });
      if (res.data.success) {
        setMfaSetup(res.data);
        setIsConfiguringMfa(true);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to start 2FA configuration.");
    } finally {
      setMfaLoading(false);
    }
  };

  const handleEnableMfa = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!mfaCode.trim() || mfaCode.trim().length !== 6) {
      toast.error("Please enter a valid 6-digit verification code.");
      return;
    }
    if (!mfaSetup) return;

    setMfaLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.post("/api/mfa/enable", {
        secret: mfaSetup.secret,
        code: mfaCode.trim()
      }, { headers });

      if (res.data.success) {
        toast.success("Two-Factor Authentication is now active!");
        onUserUpdated(res.data.user);
        setIsConfiguringMfa(false);
        setMfaSetup(null);
        setMfaCode("");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Invalid 2FA verification code.");
    } finally {
      setMfaLoading(false);
    }
  };

  const handleDisableMfa = async () => {
    if (!window.confirm("WARNING: Disabling Two-Factor Authentication leaves your account with single-password security. Are you sure you want to disable 2FA?")) {
      return;
    }

    setMfaLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.post("/api/mfa/disable", {}, { headers });
      if (res.data.success) {
        toast.success("2FA has been disabled successfully.");
        onUserUpdated(res.data.user);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Failed to disable 2FA.");
    } finally {
      setMfaLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!mfaSetup) return;
    navigator.clipboard.writeText(mfaSetup.secret);
    setCopiedSecret(true);
    toast.success("MFA Setup Key copied!");
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.position.trim()) {
      toast.error("Please fill out all required fields.");
      return;
    }

    setLoading(true);
    const savePromise = (async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };
        
        // Call the updated PUT endpoint we created
        const res = await axios.put(`/api/users/${currentUser.id}`, {
          name: formData.name,
          position: formData.position,
          email: formData.email,
          password: formData.password || undefined // Only submit password if provided
        }, { headers });

        if (res.data.success) {
          // Fallback properties just in case
          const updatedUserObj = {
            ...currentUser,
            ...res.data.user,
            username: formData.email.toLowerCase(), // sync username with email for seamless session resume
          };
          onUserUpdated(updatedUserObj);
          onClose();
          return res.data;
        } else {
          throw new Error(res.data.message || "Failed to update profile.");
        }
      } catch (err: any) {
        throw new Error(err.response?.data?.message || err.message || "Update profile failed.");
      }
    })();

    toast.promise(savePromise, {
      loading: "Saving updates...",
      success: "Profile updated successfully!",
      error: (err) => err.message
    });

    try {
      await savePromise;
    } catch {
      // Handled by toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" id="user-profile-modal">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-slate-100">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                Manage Your Profile
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">View and update your corporate credentials</p>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleUpdate}>
            {/* Form Fields */}
            <div className="p-6 space-y-4">
              
              {/* Access Role Tag (Read-only for security) */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-600 text-xs font-semibold">
                  <Shield className="w-4 h-4 text-slate-400" />
                  Security Authorization Level
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-100">
                  {currentUser.role?.replace("_", " ")}
                </span>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 font-sans"
                    placeholder="Enter full name"
                  />
                </div>
              </div>

              {/* Job Position */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Job Position <span className="text-[10px] text-slate-400 lowercase italic font-normal">(cannot be changed)</span>
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    disabled
                    readOnly
                    value={formData.position}
                    className="w-full pl-10 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-sans cursor-not-allowed select-none"
                    placeholder="No position specified"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Email Address <span className="text-[10px] text-slate-400 lowercase italic font-normal">(cannot be changed)</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    disabled
                    readOnly
                    value={formData.email}
                    className="w-full pl-10 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-sans cursor-not-allowed select-none"
                    placeholder="No email specified"
                  />
                </div>
              </div>

              {/* Change Password */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Change Password <span className="text-[10px] text-slate-400 lowercase italic font-normal">(leave blank to keep current)</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-10 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 font-sans"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Two-Factor Authentication (2FA) Setup */}
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-slate-500" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Two-Factor Authentication</span>
                  </div>
                  {currentUser.mfa_enabled ? (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-slate-100 text-slate-500 border border-slate-200">
                      Inactive
                    </span>
                  )}
                </div>

                {currentUser.mfa_enabled ? (
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 space-y-3">
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      Your identity is secured with multi-factor timed tokens (TOTP). You will be requested to provide a 6-digit verification code from Microsoft Authenticator or Google Authenticator during your next login.
                    </p>
                    <button
                      type="button"
                      disabled={mfaLoading}
                      onClick={handleDisableMfa}
                      className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200/60 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <ShieldAlert className="w-4 h-4" />
                      Disable Two-Factor Authentication
                    </button>
                  </div>
                ) : !isConfiguringMfa ? (
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3">
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Add an extra layer of defense. Authenticate logins using timed verification codes generated on standard security apps.
                    </p>
                    <button
                      type="button"
                      disabled={mfaLoading}
                      onClick={handleStartMfaSetup}
                      className="w-full py-2 bg-white hover:bg-slate-50 text-blue-600 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                      {mfaLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      Setup Authenticator Security
                    </button>
                  </div>
                ) : (
                  <div className="bg-blue-50/30 border border-blue-100 rounded-xl p-4 space-y-4">
                    <div className="text-center space-y-2">
                      <div className="text-xs font-bold text-slate-700">1. Scan QR Code in Authenticator App</div>
                      <p className="text-[11px] text-slate-500 leading-normal max-w-xs mx-auto">
                        Open Microsoft Authenticator, Google Authenticator, or standard TOTP app. Select &quot;Add Account&quot; and scan the code below.
                      </p>
                      
                      {mfaSetup && (
                        <div className="inline-flex flex-col items-center p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                          <QRCodeSVG 
                            value={mfaSetup.qrCodeUrl} 
                            size={135} 
                            level="M"
                            includeMargin={true}
                          />
                        </div>
                      )}

                      <div className="text-[11px] text-slate-400">Can't scan the QR? Enter key manually:</div>
                      {mfaSetup && (
                        <div className="flex items-center justify-between gap-1 max-w-[240px] mx-auto bg-white border border-slate-200 rounded-lg p-1.5">
                          <span className="font-mono text-xs font-bold text-slate-700 select-all tracking-wider px-1">
                            {mfaSetup.secret}
                          </span>
                          <button
                            type="button"
                            onClick={copyToClipboard}
                            className="p-1 hover:bg-slate-50 rounded text-slate-500 transition-colors"
                            title="Copy setup Key"
                          >
                            {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-100/80 pt-3 text-center space-y-2">
                      <div className="text-xs font-bold text-slate-700">2. Verify &amp; Finish Setup</div>
                      <p className="text-[11px] text-slate-500">
                        Enter the 6-digit timed verification code shown in your authenticator app.
                      </p>
                      
                      <div className="max-w-[160px] mx-auto relative">
                        <input
                          type="text"
                          maxLength={6}
                          pattern="\d*"
                          placeholder="000 000"
                          value={mfaCode}
                          onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                          className="w-full text-center py-2 bg-white border border-slate-200 rounded-lg text-lg font-mono font-extrabold tracking-[0.25em] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 transition-all"
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsConfiguringMfa(false);
                            setMfaSetup(null);
                            setMfaCode("");
                          }}
                          className="flex-1 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-xs font-bold rounded-lg transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleEnableMfa}
                          disabled={mfaLoading}
                          className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-md shadow-blue-500/10 flex items-center justify-center gap-1 transition-all"
                        >
                          {mfaLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                          Verify Code
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Actions */}
            <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex gap-3 justify-end rounded-b-2xl">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-100 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/10 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Details
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
