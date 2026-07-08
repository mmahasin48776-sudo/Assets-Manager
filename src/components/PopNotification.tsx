import React from 'react';
import { X, Bell, Info, Archive, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PopNotificationProps {
  notification: {
    id: number;
    title: string;
    message: string;
    type?: string;
    link?: string;
    created_at: string;
  };
  onViewDetails: (n: any) => void;
  onStore: (id: number) => void;
  onClose: (id: number) => void;
}

export default function PopNotification({ notification, onViewDetails, onStore, onClose }: PopNotificationProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed top-6 right-6 z-[100] w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-blue-100 overflow-hidden"
    >
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">{notification.title}</h3>
              <p className="text-xs text-slate-500">
                {new Date(notification.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <button 
            onClick={() => onClose(notification.id)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">
          <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
            {notification.message}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onViewDetails(notification)}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all text-xs font-bold shadow-sm hover:shadow-md"
          >
            View
          </button>
          <button
            onClick={() => onStore(notification.id)}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all text-xs font-bold"
          >
            Remind
          </button>
          <button
            onClick={() => onClose(notification.id)}
            className="flex items-center justify-center gap-2 px-3 py-2 border border-red-100 text-red-600 rounded-xl hover:bg-red-50 transition-all text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      </div>
      <div className="h-1 bg-blue-600/10 w-full overflow-hidden">
        <motion.div 
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: 10, ease: "linear" }}
          onAnimationComplete={() => onStore(notification.id)}
          className="h-full bg-blue-600"
        />
      </div>
    </motion.div>
  );
}
