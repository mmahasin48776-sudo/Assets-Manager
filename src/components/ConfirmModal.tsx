import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel"
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl animate-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        </div>
        <div className="p-6">
          <p className="text-slate-600">{message}</p>
          <div className="flex flex-col sm:flex-row gap-3 mt-8 justify-end">
            <button 
              onClick={onCancel} 
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              {cancelText}
            </button>
            <button 
              onClick={() => {
                onConfirm();
                onCancel();
              }} 
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-semibold bg-red-600 text-white hover:bg-red-700 transition-all shadow-lg shadow-red-100"
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
