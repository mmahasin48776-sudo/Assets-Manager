import React, { useState, useEffect } from "react";
import { ShieldAlert, MapPin, Loader2, Compass, Lock, HelpCircle, RefreshCw } from "lucide-react";
import axios from "axios";

interface LocationVerificationBarrierProps {
  onVerified: () => void;
}

export default function LocationVerificationBarrier({ onVerified }: LocationVerificationBarrierProps) {
  const [status, setStatus] = useState<'prompting' | 'requesting' | 'verifying' | 'denied' | 'success'>('prompting');
  const [errorMessage, setErrorMessage] = useState("");
  const [ipData, setIpData] = useState<{ ip?: string; city?: string; country_name?: string } | null>(null);
  const [loadingIp, setLoadingIp] = useState(false);

  // Fetch IP details to show user where they are connecting from
  useEffect(() => {
    const fetchIpInfo = async () => {
      setLoadingIp(true);
      try {
        const res = await fetch("https://ipapi.co/json/");
        if (res.ok) {
          const data = await res.json();
          if (data && data.ip) {
            setIpData(data);
            setLoadingIp(false);
            return;
          }
        }
      } catch (err) {
        console.warn("Failed to fetch public IP from ipapi.co, trying ipinfo.io:", err);
      }

      // Fallback IP details lookup
      try {
        const res = await fetch("https://ipinfo.io/json");
        if (res.ok) {
          const data = await res.json();
          setIpData({
            ip: data.ip,
            city: data.city,
            country_name: data.country || data.region
          });
        }
      } catch (err) {
        console.warn("Failed to fetch public IP from ipinfo.io:", err);
      } finally {
        setLoadingIp(false);
      }
    };
    fetchIpInfo();
  }, []);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setStatus('denied');
      setErrorMessage("Your browser does not support Geolocation services.");
      return;
    }

    setStatus('requesting');
    setErrorMessage("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setStatus('verifying');
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        let detectedCity = ipData?.city || "";
        let detectedCountry = ipData?.country_name || "";

        // Try reverse geocoding to get the exact real city/country from the GPS coordinates
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500);
          const reverseRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'HomesContractingAssetManager/1.0'
            }
          });
          clearTimeout(timeoutId);
          if (reverseRes.ok) {
            const reverseData = await reverseRes.json();
            const address = reverseData.address || {};
            detectedCity = address.city || address.town || address.village || address.suburb || address.county || detectedCity;
            detectedCountry = address.country || detectedCountry;
          }
        } catch (revErr) {
          console.warn("Reverse geocoding failed, falling back to IP details:", revErr);
        }

        try {
          const logId = localStorage.getItem("current_login_log_id");
          if (logId) {
            // Update the login log with the exact geolocation coordinates
            await axios.post("/api/login-logs/update-location", {
              logId,
              latitude: lat,
              longitude: lon,
              city: detectedCity,
              country: detectedCountry
            });
          }

          // Persist the device authorization state
          localStorage.setItem("device_location_allowed", "true");
          setStatus('success');
          setTimeout(() => {
            onVerified();
          }, 1200);
        } catch (err: any) {
          console.error("Failed to update login location:", err);
          // Still proceed because they granted permission, but warn
          localStorage.setItem("device_location_allowed", "true");
          setStatus('success');
          setTimeout(() => {
            onVerified();
          }, 1200);
        }
      },
      (error) => {
        setStatus('denied');
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setErrorMessage("Location access was denied. You must allow location permission in your browser to access the Homes IT Asset Management system.");
            break;
          case error.POSITION_UNAVAILABLE:
            setErrorMessage("Location information is unavailable on this device.");
            break;
          case error.TIMEOUT:
            setErrorMessage("The request to get your device location timed out. Please try again.");
            break;
          default:
            setErrorMessage("An unknown error occurred while requesting location permissions.");
            break;
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900 flex items-center justify-center p-4 overflow-y-auto font-sans text-white selection:bg-emerald-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-black opacity-80" />
      
      <div className="relative w-full max-w-lg bg-slate-800/80 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl p-6 md:p-8 overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />

        <div className="flex flex-col items-center text-center">
          {/* Main Icon Indicator */}
          <div className="mb-6 relative">
            {status === 'prompting' && (
              <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 animate-pulse">
                <Compass className="w-8 h-8" />
              </div>
            )}
            {status === 'requesting' && (
              <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            )}
            {status === 'verifying' && (
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            )}
            {status === 'denied' && (
              <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <ShieldAlert className="w-8 h-8" />
              </div>
            )}
            {status === 'success' && (
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
                <MapPin className="w-8 h-8 animate-bounce" />
              </div>
            )}
          </div>

          {/* Heading */}
          <h1 className="text-xl md:text-2xl font-bold tracking-tight mb-2">
            {status === 'prompting' && "Security Clearance Required"}
            {status === 'requesting' && "Requesting Location Permission..."}
            {status === 'verifying' && "Verifying Device Location..."}
            {status === 'denied' && "Access Denied: Location Required"}
            {status === 'success' && "Device Verified Successfully"}
          </h1>

          <p className="text-sm text-slate-400 leading-relaxed max-w-sm mb-6">
            {status === 'prompting' && "Homes Contracting Company requires real-time device location verification to safeguard secure enterprise IT asset records and detect rogue sessions."}
            {status === 'requesting' && "Please respond to the browser's location prompt. Choose 'Allow' or 'Share Location' to authorize this device."}
            {status === 'verifying' && "Securing transmission connection and binding Geolocation coordinates to your active login log."}
            {status === 'denied' && "This system is protected. You cannot proceed or access any module until location tracking is allowed for security audit logs."}
            {status === 'success' && "Your device coordinates have been securely registered to your login session audit history. Loading portal..."}
          </p>

          {/* Info Panel: IP & Estimated Connection Details */}
          <div className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl p-4 text-left mb-6 text-xs font-mono space-y-2">
            <div className="flex justify-between items-center pb-1.5 border-b border-slate-800">
              <span className="text-slate-400 font-sans font-medium">Session IP Address</span>
              <span className="text-emerald-400 font-bold">{loadingIp ? "Fetching..." : (ipData?.ip || "Detected")}</span>
            </div>
            <div className="flex justify-between items-center pb-1.5 border-b border-slate-800">
              <span className="text-slate-400 font-sans font-medium">Approx. Region</span>
              <span className="text-slate-200">
                {loadingIp ? "..." : (ipData?.city && ipData?.country_name ? `${ipData.city}, ${ipData.country_name}` : "Unknown Connection")}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-sans font-medium">Device Profile</span>
              <span className="text-slate-200 truncate max-w-[200px]" title={navigator.userAgent}>
                {navigator.userAgent.includes("Chrome") ? "Google Chrome" : navigator.userAgent.includes("Safari") ? "Apple Safari" : "Web Browser"}
              </span>
            </div>
          </div>

          {/* Warning / Instruction Alert */}
          {status === 'denied' && (
            <div className="w-full bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl p-3 text-left mb-6 text-xs flex gap-3 leading-relaxed">
              <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">How to enable location permission:</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Click the **Lock/Info icon** 🔒 on the left side of your browser's address bar.</li>
                  <li>Find **Location** and switch the setting to **Allow**.</li>
                  <li>Click the button below to retry connection verification.</li>
                </ol>
                {errorMessage && <p className="mt-2 text-[11px] text-rose-400 italic">Error details: {errorMessage}</p>}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="w-full space-y-2">
            {status === 'prompting' && (
              <button
                onClick={requestLocation}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
              >
                <MapPin className="w-4 h-4" />
                Allow & Authorize Device
              </button>
            )}

            {status === 'denied' && (
              <button
                onClick={requestLocation}
                className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-rose-900/20 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4 animate-spin-once" />
                Retry Device Verification
              </button>
            )}

            {(status === 'requesting' || status === 'verifying') && (
              <button
                disabled
                className="w-full py-3 px-4 bg-slate-700 text-slate-400 rounded-xl font-medium flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                Awaiting Authorization...
              </button>
            )}

            {status === 'success' && (
              <div className="w-full py-3 px-4 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-xl font-semibold flex items-center justify-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                Authorized Device Verified
              </div>
            )}
          </div>

          {/* Footer Assistance */}
          <div className="mt-6 flex items-center gap-1.5 text-[11px] text-slate-500">
            <Lock className="w-3.5 h-3.5" />
            <span>Encrypted Verification Session</span>
          </div>
        </div>
      </div>
    </div>
  );
}
