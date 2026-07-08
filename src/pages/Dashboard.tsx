import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Users, 
  Laptop, 
  Key, 
  DollarSign, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  Activity,
  Download,
  Box,
  MapPin,
  PieChart,
  BarChart3,
  AlertTriangle,
  Calendar,
  PhoneCall
} from "lucide-react";
import { 
  Chart as ChartJS, 
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title 
} from "chart.js";
import { Doughnut, Bar, Pie } from "react-chartjs-2";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { useData } from "../App";
import { format, parseISO } from "date-fns";
import { downloadFile } from "../utils/downloadHelper";
import LoadingSpinner from "../components/LoadingSpinner";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

export default function Dashboard() {
  const { data, ensureData } = useData();
  const stats = data.stats;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await ensureData("stats");
      try {
        const res = await axios.get("/api/activity-logs?limit=7");
        if (Array.isArray(res.data)) {
          setRecentActivities(res.data);
        } else {
          console.error("Failed to fetch recent activities: non-array format", res.data);
          setRecentActivities([]);
        }
      } catch (error: any) {
        if (error.name !== 'CanceledError' && error.code !== 'ECONNABORTED' && error.message !== 'Request aborted' && error.message !== 'canceled') {
          console.error("Failed to fetch recent activities", error);
        }
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading && !stats) {
    return <LoadingSpinner />;
  }

  const cards = [
    { label: "Total Employees", value: stats?.totalEmployees || 0, icon: Users, color: "bg-blue-500", to: "/employees" },
    { label: "Total Assets", value: stats?.totalAssets || 0, icon: Laptop, color: "bg-emerald-500", to: "/assets?status=All" },
    { label: "Available Assets", value: stats?.availableAssets || 0, icon: CheckCircle, color: "bg-emerald-400", to: "/assets?status=Available" },
    { label: "Assigned Assets", value: stats?.assignedAssets || 0, icon: Box, color: "bg-emerald-600", to: "/assets?status=Assigned" },
    { label: "Total Licenses", value: stats?.totalLicenses || 0, icon: Key, color: "bg-purple-500", to: "/licenses?status=All" },
    { label: "Available Licenses", value: stats?.availableLicenses || 0, icon: CheckCircle, color: "bg-violet-400", to: "/licenses?status=Available" },
    { label: "Assigned Licenses", value: stats?.assignedLicenses || 0, icon: Box, color: "bg-violet-600", to: "/licenses?status=Assigned" },
    { label: "Total Asset Cost", value: `SR ${Number(stats?.totalAssetCost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: DollarSign, color: "bg-amber-400", to: "#cost-distribution" },
    { label: "Total License Cost", value: `SR ${Number(stats?.totalLicenseCost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: DollarSign, color: "bg-amber-500", to: "#cost-distribution" },
    { label: "Total Telecom Cost", value: `SR ${Number(stats?.totalTelecomCost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: PhoneCall, color: "bg-pink-500", to: "/telecom-services" },
    { label: "Total Combined Cost", value: `SR ${Number(stats?.totalCost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: PieChart, color: "bg-amber-600", to: "#cost-distribution" },
  ];

  // Colors for charts
  const colors = [
    "#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f43f5e", "#6366f1"
  ];

  const chartOptions = {
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "right" as const },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleFont: { family: "'Inter', sans-serif", size: 13 },
        bodyFont: { family: "'Inter', sans-serif", size: 13 },
        padding: 12,
        cornerRadius: 8,
        displayColors: true,
        boxPadding: 4,
      }
    },
    hover: {
      mode: 'nearest' as const,
      intersect: true,
      animationDuration: 400,
    },
    animation: {
      duration: 1000,
      easing: 'easeOutQuart' as const
    }
  };

  const barChartOptions = {
    ...chartOptions,
    plugins: { ...chartOptions.plugins, legend: { display: false } },
    scales: { 
      y: { beginAtZero: true, grid: { color: '#f1f5f9' } }, 
      x: { grid: { display: false } } 
    }
  };

  const costChartOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      tooltip: {
        ...chartOptions.plugins.tooltip,
        callbacks: {
          label: function(context: any) {
            let label = context.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null && context.parsed.y !== undefined) {
              label += `SR ${context.parsed.y.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
            } else {
              label += `SR ${context.parsed.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
            }
            return label;
          }
        }
      }
    }
  };

  const costBarChartOptions = {
    ...barChartOptions,
    plugins: {
      ...barChartOptions.plugins,
      legend: { display: true, position: 'bottom' as const },
      tooltip: {
        ...chartOptions.plugins.tooltip,
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null && context.parsed.y !== undefined) {
              label += `SR ${context.parsed.y.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
            }
            return label;
          }
        }
      }
    },
    scales: {
      ...barChartOptions.scales,
      x: { ...barChartOptions.scales.x, stacked: true },
      y: { ...barChartOptions.scales.y, stacked: true }
    }
  };

  const assetsByCategoryData = {
    labels: (Array.isArray(stats?.assetsByCategory) ? stats.assetsByCategory : []).map((c: any) => c.name),
    datasets: [
      {
        label: "Assets",
        data: (Array.isArray(stats?.assetsByCategory) ? stats.assetsByCategory : []).map((c: any) => c.count),
        backgroundColor: colors,
        borderRadius: 4,
      },
    ],
  };

  const assetsByNameLabels = (Array.isArray(stats?.assetsByName) ? stats.assetsByName : []).map((a: any) => a.name);
  const assetsByNameCounts = (Array.isArray(stats?.assetsByName) ? stats.assetsByName : []).map((a: any) => a.count);

  const assetsByNameData = {
    labels: assetsByNameLabels,
    datasets: [
      {
        data: assetsByNameCounts,
        backgroundColor: assetsByNameLabels.map((_: any, i: number) => colors[i % colors.length]),
        borderWidth: 0,
      },
    ],
  };

  const itemsByDepartmentData = {
    labels: (Array.isArray(stats?.costByDepartment) ? stats.costByDepartment : []).map((d: any) => d.name),
    datasets: [
      {
        label: "Assets",
        data: (Array.isArray(stats?.costByDepartment) ? stats.costByDepartment : []).map((d: any) => d.asset_count || 0),
        backgroundColor: "#10b981",
        borderRadius: 4,
      },
      {
        label: "Licenses",
        data: (Array.isArray(stats?.costByDepartment) ? stats.costByDepartment : []).map((d: any) => d.license_count || 0),
        backgroundColor: "#8b5cf6",
        borderRadius: 4,
      },
    ],
  };

  const itemsByLocationData = {
    labels: (Array.isArray(stats?.costByLocation) ? stats.costByLocation : []).map((l: any) => l.name),
    datasets: [
      {
        label: "Assets",
        data: (Array.isArray(stats?.costByLocation) ? stats.costByLocation : []).map((l: any) => l.asset_count || 0),
        backgroundColor: "#3b82f6",
        borderRadius: 4,
      },
      {
        label: "Licenses",
        data: (Array.isArray(stats?.costByLocation) ? stats.costByLocation : []).map((l: any) => l.license_count || 0),
        backgroundColor: "#ec4899",
        borderRadius: 4,
      },
      {
        label: "Telecom",
        data: (Array.isArray(stats?.costByLocation) ? stats.costByLocation : []).map((l: any) => l.telecom_count || 0),
        backgroundColor: "#f59e0b",
        borderRadius: 4,
      },
    ],
  };

  const stackedBarOptions = {
    ...barChartOptions,
    plugins: {
      ...barChartOptions.plugins,
      legend: { display: true, position: 'bottom' as const }
    },
    scales: {
      x: { ...barChartOptions.scales.x, stacked: true },
      y: { ...barChartOptions.scales.y, stacked: true }
    }
  };

  const costDistributionData = {
    labels: ["Assets", "Licenses", "Telecom services"],
    datasets: [
      {
        data: [Number(stats?.totalAssetCost || 0), Number(stats?.totalLicenseCost || 0), Number(stats?.totalTelecomCost || 0)],
        backgroundColor: ["#10b981", "#8b5cf6", "#ec4899"],
        borderWidth: 0,
      },
    ],
  };

  const licensesByCategoryData = {
    labels: (Array.isArray(stats?.licensesByCategory) ? stats.licensesByCategory : []).map((c: any) => c.name),
    datasets: [
      {
        data: (Array.isArray(stats?.licensesByCategory) ? stats.licensesByCategory : []).map((c: any) => c.count),
        backgroundColor: colors,
        borderWidth: 0,
      },
    ],
  };

  const licensesByDepartmentData = {
    labels: (Array.isArray(stats?.licensesByDepartment) ? stats.licensesByDepartment : []).map((d: any) => d.name),
    datasets: [
      {
        label: "Licenses",
        data: (Array.isArray(stats?.licensesByDepartment) ? stats.licensesByDepartment : []).map((d: any) => d.count),
        backgroundColor: "#8b5cf6",
        borderRadius: 4,
      },
    ],
  };

  const licensesByLocationData = {
    labels: (Array.isArray(stats?.licensesByLocation) ? stats.licensesByLocation : []).map((l: any) => l.name),
    datasets: [
      {
        label: "Licenses",
        data: (Array.isArray(stats?.licensesByLocation) ? stats.licensesByLocation : []).map((l: any) => l.count),
        backgroundColor: "#ec4899",
        borderRadius: 4,
      },
    ],
  };

  const costByDepartmentData = {
    labels: (Array.isArray(stats?.costByDepartment) ? stats.costByDepartment : []).map((d: any) => d.name),
    datasets: [
      {
        label: "Asset Cost",
        data: (Array.isArray(stats?.costByDepartment) ? stats.costByDepartment : []).map((d: any) => Number(d.asset_cost || 0)),
        backgroundColor: "#10b981",
        borderRadius: 4,
      },
      {
        label: "License Cost",
        data: (Array.isArray(stats?.costByDepartment) ? stats.costByDepartment : []).map((d: any) => Number(d.license_cost || 0)),
        backgroundColor: "#8b5cf6",
        borderRadius: 4,
      },
    ],
  };

  const costByLocationData = {
    labels: (Array.isArray(stats?.costByLocation) ? stats.costByLocation : []).map((l: any) => l.name),
    datasets: [
      {
        label: "Asset Cost",
        data: (Array.isArray(stats?.costByLocation) ? stats.costByLocation : []).map((l: any) => Number(l.asset_cost || 0)),
        backgroundColor: "#3b82f6",
        borderRadius: 4,
      },
      {
        label: "License Cost",
        data: (Array.isArray(stats?.costByLocation) ? stats.costByLocation : []).map((l: any) => Number(l.license_cost || 0)),
        backgroundColor: "#ec4899",
        borderRadius: 4,
      },
      {
        label: "Telecom Cost",
        data: (Array.isArray(stats?.costByLocation) ? stats.costByLocation : []).map((l: any) => Number(l.telecom_cost || 0)),
        backgroundColor: "#f59e0b",
        borderRadius: 4,
      },
    ],
  };

  const costOfAvailableData = {
    labels: ["Available Assets", "Available Licenses"],
    datasets: [
      {
        data: [
          Number(stats?.costOfAvailable?.available_assets_cost || 0), 
          Number(stats?.costOfAvailable?.available_licenses_cost || 0)
        ],
        backgroundColor: ["#10b981", "#8b5cf6"],
        borderWidth: 0,
      },
    ],
  };

  const licenseUsageData = {
    labels: ["Assigned", "Available"],
    datasets: [
      {
        data: [stats?.assignedLicenses || 0, stats?.availableLicenses || 0],
        backgroundColor: ["#8b5cf6", "#cbd5e1"],
        borderWidth: 0,
      },
    ],
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Overview of Homes Contracting Company Assets & IT Infrastructure.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
          <button
            onClick={() => downloadFile('/api/export/dashboard', 'dashboard_report.csv')}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-emerald-200 transition-all shadow-sm w-full sm:w-auto"
          >
            <Download className="w-4 h-4" />
            Export Cost Report
          </button>
          <div className="flex gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider items-center">
            <Activity className="w-4 h-4" />
            <span>System Live</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 bg-transparent gap-4">
        {cards.map((card, idx) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05, duration: 0.4 }}
          >
            <Link
              to={card.to}
              onClick={(e) => {
                if (card.to.startsWith('#')) {
                  e.preventDefault();
                  document.getElementById(card.to.substring(1))?.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="group bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-emerald-200 transition-all duration-300 relative overflow-hidden block h-full"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <p className="text-xs font-medium text-slate-500">{card.label}</p>
                  <h3 className="text-xl font-bold mt-1 text-slate-900">{card.value}</h3>
                </div>
                <div className={`${card.color} p-2 rounded-xl text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <card.icon className="w-5 h-5" />
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Recent Activity Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-500" />
            Recent Activity
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider min-w-[150px]">Item Name</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider min-w-[120px]">Action</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider min-w-[100px]">User</th>
                <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right min-w-[100px]">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {Array.isArray(recentActivities) && recentActivities.length > 0 ? (
                recentActivities.map((log, idx) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">
                          {(!log.entity_name || log.entity_name === "null") ? "—" : log.entity_name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium tracking-tight">
                          {log.entity_type} • {(!log.entity_identity || log.entity_identity === "null") ? "—" : log.entity_identity}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-col">
                        <span className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                          log.action === 'Add' ? 'text-emerald-700 bg-emerald-50' : 
                          log.action === 'Delete' ? 'text-rose-700 bg-rose-50' : 
                          log.action === 'Update' ? 'text-blue-700 bg-blue-50' :
                          'text-slate-700 bg-slate-100'
                        }`}>
                          {log.action}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-1 line-clamp-1">{log.details}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-xs font-medium text-slate-600">
                      {log.user_name}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className="text-xs font-medium text-slate-500 bg-slate-100/50 px-2 py-1 rounded-lg">
                        {log.created_at ? format(parseISO(log.created_at), "MMM d, HH:mm") : "—"}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-sm italic">
                    No recent activities found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets by Name */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
        >
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-blue-500" />
            Assets by Name
          </h3>
          <div className="h-[250px] flex items-center justify-center">
            {assetsByNameLabels.length > 0 ? (
              <Doughnut 
                data={assetsByNameData} 
                options={chartOptions} 
              />
            ) : (
              <p className="text-slate-400 text-sm">No assets found.</p>
            )}
          </div>
        </motion.div>

        {/* Assets by Category */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
        >
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-500" />
            Assets by Category
          </h3>
          <div className="h-[250px]">
            {stats?.assetsByCategory?.length > 0 ? (
              <Bar 
                data={assetsByCategoryData} 
                options={barChartOptions} 
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-slate-400 text-sm">No asset categories found.</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Items by Location */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
        >
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-500" />
            Items by Location
          </h3>
          <div className="h-[250px]">
            {stats?.costByLocation?.length > 0 ? (
              <Bar 
                data={itemsByLocationData} 
                options={stackedBarOptions} 
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-slate-400 text-sm">No location data found.</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Items by Department */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
        >
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-500" />
            Items by Department
          </h3>
          <div className="h-[250px]">
            {stats?.costByDepartment?.length > 0 ? (
              <Bar 
                data={itemsByDepartmentData} 
                options={stackedBarOptions} 
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-slate-400 text-sm">No department data found.</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Cost Distribution */}
        <motion.div 
          id="cost-distribution" 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
        >
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-500" />
            Cost Distribution
          </h3>
          <div className="h-[250px] flex items-center justify-center">
            <Pie 
              data={costDistributionData} 
              options={costChartOptions} 
            />
          </div>
        </motion.div>

        {/* License Usage */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
        >
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Key className="w-5 h-5 text-violet-500" />
            License Usage
          </h3>
          <div className="h-[250px] flex items-center justify-center">
            {(stats?.totalLicenses || 0) > 0 ? (
              <Doughnut 
                data={licenseUsageData} 
                options={{ ...chartOptions, cutout: "70%" }} 
              />
            ) : (
              <p className="text-slate-400 text-sm">No licenses found.</p>
            )}
          </div>
          <div className="mt-4 flex justify-around text-sm">
            <div className="text-center">
              <p className="text-slate-500">Assigned</p>
              <p className="font-bold text-violet-600">{stats?.assignedLicenses || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-500">Available</p>
              <p className="font-bold text-slate-400">{stats?.availableLicenses || 0}</p>
            </div>
          </div>
        </motion.div>

        {/* License by Category */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
        >
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-violet-500" />
            License by Category
          </h3>
          <div className="h-[250px] flex items-center justify-center">
            {stats?.licensesByCategory?.length > 0 ? (
              <Doughnut 
                data={licensesByCategoryData} 
                options={chartOptions} 
              />
            ) : (
              <p className="text-slate-400 text-sm">No license categories found.</p>
            )}
          </div>
        </motion.div>


        {/* Cost by Department */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
        >
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-500" />
            Cost by Department
          </h3>
          <div className="h-[250px]">
            {stats?.costByDepartment?.length > 0 ? (
              <Bar 
                data={costByDepartmentData} 
                options={costBarChartOptions} 
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-slate-400 text-sm">No department data found.</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Cost by Location */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
        >
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-500" />
            Cost by Location
          </h3>
          <div className="h-[250px]">
            {stats?.costByLocation?.length > 0 ? (
              <Bar 
                data={costByLocationData} 
                options={costBarChartOptions} 
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-slate-400 text-sm">No location data found.</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Cost of Available Assets and Licenses */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
        >
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-500" />
            Cost of Available Items
          </h3>
          <div className="h-[250px] flex items-center justify-center">
            {(stats?.costOfAvailable?.available_assets_cost > 0 || stats?.costOfAvailable?.available_licenses_cost > 0) ? (
              <Pie 
                data={costOfAvailableData} 
                options={costChartOptions} 
              />
            ) : (
              <p className="text-slate-400 text-sm">No available items with logged costs found.</p>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
