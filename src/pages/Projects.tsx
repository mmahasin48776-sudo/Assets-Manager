import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Edit2, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth, useData } from "../App";
import LoadingSpinner from "../components/LoadingSpinner";
import ConfirmModal from "../components/ConfirmModal";

export default function Projects() {
  const { isAdmin, isSystemAdmin } = useAuth();
  const { refreshData } = useData();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [verifyingProject, setVerifyingProject] = useState<any>(null);
  const [projectSecret, setProjectSecret] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "" });
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await axios.get("/api/locations");
      if (Array.isArray(res.data)) {
        setProjects(res.data);
      } else {
        console.error("Expected array but got:", res.data);
        setProjects([]);
      }
    } catch (error) {
      console.error("Failed to fetch projects", error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleProjectEnter = (project: any) => {
    if (isSystemAdmin) {
      navigate(`/projects/${project.id}`);
      return;
    }

    const savedKeys = JSON.parse(localStorage.getItem("project_keys") || "{}");
    const savedKey = savedKeys[project.id];
    
    if (savedKey) {
      // Try to navigate directly with the saved key
      // We still want to verify it if possible, or just trust the local cache for UX
      // For now, let's trust the localStorage and verify "on-the-fly" at the destination if needed
      // or we can verify it right here silently. 
      // Instruction says: "if add one time access success then don't not ask again"
      navigate(`/projects/${project.id}`);
      return;
    }

    setVerifyingProject(project);
    setProjectSecret("");
    setIsVerifyModalOpen(true);
  };

  const verifyAndEnter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingProject || !projectSecret) return;
    
    setVerifying(true);
    
    const verifyPromise = axios.post("/api/verify-project-key", {
      location_id: verifyingProject.id,
      secret_key: projectSecret
    }).then((res) => {
      if (res.data.success) {
        // Save to localStorage
        const savedKeys = JSON.parse(localStorage.getItem("project_keys") || "{}");
        savedKeys[verifyingProject.id] = projectSecret;
        localStorage.setItem("project_keys", JSON.stringify(savedKeys));

        setIsVerifyModalOpen(false);
        navigate(`/projects/${verifyingProject.id}`);
        return res.data;
      } else {
        throw new Error(res.data.message || "Wrong key provided");
      }
    });

    toast.promise(verifyPromise, {
      loading: 'Verifying access...',
      success: 'Access Granted',
      error: (err) => err.response?.data?.message || err.message || 'Wrong key provided'
    }).catch(() => {
      // Ignore unhandled promise rejection
    }).finally(() => {
      setVerifying(false);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(`/api/locations/${editingId}`, formData);
      } else {
        await axios.post("/api/locations", formData);
      }
      setIsModalOpen(false);
      fetchProjects();
      if (typeof refreshData === 'function') {
        refreshData("master");
      }
      toast.success("Location saved successfully!");
    } catch (error: any) {
      if (error.response?.status !== 400) {
        console.error("Failed to save location", error);
      }
      toast.error("Failed to save location: " + (error.response?.data?.message || error.message));
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await axios.delete(`/api/locations/${confirmDelete}`);
      setConfirmDelete(null);
      fetchProjects();
      if (typeof refreshData === 'function') {
        refreshData("master");
      }
      toast.success("Location deleted successfully!");
    } catch (error) {
      console.error("Failed to delete location", error);
      toast.error("Failed to delete location");
    }
  };

  const openModal = (project?: any) => {
    if (project) {
      setEditingId(project.id);
      setFormData({ name: project.name });
    } else {
      setEditingId(null);
      setFormData({ name: "" });
    }
    setIsModalOpen(true);
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Projects Overview</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
            />
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Project Name</th>
                <th className="px-6 py-4 text-right">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProjects.map((project) => (
                <tr key={project.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4 font-bold text-slate-900">
                    {project.name}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleProjectEnter(project)}
                      className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg text-xs font-bold border border-slate-200 hover:border-emerald-200 transition-all shadow-sm"
                    >
                      Enter Project
                    </button>
                  </td>
                </tr>
              ))}
              {filteredProjects.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-6 py-12 text-center text-slate-400 italic">
                    No projects found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Grid View */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredProjects.map((project) => (
            <div key={project.id} className="p-4 flex items-center justify-between gap-4 active:bg-slate-50 transition-colors">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 truncate">{project.name}</h3>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter mt-1">Managed Location</p>
              </div>
              <button
                onClick={() => handleProjectEnter(project)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-sm shadow-emerald-100 active:scale-95 transition-all"
              >
                Enter
              </button>
            </div>
          ))}
          {filteredProjects.length === 0 && (
            <div className="p-12 text-center text-slate-400 italic">
              No projects found.
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-900">
                {editingId ? "Edit Location" : "Add Location"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isVerifyModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-bold text-slate-900">
                Access Verification
              </h2>
              <button onClick={() => setIsVerifyModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>
            <form onSubmit={verifyAndEnter} className="p-6 space-y-4">
              <div className="text-center mb-4 text-slate-600 italic">
                Project: <span className="font-bold text-slate-900">{verifyingProject?.name}</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Secret Key *</label>
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="Enter secret key for this project"
                  value={projectSecret}
                  onChange={(e) => setProjectSecret(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsVerifyModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifying}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-bold disabled:opacity-50"
                >
                  {verifying ? "Verifying..." : "Access Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmDelete}
        title="Delete Location"
        message="Are you sure you want to delete this location? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
