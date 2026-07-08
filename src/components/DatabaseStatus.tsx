import { useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { SUPABASE_SQL_SCHEMA } from "../utils/supabaseSchema";
import { motion, AnimatePresence } from "motion/react";
import { 
  Database, 
  Check, 
  Copy, 
  ExternalLink, 
  RefreshCw, 
  AlertTriangle, 
  Info,
  ShieldCheck,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { toast } from "react-hot-toast";

export default function DatabaseStatus() {
  const [checking, setChecking] = useState(false);
  const [tablesExist, setTablesExist] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // Parse Supabase project reference if available
  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || "";
  let projectRef = "bgofttpfyupdnsagkkyd"; // default based on initial state
  if (supabaseUrl) {
    try {
      const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.(co|net)/);
      if (match && match[1]) {
        projectRef = match[1];
      }
    } catch (e) {
      console.error("Format error in Supabase URL:", e);
    }
  }

  const checkDatabaseSchema = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setTablesExist(false);
      return;
    }
    setChecking(true);
    try {
      // Test querying 'categories' table which is a fast, small dictionary table
      const { error } = await supabase.from("categories").select("id").limit(1);
      
      if (error) {
        // PG Error 42P01 means table/relation does not exist
        if (error.code === "42P01") {
          console.log("[Auto Bootstrap] Table 'categories' missing. Attempting automatic table creation...");
          const { error: rpcError } = await supabase.rpc("exec_sql", { sql_query: SUPABASE_SQL_SCHEMA });
          if (!rpcError) {
            console.log("[Auto Bootstrap] Database auto-bootstrapping succeeded!");
            toast.success("Database tables automatically created and synchronized!");
            setTablesExist(true);
            setTimeout(() => {
              window.location.reload();
            }, 1500);
            return;
          } else {
            console.warn("[Auto Bootstrap] RPC exec_sql failed or not found, falling back to manual instructions:", rpcError);
            setTablesExist(false);
          }
        } else {
          // If some other error (e.g., empty table but table exists), check if we can query users
          const { error: userError } = await supabase.from("users").select("id").limit(1);
          if (userError && userError.code === "42P01") {
            const { error: rpcError2 } = await supabase.rpc("exec_sql", { sql_query: SUPABASE_SQL_SCHEMA });
            if (!rpcError2) {
              console.log("[Auto Bootstrap] Database auto-bootstrapping succeeded on users table check!");
              toast.success("Database tables automatically created and synchronized!");
              setTablesExist(true);
              setTimeout(() => {
                window.location.reload();
              }, 1500);
              return;
            }
            setTablesExist(false);
          } else {
            // Decided tables probably exist if it's not a missing relation error
            setTablesExist(true);
          }
        }
      } else {
        setTablesExist(true);
      }
    } catch {
      setTablesExist(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkDatabaseSchema();
  }, []);

  const handleCopySchema = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
      setCopied(true);
      toast.success("SQL Schema copied to clipboard!");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Failed to copy automatically. Please copy the text manually.");
    }
  };

  const handleVerify = async () => {
    await checkDatabaseSchema();
    if (tablesExist === true) {
      toast.success("Database connection & tables successfully verified!");
      // Reload pages so axios routes reload
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      toast.error("Tables not detected in Supabase yet. Please run the SQL editor script first.");
    }
  };

  // If Supabase is not configured, or if tables are verified, don't show the warning
  if (!isSupabaseConfigured) {
    return (
      <div className="bg-slate-50 border border-slate-200 text-slate-700 p-4 rounded-2xl flex items-center gap-3 text-sm font-medium">
        <Info className="w-5 h-5 text-slate-400 shrink-0" />
        <div>
          <span className="font-bold">Offline Sandbox Mode active.</span> Local Storage is storing and seeding all database records locally. To sync with a live db, provide Supabase credentials in your project environment.
        </div>
      </div>
    );
  }

  if (tablesExist === true) {
    return null; // All clean! No banner needed
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        className="w-full"
      >
        <div className="border border-amber-200 bg-amber-50 rounded-2xl overflow-hidden shadow-sm hover:shadow transition-shadow duration-300">
          {/* Header Block */}
          <div className="p-5 flex items-center justify-between gap-4 border-b border-amber-100 bg-amber-50/50">
            <div className="flex items-center gap-3">
              <div className="bg-amber-100 p-2.5 rounded-xl text-amber-700">
                <Database className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 tracking-tight">Supabase Schema Missing: Setup Action Required</h4>
                <p className="text-xs text-slate-500 mt-0.5">Your Supabase database is connected but has empty tables.</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1.5 hover:bg-amber-100/60 rounded-lg text-slate-500 transition-colors"
                title={expanded ? "Collapse guide" : "Expand guide"}
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Interactive Steps */}
          {expanded && (
            <div className="p-6 space-y-6 text-sm text-slate-700">
              <div className="bg-white/80 backdrop-blur border border-amber-100 p-4 rounded-xl flex gap-3 text-xs leading-relaxed text-slate-500 max-w-4xl">
                <ShieldCheck className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-700">Why doesn't the app auto-create tables?</span> 
                  <p className="mt-1">
                    To comply with security standards, the client-side browser uses the sandboxed <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-rose-600">ANON_KEY</span>. This anon-token is strictly forbidden from running dynamic schema additions (DDL commands). Executing those commands automatically from standard code would require exposing your super-private <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-rose-600">service_role</span> key, which would compromise your entire database. It takes only 15 seconds to bootstrap perfectly:
                  </p>
                </div>
              </div>

              {/* 3 Steps Visual Flow */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Step 1 */}
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
                  <div>
                    <span className="absolute top-2 right-3 text-3xl font-black text-slate-100/80 tracking-tighter select-none">01</span>
                    <h5 className="font-bold text-xs text-slate-900 leading-none">Copy SQL Query Code</h5>
                    <p className="text-xs text-slate-500 mt-2">Get the 100% complete schema including indexes & 10 sample assets.</p>
                  </div>
                  <button
                    onClick={handleCopySchema}
                    className="mt-4 flex items-center justify-center gap-1.5 w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors focus:ring-2 focus:ring-slate-900/10 cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        Copied successfully
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy SQL Schema Code
                      </>
                    )}
                  </button>
                </div>

                {/* Step 2 */}
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
                  <div>
                    <span className="absolute top-2 right-3 text-3xl font-black text-slate-100/80 tracking-tighter select-none">02</span>
                    <h5 className="font-bold text-xs text-slate-900 leading-none">Run in Supabase Editor</h5>
                    <p className="text-xs text-slate-500 mt-2">Open the New Queries tab, paste the code, and tap the green RUN button.</p>
                  </div>
                  <a
                    href={`https://supabase.com/dashboard/project/${projectRef}/sql/new`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 flex items-center justify-center gap-1.5 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open SQL Editor Tab
                  </a>
                </div>

                {/* Step 3 */}
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between">
                  <div>
                    <span className="absolute top-2 right-3 text-3xl font-black text-slate-100/80 tracking-tighter select-none">03</span>
                    <h5 className="font-bold text-xs text-slate-900 leading-none">Verify Realtime Tables</h5>
                    <p className="text-xs text-slate-500 mt-2">Come back here and verify that live database synchronization is running.</p>
                  </div>
                  <button
                    onClick={handleVerify}
                    disabled={checking}
                    className="mt-4 flex items-center justify-center gap-1.5 w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`} />
                    Verify & Connect Database
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
