import React, { useState } from "react";
import { Lock, User, ArrowRight, AlertCircle, Smartphone, ShieldCheck, ArrowLeft } from "lucide-react";
import { HashLoader } from "react-spinners";
import axios from "axios";
import toast from "react-hot-toast";
import logo from "../assets/logo.png";

export default function Login({ onLogin }: { onLogin: (user: any, token: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  
  // MFA Login Challenge state
  const [mfaRequired, setMfaRequired] = useState(false);
  const [tempUserId, setTempUserId] = useState<number | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    
    setError("");
    setLoading(true);

    const loginPromise = (async () => {
      try {
        const res = await axios.post("/api/login", { username, password }, { timeout: 10000 });
        if (res.data.success) {
          if (res.data.mfaRequired) {
            setMfaRequired(true);
            setTempUserId(res.data.tempUserId);
            return { mfaRequired: true };
          } else {
            onLogin(res.data.user, res.data.token);
            return res.data;
          }
        } else {
          throw new Error(res.data.message || "Login failed.");
        }
      } catch (err: any) {
        let errorMessage = "An unexpected error occurred.";
        if (err.code === 'ECONNABORTED') {
          errorMessage = "Request timed out. The server is not responding.";
        } else if (err.response) {
          if (typeof err.response.data === 'string' && err.response.data.includes('<!doctype html>')) {
            errorMessage = "Server returned HTML instead of JSON.";
          } else {
            errorMessage = err.response.data?.message || `Server error: ${err.response.status}`;
          }
        } else if (err.request) {
          errorMessage = "No response from server. Check your internet connection.";
        } else {
          errorMessage = err.message || errorMessage;
        }
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    })();

    toast.promise(loginPromise, {
      loading: 'Signing in...',
      success: (data) => data.mfaRequired ? 'Please enter your 2FA verification code' : 'Welcome back!',
      error: (err) => err.message
    });

    try {
      await loginPromise;
    } catch (err) {
      // Error handled by toast and state
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaCode.trim() || !tempUserId) return;

    setError("");
    setLoading(true);

    const mfaPromise = (async () => {
      try {
        const res = await axios.post("/api/mfa/verify-login", {
          tempUserId,
          code: mfaCode.trim(),
          trustDevice
        }, { timeout: 10000 });

        if (res.data.success) {
          onLogin(res.data.user, res.data.token);
          return res.data;
        } else {
          throw new Error(res.data.message || "Failed to verify 2FA code.");
        }
      } catch (err: any) {
        let errorMessage = err.response?.data?.message || err.message || "Invalid 2FA verification code.";
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    })();

    toast.promise(mfaPromise, {
      loading: 'Verifying 2FA authorization...',
      success: 'Code verified successfully! Signing in...',
      error: (err) => err.message
    });

    try {
      await mfaPromise;
    } catch {
      // Handled
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setMfaRequired(false);
    setTempUserId(null);
    setMfaCode("");
    setError("");
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans text-white">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex mb-2">
            <img 
              src={logo} 
              alt="Homes Contracting Company Logo" 
              className="object-contain drop-shadow-[0_4px_12px_rgba(255,255,255,0.08)]" 
              style={{ width: '40mm', height: '45mm' }} 
            />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mt-2">Homes Contracting Company</h1>
          <p className="text-slate-400 mt-1 uppercase text-xs font-semibold tracking-widest">Assets Management System</p>
        </div>

        <div className="bg-slate-900 p-8 sm:p-10 rounded-3xl shadow-2xl border border-slate-800">
          
          {!mfaRequired ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-400 transition-colors">
                    <User className="w-5 h-5" />
                  </div>
                  <input
                    required
                    type="text"
                    placeholder="Username or Email"
                    className="w-full pl-12 pr-6 py-3.5 rounded-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-white placeholder:text-slate-500"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>

                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-400 transition-colors">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    required
                    type="password"
                    placeholder="Password"
                    className="w-full pl-12 pr-6 py-3.5 rounded-full bg-slate-950 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all text-white placeholder:text-slate-500"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-950/40 border border-red-900/50 px-6 py-4 rounded-3xl flex items-center gap-3 text-red-200 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              <button
                disabled={loading}
                type="submit"
                className="w-full bg-blue-600 text-white py-4 rounded-full font-bold text-lg shadow-lg shadow-blue-900/30 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group cursor-pointer"
              >
                {loading ? (
                  <HashLoader color="#ffffff" size={20} />
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform text-white" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleMfaSubmit} className="space-y-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-blue-950/50 rounded-full flex items-center justify-center mx-auto text-blue-400 border border-blue-900/30">
                  <Smartphone className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="text-xl font-bold text-white">2-Factor Security Verification</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                  To keep system credentials safe, please provide the 6-digit verification code from your Microsoft Authenticator or Google Authenticator app.
                </p>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <input
                    required
                    type="text"
                    maxLength={6}
                    pattern="\d*"
                    placeholder="000 000"
                    className="w-full text-center py-3.5 bg-slate-950 border border-slate-800 rounded-full text-2xl font-mono font-extrabold tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-white transition-all placeholder:text-slate-700 placeholder:font-sans placeholder:tracking-normal placeholder:text-base placeholder:font-normal"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2.5 px-3 py-1">
                <input
                  id="trustDevice"
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-800 bg-slate-950 text-blue-600 focus:ring-blue-500/30 focus:ring-2 cursor-pointer"
                  checked={trustDevice}
                  onChange={(e) => setTrustDevice(e.target.checked)}
                />
                <label 
                  htmlFor="trustDevice" 
                  className="text-xs font-semibold text-slate-400 select-none cursor-pointer hover:text-white transition-colors"
                >
                  Trust this device for 30 days
                </label>
              </div>

              {error && (
                <div className="bg-red-950/40 border border-red-900/50 px-6 py-4 rounded-3xl flex items-center gap-3 text-red-200 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="flex-1 py-3.5 bg-slate-950 border border-slate-800 text-slate-300 font-bold rounded-full text-sm transition-all flex items-center justify-center gap-1.5 hover:bg-slate-800 hover:text-white cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  disabled={loading || mfaCode.length < 6}
                  type="submit"
                  className="flex-[2] bg-blue-600 text-white py-3.5 rounded-full font-bold text-sm shadow-md hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  {loading ? (
                    <HashLoader color="#ffffff" size={16} />
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-white" />
                      Verify Action
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-slate-800/80 text-center">
            <p className="text-slate-500 text-xs">
              Access restricted to authorized personnel
            </p>
          </div>
        </div>

        <p className="text-center mt-8 text-slate-600 text-xs">
          © 2026 Asset Manager 2.0
        </p>
      </div>
    </div>
  );
}
