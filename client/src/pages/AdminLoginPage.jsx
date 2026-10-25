import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

function AdminLoginPage() {
  const { login } = useAuth(); const navigate = useNavigate(); const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [error,setError]=useState("");const [loading,setLoading]=useState(false);
  const submit=async(event)=>{event.preventDefault();setError("");setLoading(true);try{await login({email,password,rememberMe:true});navigate("/",{replace:true});}catch(e){setError(e.message||"Sign in failed");}finally{setLoading(false);}};
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4"><form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-8"><h1 className="text-2xl font-bold text-white">WorkCloud Admin</h1><label className="block text-sm text-slate-300">Email<input className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-white" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="block text-sm text-slate-300">Password<input className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-white" type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p role="alert" className="text-sm text-rose-400">{error}</p>}<button disabled={loading} className="w-full rounded-lg bg-indigo-600 p-3 font-semibold text-white">{loading?"Signing in…":"Sign in"}</button></form></main>;
}
export default AdminLoginPage;
