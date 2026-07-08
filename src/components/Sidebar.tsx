import logo from "../assets/logo.png";
import { NavLink } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  Laptop, 
  Key, 
  Settings, 
  LogOut,
  X,
  Briefcase,
  PhoneCall,
  Bell,
  UserPlus,
  LinkIcon,
  ClipboardList,
  ShieldAlert
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useAuth } from "../App";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Sidebar({ onLogout, onClose, onOpenNotifications, onOpenProfile }: { onLogout: () => void, onClose?: () => void, onOpenNotifications?: () => void, onOpenProfile?: () => void }) {
  const { user, isAdmin, isSystemAdmin } = useAuth();

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard", color: "text-blue-500" },
    { to: "/employees", icon: Users, label: "Employees", color: "text-orange-500" },
    { to: "/assets", icon: Laptop, label: "Assets", color: "text-purple-500" },
    { to: "/licenses", icon: Key, label: "Licenses", color: "text-yellow-500" },
    { to: "/telecom-services", icon: PhoneCall, label: "Telecom & Services", color: "text-indigo-500" },
    { to: "/incidents", icon: ShieldAlert, label: "Incidents", color: "text-red-500" },
    { to: "/links", icon: LinkIcon, label: "Links", color: "text-cyan-500" },
    { to: "/inquiry", icon: ClipboardList, label: "Inquiry", color: "text-rose-500", systemAdminOnly: true },
    { to: "/projects", icon: Briefcase, label: "Projects", color: "text-emerald-500", adminOnly: true },
    { to: "/register", icon: UserPlus, label: "User Registration", color: "text-pink-500", systemAdminOnly: true },
    { to: "/settings", icon: Settings, label: "Settings", color: "text-gray-500", systemAdminOnly: true },
  ];

  const filteredNavItems = navItems.filter(item => {
    if (item.systemAdminOnly) return isSystemAdmin;
    if (item.adminOnly) return isAdmin;
    return true;
  });

  return (
    <aside className="w-64 h-full bg-white text-gray-800 flex flex-col border-r border-gray-200 shadow-sm transition-colors duration-300">
      <div className="p-6 flex items-center justify-between border-b border-gray-100">
        <div className="flex flex-col items-center gap-3 w-full">
          <div className="bg-transparent overflow-hidden flex items-center justify-center h-16 w-full">
            <img src={logo} alt="Homes Contracting Company Logo" className="h-full w-auto object-contain p-1" referrerPolicy="no-referrer" />
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors absolute right-4 top-13">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
      
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {filteredNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onClose}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-4 py-3 rounded-full transition-all duration-200 group",
              isActive 
                ? "bg-blue-50 text-blue-700 font-semibold shadow-sm" 
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <item.icon className={cn("w-5 h-5 transition-transform duration-200 group-hover:scale-110", item.color)} />
            <span className="text-sm font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 space-y-2 border-t border-gray-100 bg-gray-50/50">
        <button
          onClick={onOpenNotifications}
          className="flex items-center justify-between w-full px-4 py-3 rounded-full text-gray-600 hover:bg-white hover:text-blue-600 hover:shadow-sm transition-all duration-200 group"
        >
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-amber-500 group-hover:animate-ring" />
            <span className="text-sm font-medium">Notifications</span>
          </div>
        </button>

        <button
          onClick={onLogout}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-full text-gray-600 hover:bg-red-50 hover:text-red-600 hover:shadow-sm transition-all duration-200 group"
        >
          <LogOut className="w-5 h-5 text-red-500" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}
