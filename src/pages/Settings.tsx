import { useState, useEffect } from "react";
import { ScaleLoader } from "react-spinners";
import { 
  Settings as SettingsIcon, 
  Plus, 
  Trash2, 
  Edit,
  Tag, 
  Monitor, 
  Building2, 
  Truck, 
  ShieldCheck,
  Briefcase,
  MapPin,
  Users,
  AlertTriangle
} from "lucide-react";
import axios from "axios";
import ConfirmModal from "../components/ConfirmModal";
import toast from "react-hot-toast";
import { useData } from "../App";

export default function Settings() {
  const { refreshData } = useData();
  const [categories, setCategories] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [manufacturers, setManufacturers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [licenseTypes, setLicenseTypes] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [features, setFeatures] = useState<any[]>([]);
  const [assetNames, setAssetNames] = useState<any[]>([]);
  const [licenseNames, setLicenseNames] = useState<any[]>([]);
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {}
  });

  const [newItems, setNewItems] = useState({
    category: "", model: "", manufacturer: "", vendor: "", licenseType: "", position: "", location: "", department: "", feature: "", assetName: "", licenseName: ""
  });

  const [editingItem, setEditingItem] = useState<{ type: string, id: number, name: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cat, mod, man, ven, lic, pos, loc, dep, feat, anames, lnames] = await Promise.all([
        axios.get("/api/categories"),
        axios.get("/api/models"),
        axios.get("/api/manufacturers"),
        axios.get("/api/vendors"),
        axios.get("/api/license-types"),
        axios.get("/api/positions"),
        axios.get("/api/locations"),
        axios.get("/api/departments"),
        axios.get("/api/features"),
        axios.get("/api/asset-names"),
        axios.get("/api/license-names")
      ]);
      setCategories(cat.data);
      setModels(mod.data);
      setManufacturers(man.data);
      setVendors(ven.data);
      setLicenseTypes(lic.data);
      setPositions(pos.data);
      setLocations(loc.data);
      setDepartments(dep.data);
      setFeatures(feat.data);
      setAssetNames(anames.data);
      setLicenseNames(lnames.data);
    } catch (error) {
      console.error("Failed to load settings data", error);
    } finally {
      setLoading(false);
    }
  };

  const addItem = async (type: string, route: string, value: string) => {
    if (!value) return;
    const promise = axios.post(`/api/${route}`, { name: value }).then(res => {
      if (res.data && res.data.success === false) {
        throw new Error(res.data.message || `Failed to add ${type}`);
      }
      return res.data;
    });

    toast.promise(promise, {
      loading: `Adding ${type}...`,
      success: () => {
        setNewItems(prev => ({ ...prev, [type]: "" }));
        fetchData();
        refreshData("master");
        return `Successfully added ${value}.`;
      },
      error: (err: any) => err.response?.data?.message || err.message || `Failed to add ${type}. Please try again.`
    });
  };

  const updateItem = async (route: string, id: number, name: string, type: string) => {
    if (!name) return;
    const promise = axios.post(`/api/${route}/${id}`, { name, _method: 'PUT' }).then(res => {
      if (res.data && res.data.success === false) {
        throw new Error(res.data.message || `Failed to update ${type}`);
      }
      return res.data;
    });

    toast.promise(promise, {
      loading: `Updating ${type}...`,
      success: () => {
        setEditingItem(null);
        fetchData();
        refreshData("master");
        return `Successfully updated to ${name}.`;
      },
      error: (err: any) => err.response?.data?.message || err.message || `Failed to update ${type}. Please try again.`
    });
  };

  const deleteItem = async (route: string, id: number, type: string) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Item",
      message: "Are you sure you want to delete this item?",
      onConfirm: async () => {
        // Optimistic update
        let previousData: any[] = [];
        const setter = (type === 'category' ? setCategories : 
                        type === 'model' ? setModels : 
                        type === 'manufacturer' ? setManufacturers : 
                        type === 'vendor' ? setVendors : 
                        type === 'position' ? setPositions :
                        type === 'location' ? setLocations : 
                        type === 'department' ? setDepartments :
                        type === 'feature' ? setFeatures :
                        type === 'assetName' ? setAssetNames : 
                        type === 'licenseName' ? setLicenseNames : setLicenseTypes);
        
        if (type === 'category') previousData = [...categories];
        else if (type === 'model') previousData = [...models];
        else if (type === 'manufacturer') previousData = [...manufacturers];
        else if (type === 'vendor') previousData = [...vendors];
        else if (type === 'position') previousData = [...positions];
        else if (type === 'location') previousData = [...locations];
        else if (type === 'department') previousData = [...departments];
        else if (type === 'feature') previousData = [...features];
        else if (type === 'assetName') previousData = [...assetNames];
        else if (type === 'licenseName') previousData = [...licenseNames];
        else previousData = [...licenseTypes];

        setter((prev: any[]) => (Array.isArray(prev) ? prev : []).filter(item => item.id !== id));
        
        const promise = axios.post(`/api/${route}/${id}`, { _method: 'DELETE' }).then(res => {
          if (res.data && res.data.success === false) {
            throw new Error(res.data.message || `Failed to delete ${type}`);
          }
          return res.data;
        });

        toast.promise(promise, {
          loading: `Deleting ${type}...`,
          success: () => {
            refreshData("master");
            return `Successfully deleted ${type}.`;
          },
          error: (err: any) => {
            setter(previousData);
            return err.response?.data?.message || err.message || `Failed to delete ${type}. Please try again.`;
          }
        });
      }
    });
  };

  const sections = [
    { title: "Asset Names", icon: Tag, data: assetNames, route: "asset-names", type: "assetName" },
    { title: "License Names", icon: Tag, data: licenseNames, route: "license-names", type: "licenseName" },
    { title: "Asset Categories", icon: Tag, data: categories, route: "categories", type: "category" },
    { title: "Asset Models", icon: Monitor, data: models, route: "models", type: "model" },
    { title: "Manufacturers", icon: Building2, data: manufacturers, route: "manufacturers", type: "manufacturer" },
    { title: "Vendors", icon: Truck, data: vendors, route: "vendors", type: "vendor" },
    { title: "License Categories", icon: ShieldCheck, data: licenseTypes, route: "license-types", type: "licenseType" },
    { title: "Employee Positions", icon: Briefcase, data: positions, route: "positions", type: "position" },
    { title: "Employee Departments", icon: Users, data: departments, route: "departments", type: "department" },
    { title: "Employee Locations", icon: MapPin, data: locations, route: "locations", type: "location" },
    { title: "Asset Features", icon: SettingsIcon, data: features, route: "features", type: "feature" },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <ScaleLoader color="#10b981" height={50} width={5} radius={2} margin={3} />
        <div className="mt-8 flex flex-col items-center gap-2">
          <span className="text-sm font-bold tracking-[0.3em] uppercase text-slate-900">Settings</span>
          <p className="text-xs text-slate-400 animate-pulse font-medium">Loading data from db...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Manage master data and dropdown options.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {sections.map((section) => (
          <div key={section.title} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
              <div className="bg-emerald-500/10 p-2 rounded-lg">
                <section.icon className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="font-bold text-slate-900">{section.title}</h3>
            </div>
            
            <div className="p-6 space-y-4 flex-1">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder={`New ${section.title.endsWith('ies') ? section.title.replace(/ies$/, 'y') : section.title.replace(/s$/, '')}...`}
                  className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                  value={(newItems as any)[section.type]}
                  onChange={(e) => setNewItems({ ...newItems, [section.type]: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && addItem(section.type, section.route, (newItems as any)[section.type])}
                />
                <button 
                  onClick={() => addItem(section.type, section.route, (newItems as any)[section.type])}
                  className="p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-1 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {(Array.isArray(section.data) ? section.data : []).map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 group transition-colors">
                    {editingItem?.id === item.id && editingItem?.type === section.type ? (
                      <div className="flex-1 flex gap-2 mr-2">
                        <input 
                          autoFocus
                          type="text" 
                          className="flex-1 px-3 py-1 rounded-lg border border-emerald-500 text-sm outline-none"
                          value={editingItem.name || ""}
                          onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') updateItem(section.route, item.id, editingItem.name, section.type);
                            if (e.key === 'Escape') setEditingItem(null);
                          }}
                        />
                        <button 
                          onClick={() => updateItem(section.route, item.id, editingItem.name, section.type)}
                          className="text-emerald-600 hover:text-emerald-700 font-bold text-xs"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm text-slate-700 font-medium">{item.name}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setEditingItem({ type: section.type, id: item.id, name: item.name })}
                            className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => deleteItem(section.route, item.id, section.type)}
                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {section.data.length === 0 && (
                  <p className="text-center py-8 text-slate-400 text-xs italic">No items found.</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState({ ...confirmState, isOpen: false })}
      />
    </div>
  );
}
