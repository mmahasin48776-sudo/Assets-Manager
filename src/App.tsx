import logo from "./assets/logo.png";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import React, { useState, useEffect, createContext, useContext, lazy, Suspense } from "react";
import axios from "axios";
import { Menu, Bell } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { AnimatePresence } from "motion/react";
import Sidebar from "./components/Sidebar";
import LoadingSpinner from "./components/LoadingSpinner";
import AlertModal from "./components/AlertModal";

import Dashboard from "./pages/Dashboard";
const Employees = lazy(() => import("./pages/Employees"));
const EmployeeProfile = lazy(() => import("./pages/EmployeeProfile"));
const Assets = lazy(() => import("./pages/Assets"));
const Licenses = lazy(() => import("./pages/Licenses"));
const Projects = lazy(() => import("./pages/Projects"));
const ProjectDetails = lazy(() => import("./pages/ProjectDetails"));
const TelecomServices = lazy(() => import("./pages/TelecomServices"));
const Settings = lazy(() => import("./pages/Settings"));
const Registration = lazy(() => import("./pages/Registration"));
const Login = lazy(() => import("./pages/Login"));
const Links = lazy(() => import("./pages/Links"));
const Inquiry = lazy(() => import("./pages/Inquiry"));
const IncidentReports = lazy(() => import("./pages/IncidentReports"));
import Notifications from "./components/Notifications";
import PopNotification from "./components/PopNotification";
import UserProfileModal from "./components/UserProfileModal";
import LocationVerificationBarrier from "./components/LocationVerificationBarrier";

import { Toaster } from "react-hot-toast";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const AuthContext = createContext({
  user: null as any,
  isAdmin: false,
  isSystemAdmin: false,
  logout: () => {},
  updateUser: (updatedUser: any) => {}
});

export const DataContext = createContext({
  data: {} as any,
  refreshData: (type: string) => Promise.resolve(),
  ensureData: (type: string, force?: boolean) => Promise.resolve()
});

export const useAuth = () => useContext(AuthContext);
export const useData = () => useContext(DataContext);

axios.defaults.withCredentials = true;

// Axios interceptor for JWT and 401s
let isRedirecting = false;
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isRedirecting) {
      isRedirecting = true;
      localStorage.clear(); // Clear all to be sure
      if (error.config?.url !== "/api/login") {
        window.location.replace("/login"); // Use replace to avoid back bridge loops
      }
    }
    return Promise.reject(error);
  }
);

