import React, { useState, useEffect } from "react";
import axios from "axios";
import { Bell, X, CheckCircle, Info } from "lucide-react";
import { HashLoader } from "react-spinners";
import { useAuth } from "../App";
import { useNavigate } from "react-router-dom";

export default function Notifications({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { isAdmin } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      // Fetch both info type and stored action type notifications
      const [resInfo, resStored] = await Promise.all([
        axios.get("/api/notifications?type=info"),
        axios.get("/api/notifications?action_type=stored")
      ]);
      
      const allNotifications = [...resInfo.data, ...resStored.data];
      // De-duplicate by ID
      const unique = Array.from(new Map(allNotifications.map(item => [item.id, item])).values());
      
      const sorted = unique.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setNotifications(sorted);
    } catch (error) {
      console.error("Failed to fetch notifications", error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await axios.put(`/api/notifications/${id}`, { is_read: 1 });
      setNotifications((Array.isArray(notifications) ? notifications : []).map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch (error) {
      console.error("Failed to mark as read", error);
    }
  };

  const deleteNotification = async (id: number) => {
    try {
      await axios.delete(`/api/notifications/${id}`);
      setNotifications((Array.isArray(notifications) ? notifications : []).filter(n => n.id !== id));
    } catch (error) {
      console.error("Failed to delete notification", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-300">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 text-slate-800 font-bold">
            <Bell className="w-5 h-5 text-blue-600" />
            <h2>Store Notifications</h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <HashLoader color="#2563eb" size={30} />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No notifications found
            </div>
          ) : (
            notifications.map(notification => (
              <div 
                key={notification.id} 
                className={`p-4 rounded-xl border ${notification.is_read ? 'bg-slate-50 border-slate-200' : 'bg-blue-50 border-blue-100'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className={`font-medium ${notification.is_read ? 'text-slate-700' : 'text-blue-900'}`}>
                    {notification.title}
                  </h3>
                </div>
                <p className="text-sm text-slate-600 mb-3 whitespace-pre-line">{notification.message}</p>
                
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200/50">
                  <span className="text-xs text-slate-400">
                    {new Date(notification.created_at).toLocaleString()}
                  </span>
                  <div className="flex items-center gap-2">
                    {notification.link && (
                      <button
                        onClick={() => {
                          let targetLink = notification.link;
                          try {
                            const url = new URL(targetLink, window.location.origin);
                            const idVal = url.searchParams.get('id');
                            if (idVal) {
                              if (!url.searchParams.has('highlight')) {
                                url.searchParams.set('highlight', idVal);
                              }
                            } else {
                              const messageToParse = (notification.message || "") + " " + (notification.title || "");
                              const idMatch = messageToParse.match(/(?:id|#|asset|license|employee)\s*:?\s*(\d+)/i);
                              if (idMatch && idMatch[1]) {
                                url.searchParams.set('id', idMatch[1]);
                                url.searchParams.set('highlight', idMatch[1]);
                              }
                            }
                            targetLink = url.pathname + url.search + url.hash;
                          } catch (e) {
                            console.error("Failed to parse targetLink:", e);
                          }
                          navigate(targetLink);
                          onClose();
                        }}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                      >
                        View
                      </button>
                    )}
                    <button 
                      onClick={() => deleteNotification(notification.id)}
                      className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-100 border border-transparent transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
