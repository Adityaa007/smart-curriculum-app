import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import useTitle from "../hooks/useTitle";
import { createSectionTransaction } from "../lib/transactions";
import { Layers, Plus, Copy, Users } from "lucide-react";

export default function TeacherSections() {
  useTitle("Manage Sections");
  const { userProfile, currentUser } = useAuth();
  
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Form parsing
  const [form, setForm] = useState({ name: "", year: new Date().getFullYear(), branch: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "sections"), where("createdBy", "==", currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      // Sort by creation date safely inside react state
      let docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
      setSections(docs);
      setLoading(false);
    });
    return unsub;
  }, [currentUser]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name || !form.branch) return setError("Name and Branch are required.");
    setError("");
    setCreating(true);
    try {
      await createSectionTransaction({
        name: form.name.toUpperCase(),
        year: form.year,
        branch: form.branch.toUpperCase(),
        createdBy: currentUser.uid,
        teacherName: userProfile.name
      });
      setForm({ name: "", year: new Date().getFullYear(), branch: "" });
    } catch (err) {
      setError(err.message || "Failed to create section");
    } finally {
      setCreating(false);
    }
  }

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(""), 2000);
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
       <div className="mb-8">
         <div className="flex items-center gap-2 mb-1">
           <span className="badge bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">Admin</span>
         </div>
         <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
           <Layers className="text-indigo-400" /> Manage Sections
         </h1>
         <p className="text-slate-400 text-sm mt-1">Create classrooms and generate global Join Codes for your students.</p>
       </div>

       {/* Create Section Form */}
       <div className="glass-card p-6 mb-10 relative overflow-hidden" style={{ border: "1px solid rgba(99,102,241,0.2)"}}>
         <div className="absolute -right-20 -top-20 w-48 h-48 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none"></div>
         
         <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest mb-4 flex items-center gap-2">
           <Plus size={18} className="text-indigo-400" /> Deploy New Section
         </h2>
         
         {error && <div className="text-red-400 text-xs mb-3 p-3 bg-red-400/10 border border-red-400/20 rounded-xl">{error}</div>}
         
         <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-4 items-end relative z-10">
           <div className="w-full sm:flex-1">
             <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Section Name</label>
             <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. CS-A" className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl text-slate-200 p-3.5 focus:ring-2 focus:ring-indigo-500/40 outline-none transition-all" />
           </div>
           <div className="w-full sm:flex-1">
             <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Branch</label>
             <input value={form.branch} onChange={e => setForm({...form, branch: e.target.value})} placeholder="e.g. CSE" className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl text-slate-200 p-3.5 focus:ring-2 focus:ring-indigo-500/40 outline-none transition-all" />
           </div>
           <div className="w-full sm:w-24">
             <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Year</label>
             <input type="number" value={form.year} onChange={e => setForm({...form, year: e.target.value})} className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl text-slate-200 p-3.5 focus:ring-2 focus:ring-indigo-500/40 outline-none transition-all" />
           </div>
           <button disabled={creating} type="submit" className="w-full sm:w-auto bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-[0_4px_15px_rgba(99,102,241,0.2)] hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 text-sm uppercase tracking-wider">
             {creating ? "Creating..." : "Create"}
           </button>
         </form>
       </div>

       {/* List Sections */}
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {loading ? <p className="text-slate-400 col-span-full">Loading sections...</p> : sections.length === 0 ? <p className="text-slate-500 col-span-full">No active sections deployed yet.</p> : null}
         {sections.map(sec => (
           <div key={sec.id} className="glass-card p-6 relative overflow-hidden transition-all duration-300 hover:border-white/[0.1] hover:-translate-y-1">
             
             <div className="flex justify-between items-start mb-6">
               <div>
                 <h3 className="text-xl font-bold text-slate-100">{sec.name}</h3>
                 <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">{sec.branch} · {sec.year}</p>
               </div>
               
               <div className="text-right">
                 <p className="text-[9px] font-black text-indigo-400/80 uppercase tracking-[0.2em] mb-1.5">Join Code</p>
                 <div 
                   onClick={() => handleCopy(sec.joinCode)}
                   className="flex items-center gap-2 bg-indigo-500/10 text-indigo-300 px-3 py-1.5 rounded-lg border border-indigo-500/20 cursor-pointer hover:bg-indigo-500/20 transition-all group"
                 >
                   <span className="font-mono font-bold tracking-widest text-sm">{sec.joinCode}</span>
                   {copied === sec.joinCode ? (
                       <span className="text-emerald-400 text-xs font-bold w-4 h-4 flex items-center justify-center">✓</span>
                   ) : (
                       <Copy size={14} className="text-indigo-400/50 group-hover:text-indigo-300" />
                   )}
                 </div>
               </div>
             </div>
             
             <div className="flex items-center justify-between pt-4 border-t border-white/[0.05]">
                <div className="flex items-center gap-2 text-slate-300 text-xs font-semibold">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center border border-white/[0.05]">
                    <Users size={16} className="text-slate-400"/>
                  </div>
                  <div>
                    <span className="text-slate-100 font-bold">{sec.rollNumberCounter > 1 ? sec.rollNumberCounter - 1 : 0}</span> Enrolled Students
                  </div>
                </div>
             </div>
           </div>
         ))}
       </div>
    </div>
  );
}
