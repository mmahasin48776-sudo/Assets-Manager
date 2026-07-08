import React, { useState, useEffect } from "react";
import axios from "axios";
import { LinkIcon, Plus, Pencil, Trash, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";

export default function Links({ user }: { user: any }) {
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ id: "", title: "", url: "", description: "" });
  const isSystemAdmin = user?.role === "system_admin";

  const fetchLinks = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/links");
      setLinks(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Failed to fetch links:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSystemAdmin) return;
    try {
      const payload = { ...formData };
      let promise;
      
      if (payload.id) {
        promise = axios.put(`/api/links/${payload.id}`, payload);
      } else {
        delete (payload as any).id;
        // Also remove any default created_at that might cause datatype mismatch if passed back
        delete (payload as any).created_at;
        promise = axios.post("/api/links", payload);
      }
      
      await toast.promise(promise, {
        loading: formData.id ? "Updating link..." : "Adding link...",
        success: formData.id ? "Link updated successfully" : "Link added successfully",
        error: "Failed to save link"
      });
      
      setIsModalOpen(false);
      fetchLinks();
    } catch (error) {
      console.error("Failed to save link:", error);
    }
  };

  const handleEdit = (link: any) => {
    setFormData(link);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!isSystemAdmin) return;
    try {
      const promise = axios.delete(`/api/links/${id}`);
      await toast.promise(promise, {
        loading: "Deleting link...",
        success: "Link deleted successfully",
        error: "Failed to delete link"
      });
      fetchLinks();
    } catch (error) {
      console.error("Failed to delete link:", error);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Useful Links</h1>
          <p className="text-slate-500 mt-1 hover:text-slate-700 transition">External resources and internal portals</p>
        </div>
        {isSystemAdmin && (
          <button
            onClick={() => {
              setFormData({ id: "", title: "", url: "", description: "" });
              setIsModalOpen(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Link
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading links...</div>
      ) : links.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-slate-200">
          <LinkIcon className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-2 text-sm font-medium text-slate-900">No links available</h3>
          <p className="mt-1 text-sm text-slate-500">
            {isSystemAdmin ? "Get started by adding a new link." : "There are no links to display right now."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {links.map((link) => (
            <div key={link.id} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex items-stretch">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white flex flex-col justify-center transition-colors group"
                title={link.url}
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0 mr-3">
                    <LinkIcon className="h-5 w-5 text-emerald-100 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-medium text-white truncate flex items-center">
                      {link.title}
                      <ExternalLink className="w-3.5 h-3.5 ml-2 opacity-60 group-hover:opacity-100 flex-shrink-0" />
                    </h3>
                    {link.description && (
                      <p className="text-emerald-100 text-xs truncate mt-0.5">{link.description}</p>
                    )}
                  </div>
                </div>
              </a>
              
              {isSystemAdmin && (
                <div className="flex flex-col justify-center px-2 py-1 border-l border-slate-200 space-y-1 bg-slate-50">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleEdit(link);
                    }}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                    title="Edit link"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete(link.id);
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded-md transition-colors"
                    title="Delete link"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isModalOpen && isSystemAdmin && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">{formData.id ? "Edit Link" : "Add Link"}</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    placeholder="e.g. Employee Portal"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">URL</label>
                  <input
                    type="url"
                    required
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                    placeholder="https://example.com"
                  />
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
                >
                  Save Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
