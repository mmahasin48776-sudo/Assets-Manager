import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

interface Option {
  label: string;
  value: string | number;
  sublabel?: string;
}

interface Props {
  options: Option[];
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export function SearchableSelect({ options, value, onChange, placeholder = "Select Option", required, className }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const safeOptions = Array.isArray(options) ? options : [];

  const filteredOptions = safeOptions.filter(o => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    const labelLower = o.label?.toLowerCase() || '';
    const sublabelLower = o.sublabel?.toLowerCase() || '';
    return labelLower.includes(searchLower) || sublabelLower.includes(searchLower);
  });

  const selectedOption = safeOptions.find(o => String(o.value) === String(value));

  return (
    <div className={className ? `relative ${className}` : "relative"} ref={dropdownRef}>
      {/* Hidden input for HTML5 validation if required */}
      {required && (
        <input 
          type="text" 
          required={required} 
          value={value || ""} 
          className="absolute opacity-0 w-0 h-0 pointer-events-none" 
          readOnly
          tabIndex={-1} 
        />
      )}
      
      <div 
        className={`w-full px-4 py-3 rounded-xl border bg-white flex items-center justify-between cursor-pointer transition-colors ${isOpen ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200'}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={`block break-words ${!selectedOption ? 'text-slate-400' : 'text-slate-900'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-xl shadow-slate-200/50 border border-slate-100 text-sm">
          <div className="p-2 border-b border-slate-100 sticky top-0 bg-white rounded-t-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                autoFocus
                placeholder="Search..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition-colors outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-slate-500 uppercase text-[10px] font-bold tracking-wider">No results found</div>
            ) : (
              filteredOptions.map((o) => (
                <div
                  key={String(o.value)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${String(value) === String(o.value) ? 'bg-emerald-50 text-emerald-700 font-medium' : 'hover:bg-slate-50 text-slate-700'}`}
                  onClick={() => {
                    onChange(String(o.value));
                    setIsOpen(false);
                    setSearchTerm("");
                  }}
                >
                  <div className="flex flex-col">
                    <span>{o.label}</span>
                    {o.sublabel && (
                      <span className={`text-[10px] ${String(value) === String(o.value) ? 'text-emerald-500' : 'text-slate-400'}`}>{o.sublabel}</span>
                    )}
                  </div>
                  {String(value) === String(o.value) && <Check className="w-4 h-4 text-emerald-500" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
