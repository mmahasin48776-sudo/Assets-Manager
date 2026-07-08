import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Plus, Edit2, Trash2, ShieldCheck, Server, Printer, Monitor, Key, HardDrive, Router, Wifi, Cpu } from "lucide-react";
import { useAuth } from "../App";
import LoadingSpinner from "../components/LoadingSpinner";
import ConfirmModal from "../components/ConfirmModal";
import AlertModal from "../components/AlertModal";

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  
  const [project, setProject] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    category: "Printer",
    name: "",
    model: "",
    ip_address: "",
    username: "",
    password: "",
    access_password: "",
    serial: "",
    identify_address: "",
    notes: ""
  });
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [alertState, setAlertState] = useState<{ isOpen: boolean, title: string, message: string, type: 'success' | 'error' | 'info' }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info"
  });

  const categories = ["Printer", "NAS Drive", "Plotter", "Network Device", "Switch", "Access Point", "Other"];

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [projRes, itemsRes] = await Promise.all([
        axios.get(`/api/locations?id=${id}`),
        axios.get(`/api/location-items?location_id=${id}`)
      ]);
      
      if (Array.isArray(projRes.data) && projRes.data.length > 0) {
        setProject(projRes.data[0]);
      }
      
      if (Array.isArray(itemsRes.data)) {
        setItems(itemsRes.data);
      }
    } catch (error) {
      console.error("Failed to fetch project details", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(`/api/location-items/${editingId}`, formData);
      } else {
        await axios.post("/api/location-items", { ...formData, location_id: id });
      }
      setIsModalOpen(false);
      fetchData();
      setAlertState({ isOpen: true, title: "Success", message: "Item saved successfully!", type: "success" });
    } catch (error: any) {
      if (error.response?.status !== 400) {
        console.error("Failed to save item", error);
      }
      setAlertState({ isOpen: true, title: "Error", message: "Failed to save item: " + (error.response?.data?.message || error.message), type: "error" });
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await axios.delete(`/api/location-items/${confirmDelete}`);
      setConfirmDelete(null);
      fetchData();
      setAlertState({ isOpen: true, title: "Success", message: "Item deleted successfully!", type: "success" });
    } catch (error) {
      console.error("Failed to delete item", error);
      setAlertState({ isOpen: true, title: "Error", message: "Failed to delete item", type: "error" });
    }
  };

  const openEditModal = (item: any) => {
    setEditingId(item.id);
    setFormData({
      category: item.category || "Printer",
      name: item.name || "",
      model: item.model || "",
      ip_address: item.ip_address || "",
      username: item.username || "",
      password: item.password || "",
      access_password: item.access_password || "",
      serial: item.serial || "",
      identify_address: item.identify_address || "",
      notes: item.notes || ""
    });
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setEditingId(null);
    setFormData({
      category: "Printer",
      name: "",
      model: "",
      ip_address: "",
      username: "",
      password: "",
      access_password: "",
      serial: "",
      identify_address: "",
      notes: ""
    });
    setIsModalOpen(true);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Printer": return <Printer className="w-5 h-5 text-purple-500" />;
      case "NAS Drive": return <HardDrive className="w-5 h-5 text-blue-500" />;
      case "Plotter": return <Printer className="w-5 h-5 text-indigo-500" />;
      case "Network Device": return <Server className="w-5 h-5 text-green-500" />;
      case "Switch": return <Router className="w-5 h-5 text-teal-500" />;
      case "Access Point": return <Wifi className="w-5 h-5 text-cyan-500" />;
      default: return <Cpu className="w-5 h-5 text-slate-500" />;
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!project) return <div className="p-8 text-center text-slate-500">Location not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate("/projects")}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{project.name}</h1>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={openAddModal}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Item to future access
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map(item => (
          <div key={item.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                  {getCategoryIcon(item.category)}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{item.name}</h3>
                  <span className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-600 rounded-full">
                    {item.category}
                  </span>
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-2">
                  <button onClick={() => openEditModal(item)} className="p-1 text-slate-400 hover:text-blue-600 transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setConfirmDelete(item.id)} className="p-1 text-slate-400 hover:text-red-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-3 flex-1 text-sm">
              {item.model && (
                <div className="flex justify-between border-b border-slate-50 pb-2">
                  <span className="text-slate-500">Model:</span>
                  <span className="font-medium text-slate-800">{item.model}</span>
                </div>
              )}
              {item.ip_address && (
                <div className="flex justify-between border-b border-slate-50 pb-2">
                  <span className="text-slate-500">IP Address:</span>
                  <span className="font-medium text-slate-800 font-mono text-xs">{item.ip_address}</span>
                </div>
              )}
              {item.username && (
                <div className="flex justify-between border-b border-slate-50 pb-2">
                  <span className="text-slate-500">Username:</span>
                  <span className="font-medium text-slate-800">{item.username}</span>
                </div>
              )}
              {item.password && (
                <div className="flex justify-between border-b border-slate-50 pb-2">
                  <span className="text-slate-500">Password:</span>
                  <span className="font-medium text-slate-800 font-mono">{item.password}</span>
                </div>
              )}
              {item.access_password && (
                <div className="flex justify-between border-b border-slate-50 pb-2">
                  <span className="text-slate-500">Access Password:</span>
                  <span className="font-medium text-slate-800 font-mono">{item.access_password}</span>
                </div>
              )}
              {item.serial && (
                <div className="flex justify-between border-b border-slate-50 pb-2">
                  <span className="text-slate-500">Serial/Tag:</span>
                  <span className="font-medium text-slate-800">{item.serial}</span>
                </div>
              )}
              {item.identify_address && (
                <div className="flex justify-between border-b border-slate-50 pb-2">
                  <span className="text-slate-500">Identify Addr:</span>
                  <span className="font-medium text-slate-800">{item.identify_address}</span>
                </div>
              )}
              {item.notes && (
                <div className="pt-2">
                  <span className="text-slate-500 block mb-1">Notes:</span>
                  <p className="text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">{item.notes}</p>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {items.length === 0 && (
          <div className="col-span-full text-center py-12 bg-white rounded-xl border border-slate-200 border-dashed">
            <p className="text-slate-500">No items added to this project yet.</p>
            {isAdmin && (
              <button onClick={openAddModal} className="mt-4 text-blue-600 hover:underline font-medium">
                Add the first item
              </button>
            )}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800">
                {editingId ? "Edit Item" : "Add Item"}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  required
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Device Name</label>
                  <input
                    type="text"
                    required
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter Name"
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Device Model</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="Enter model"
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">IP Address</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                    value={formData.ip_address}
                    onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                    placeholder="192.168.1.50"
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Identify Address</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={formData.identify_address}
                    onChange={(e) => setFormData({ ...formData, identify_address: e.target.value })}
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Login Username</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Login Password</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Access Password</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={formData.access_password}
                    onChange={(e) => setFormData({ ...formData, access_password: e.target.value })}
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Serial Number/Tag</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={formData.serial}
                    onChange={(e) => setFormData({ ...formData, serial: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Note</label>
                <textarea
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmDelete}
        title="Delete Item"
        message="Are you sure you want to delete this item? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      <AlertModal
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
        onClose={() => setAlertState({ ...alertState, isOpen: false })}
      />
    </div>
  );
}