export default function App() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [locationAllowed, setLocationAllowed] = useState(() => {
    return localStorage.getItem("device_location_allowed") === "true";
  });
  const [loading, setLoading] = useState(() => {
    // Optimistically assume we are ready if we have a token and user saved
    return !(localStorage.getItem("user") && localStorage.getItem("token"));
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [detailsModal, setDetailsModal] = useState<{isOpen: boolean, title: string, message: string}>({
    isOpen: false,
    title: "",
    message: ""
  });
  const [allPopups, setAllPopups] = useState<any[]>([]);
  const [shownPopups, setShownPopups] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem("shownPopups");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const markPopupAsShown = (id: number) => {
    setShownPopups(prev => {
      const updated = new Set(prev).add(id);
      localStorage.setItem("shownPopups", JSON.stringify(Array.from(updated)));
      return updated;
    });
  };

  const activePopup = React.useMemo(() => {
    const now = new Date();
    const validPopups = allPopups.filter((n: any) => {
      if (shownPopups.has(n.id)) return false;
      const created = new Date(n.created_at);
      const diffDays = (now.getTime() - created.getTime()) / (1000 * 3600 * 24);
      return diffDays <= 21;
    });
    return validPopups.length > 0 ? validPopups[0] : null;
  }, [allPopups, shownPopups]);

  const fetchPopups = async () => {
    const token = localStorage.getItem("token");
    if (!user || !token) return;
    try {
      const res = await axios.get("/api/notifications?type=popup&action_type=pending", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllPopups(Array.isArray(res.data) ? res.data : []);
    } catch (error: any) {
      if (error.response?.status !== 401) {
        console.error("Failed to fetch popups", error);
      }
    }
  };

  useEffect(() => {
    if (user) {
      fetchPopups();
    }
  }, [user]);

  const handlePopupAction = async (id: number, action: 'stored' | 'closed') => {
    try {
      await axios.put(`/api/notifications/${id}`, { action_type: action });
      markPopupAsShown(id);
    } catch (error) {
      console.error("Failed to update popup action", error);
      // Even if API fails, ignore it locally so it won't show again.
      markPopupAsShown(id);
    }
  };

  const [data, setData] = useState<any>({
    employees: [],
    assets: [],
    licenses: [],
    positions: [],
    locations: [],
    departments: [],
    categories: [],
    models: [],
    manufacturers: [],
    vendors: [],
    features: [],
    assetNames: [],
    licenseTypes: [],
    licenseNames: [],
    stats: null,
    lastFetched: {}
  });

  const pendingRequests = React.useRef<{ [key: string]: Promise<void> }>({});

  const refreshData = async (type: string) => {
    if (pendingRequests.current[type] !== undefined) {
      return pendingRequests.current[type];
    }
    
    const requestPromise = (async () => {
      try {
        let endpoint = "";
        switch (type) {
          case "employees": endpoint = "/api/employees"; break;
          case "assets": endpoint = "/api/assets"; break;
          case "licenses": endpoint = "/api/licenses"; break;
          case "stats": endpoint = "/api/stats"; break;
          case "categories": endpoint = "/api/categories"; break;
          case "models": endpoint = "/api/models"; break;
          case "manufacturers": endpoint = "/api/manufacturers"; break;
          case "vendors": endpoint = "/api/vendors"; break;
          case "features": endpoint = "/api/features"; break;
          case "assetNames": endpoint = "/api/asset-names"; break;
          case "licenseTypes": endpoint = "/api/license-types"; break;
          case "licenseNames": endpoint = "/api/license-names"; break;
          case "locations": endpoint = "/api/locations"; break;
          case "positions": endpoint = "/api/positions"; break;
          case "telecomServices": endpoint = "/api/telecom-services"; break;
          case "departments": endpoint = "/api/departments"; break;
          case "master": 
          const resMaster = await axios.get("/api/master-data");
          const now = Date.now();
          const newLastFetched: any = { master: now };
          if (resMaster.data) {
             Object.keys(resMaster.data).forEach(k => newLastFetched[k] = now);
          }
          setData((prev: any) => ({
            ...prev,
            ...resMaster.data,
            lastFetched: { ...prev.lastFetched, ...newLastFetched }
          }));
          // Trigger stats refresh since adding new locations/departments might affect it
          refreshData('stats').catch(console.error);
          return;
        }
        
        if (endpoint) {
          const res = await axios.get(endpoint);
          // Robustness: ensure we store the correct format
          let responseData = res.data;
          if (type !== 'stats' && !Array.isArray(responseData)) {
            // If the API returned an error object instead of the expected array
            console.warn(`API returned non-array for ${type}:`, responseData);
            responseData = [];
          }
          
          setData((prev: any) => ({
            ...prev,
            [type]: responseData,
            lastFetched: { ...prev.lastFetched, [type]: Date.now() }
          }));

          // Trigger stats refresh if core entities are updated
          if (['employees', 'assets', 'licenses', 'telecomServices'].includes(type)) {
            refreshData('stats').catch(console.error);
          }
        }
      } catch (error: any) {
        if (error.response?.status !== 401 && error.name !== 'CanceledError' && error.code !== 'ECONNABORTED') {
          console.error(`Failed to fetch ${type}:`, error);
        }
      }
    })();
    
    pendingRequests.current[type] = requestPromise;
    try {
      await requestPromise;
    } finally {
      delete pendingRequests.current[type];
    }
  };

  const ensureData = async (type: string, force = false) => {
    const cacheTime = 5 * 60 * 1000; // 5 minutes cache
    if (force || !data.lastFetched[type] || (Date.now() - data.lastFetched[type]) > cacheTime) {
      await refreshData(type);
    }
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'system_admin';
  const isSystemAdmin = user?.role === 'system_admin';

  const handleLogin = (userData: any, token: string) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("token", token);
    setLocationAllowed(localStorage.getItem("device_location_allowed") === "true");
  };

  const handleUpdateProfile = (updatedUser: any) => {
    setUser(updatedUser);
    localStorage.setItem("user", JSON.stringify(updatedUser));
  };

  const handleLogout = async () => {
    try {
      await axios.get('/api/logout');
    } catch (e) {}
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("project_keys");
    localStorage.removeItem("admin_secret");
    navigate("/login");
  };

  const handleOpenNotifications = () => {
    if (!isAdmin) {
      setIsMobileMenuOpen(false);
      navigate('/');
    } else {
      setIsNotificationsOpen(true);
    }
  };

  // Verify session on mount and prefetch essential data
  useEffect(() => {
    const initApp = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setUser(null);
        localStorage.removeItem("user");
        setLoading(false);
        return;
      }

      // Fetch session info
      try {
        const res = await axios.get('/api/me');
        if (res.data.success) {
          const { user: userData } = res.data;
          setUser(userData);
          localStorage.setItem("user", JSON.stringify(userData));

          // Prefetch essential/master data during the initial app loading delay
          await Promise.all([
            refreshData('master'),
            refreshData('assets'),
            refreshData('licenses'),
            refreshData('employees'),
            refreshData('telecomServices'),
            refreshData('stats')
          ]).catch((err) => {
            console.error("Failed to prefetch application data", err);
          });
        }
      } catch (e: any) {
        if (e.status === 401 || e.response?.status === 401) {
          setUser(null);
          localStorage.removeItem("user");
          localStorage.removeItem("token");
        } else {
          console.error("Initialization failed", e);
        }
      } finally {
        setLoading(false);
      }
    };
    initApp();
  }, []);

  const ProtectedRoute = ({ children, adminOnly = false, systemAdminOnly = false, userOnly = false }: { children: React.ReactNode, adminOnly?: boolean, systemAdminOnly?: boolean, userOnly?: boolean }) => {
    if (loading) return <LoadingSpinner />;
    if (!user) return <Navigate to="/login" replace />;
    if (!locationAllowed) {
      return <LocationVerificationBarrier onVerified={() => setLocationAllowed(true)} />;
    }
    if (systemAdminOnly && user.role !== 'system_admin') return <Navigate to="/" replace />;
    if (adminOnly && !['admin', 'system_admin'].includes(user.role)) return <Navigate to="/" replace />;
    if (userOnly && user.role !== 'user') return <Navigate to="/" replace />;
    return <>{children}</>;
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, isSystemAdmin, logout: handleLogout, updateUser: handleUpdateProfile }}>
        <DataContext.Provider value={{ data, refreshData, ensureData }}>
            <Routes>
            <Route path="/login" element={
              loading ? <LoadingSpinner /> : 
              user ? <Navigate to="/" replace /> : (
                <Suspense fallback={<LoadingSpinner />}>
                  <Login onLogin={handleLogin} />
                </Suspense>
              )
            } />
            
            <Route path="/*" element={
              <ProtectedRoute>
                <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
                  {/* Mobile Sidebar Overlay */}
                  {isMobileMenuOpen && (
                    <div 
                      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden"
                      onClick={() => setIsMobileMenuOpen(false)}
                    />
                  )}
                  
                  {/* Sidebar */}
                  <div className={cn(
                    "fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
                    isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
                  )}>
                    <Sidebar onLogout={handleLogout} onClose={() => setIsMobileMenuOpen(false)} onOpenNotifications={handleOpenNotifications} onOpenProfile={() => setIsProfileOpen(true)} />
                  </div>

                  <main className="flex-1 flex flex-col overflow-hidden">
                    {/* Fixed Header */}
                    <header className="flex-shrink-0 bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 md:px-8 z-30 shadow-sm relative">
                      <div className="flex items-center gap-3">
                        <div className="md:hidden flex items-center gap-2">
                          <div className="bg-white border border-gray-100 rounded-lg shadow-sm overflow-hidden flex items-center justify-center h-10 w-[40px]">
                            <img src={logo} alt="Logo" className="h-full w-full object-contain p-0.5" referrerPolicy="no-referrer" />
                          </div>
                        </div>
                        <h2 className="font-bold text-slate-800 text-sm md:text-base tracking-tight hidden sm:block">
                          Homes Contracting Company
                        </h2>
                      </div>
                      
                      <div className="flex items-center gap-2 md:gap-4">
                        <button 
                          onClick={handleOpenNotifications} 
                          className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-all relative"
                          title="Notifications"
                        >
                          <Bell className="w-5 h-5 md:w-6 h-6" />
                          <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
                        </button>
                        
                        <button 
                          onClick={() => setIsMobileMenuOpen(true)} 
                          className="md:hidden p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-all"
                        >
                          <Menu className="w-6 h-6" />
                        </button>
                        
                        {user && (
                          <div 
                            onClick={() => setIsProfileOpen(true)}
                            className="hidden md:flex items-center gap-3 pl-4 border-l border-slate-200 cursor-pointer hover:bg-slate-50 p-1.5 rounded-xl transition-all"
                            title="View / Edit Profile Settings"
                          >
                            <div className="flex flex-col items-end selection:bg-transparent">
                              <span className="text-xs font-bold text-slate-950 font-sans">{user.name || user.username}</span>
                              <span className="text-[10px] font-semibold text-slate-400 capitalize font-sans">{user.position || user.role?.replace('_', ' ')}</span>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-700 font-bold text-xs border border-blue-200 flex items-center justify-center uppercase">
                              {(user.name || user.username)?.[0]}
                            </div>
                          </div>
                        )}
                      </div>
                    </header>

                    <div className="flex-1 overflow-auto p-4 md:p-8 scroll-smooth">
                      <Suspense fallback={<LoadingSpinner />}>
                        <Routes>
                          <Route path="/" element={<Dashboard />} />
                          <Route path="/employees" element={<Employees />} />
                          <Route path="/employees/:id" element={<EmployeeProfile />} />
                          <Route path="/assets" element={<Assets />} />
                          <Route path="/licenses" element={<Licenses />} />
                          <Route path="/projects" element={
                            <ProtectedRoute adminOnly>
                              <Projects />
                            </ProtectedRoute>
                          } />
                          <Route path="/projects/:id" element={
                            <ProtectedRoute adminOnly>
                              <ProjectDetails />
                            </ProtectedRoute>
                          } />
                          <Route path="/telecom-services" element={<TelecomServices />} />
                          <Route path="/incidents" element={<IncidentReports />} />
                          <Route path="/links" element={<Links user={user} />} />
                          <Route path="/inquiry" element={
                            <ProtectedRoute systemAdminOnly>
                              <Inquiry />
                            </ProtectedRoute>
                          } />
                          <Route path="/settings" element={
                            <ProtectedRoute systemAdminOnly>
                              <Settings />
                            </ProtectedRoute>
                          } />
                          <Route path="/register" element={
                            <ProtectedRoute systemAdminOnly>
                              <Registration />
                            </ProtectedRoute>
                          } />
                          <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                      </Suspense>
                    </div>
                  </main>
                  
                  <Notifications isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />
                  
                  <UserProfileModal 
                    isOpen={isProfileOpen} 
                    onClose={() => setIsProfileOpen(false)} 
                    currentUser={user} 
                    onUserUpdated={handleUpdateProfile} 
                  />
                  
                  <AnimatePresence>
                    {activePopup && (
                      <PopNotification 
                        notification={activePopup}
                         onViewDetails={(n) => {
                           if (n.link) {
                             let targetLink = n.link;
                             try {
                               const url = new URL(targetLink, window.location.origin);
                               const idVal = url.searchParams.get('id');
                               if (idVal) {
                                 if (!url.searchParams.has('highlight')) {
                                   url.searchParams.set('highlight', idVal);
                                 }
                               } else {
                                 const messageToParse = (n.message || "") + " " + (n.title || "");
                                 const idMatch = messageToParse.match(/(?:id|#|asset|license|employee)\s*:?\s*(\d+)/i);
                                 if (idMatch && idMatch[1]) {
                                   url.searchParams.set('id', idMatch[1]);
                                   url.searchParams.set('highlight', idMatch[1]);
                                 }
                               }
                               targetLink = url.pathname + url.search + url.hash;
                             } catch (e) {
                               console.error("Failed to parse block popLink:", e);
                             }
                             navigate(targetLink);
                             markPopupAsShown(n.id);
                             return;
                           }
                          let extraInfo = "";
                          if (data.stats) {
                            extraInfo = `\n\nCurrent Stats:\n- Total Assets: ${data.stats.totalAssets || 0}\n- Available: ${data.stats.availableAssets || 0}\n- Assigned: ${data.stats.assignedAssets || 0}`;
                          }
                          setDetailsModal({
                            isOpen: true,
                            title: n.title,
                            message: n.message + extraInfo
                          });
                          markPopupAsShown(n.id);
                        }}
                        onStore={(id) => handlePopupAction(id, "stored")}
                        onClose={(id) => handlePopupAction(id, "closed")}
                      />
                    )}
                  </AnimatePresence>

                  <AlertModal 
                    isOpen={detailsModal.isOpen}
                    title={detailsModal.title}
                    message={detailsModal.message}
                    onClose={() => setDetailsModal(prev => ({ ...prev, isOpen: false }))}
                  />
                  <Toaster position="top-right" />
                </div>
              </ProtectedRoute>
            } />
          </Routes>
        </DataContext.Provider>
    </AuthContext.Provider>
  );
}
