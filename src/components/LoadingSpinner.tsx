import React from 'react';
import { HashLoader } from 'react-spinners';

export default function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full min-h-[60vh]">
      <HashLoader color="#2563eb" size={50} />
      
      <div className="mt-8 flex flex-col items-center gap-1">
        <span className="text-sm font-semibold tracking-[0.2em] uppercase text-slate-800">
          Loading
        </span>
      </div>
    </div>
  );
}
