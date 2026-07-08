import React from 'react';
import { Info, CheckCircle, AlertCircle } from 'lucide-react';

interface AlertModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  closeText?: string;
}

export default function AlertModal({
  isOpen,
  title,
  message,
  type = 'info',
  onClose,
  closeText = "Close"
}: AlertModalProps) {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-6 h-6 text-red-600" />;
      default:
        return <Info className="w-6 h-6 text-blue-600" />;
    }
  };

  const getIconBg = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50';
      case 'error':
        return 'bg-red-50';
      default:
        return 'bg-blue-50';
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl animate-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full ${getIconBg()} flex items-center justify-center flex-shrink-0`}>
            {getIcon()}
          </div>
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        </div>
        <div className="p-6">
          <p className="text-slate-600">{message}</p>
          <div className="flex flex-col sm:flex-row gap-3 mt-8 justify-end">
            <button 
              onClick={onClose} 
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
            >
              {closeText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
