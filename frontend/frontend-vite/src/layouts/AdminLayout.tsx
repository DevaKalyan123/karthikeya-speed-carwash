import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, ClipboardList, Users, Receipt, LogOut, Menu, X, Settings, Wrench, KeyRound, UserCog } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/logo.png";

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const links = [
    { name: "Dashboard", to: "/admin", icon: LayoutDashboard },
    { name: "Requests", to: "/admin/requests", icon: ClipboardList },
    { name: "Customers", to: "/admin/customers", icon: Users },
    { name: "Billing", to: "/admin/billing", icon: Receipt },
    { name: "Services", to: "/admin/services", icon: Wrench },
    { name: "Management Staff", to: "/admin/management-staff", icon: UserCog },
    { name: "Password Reset Requests", to: "/admin/password-reset-requests", icon: KeyRound },
    { name: "Settings", to: "/admin/settings", icon: Settings },
  ];
  return <div className="min-h-screen bg-slate-50">
    {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setOpen(false)}/>}
    <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-950 text-white overflow-y-auto transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="p-5 bg-white relative"><img src={logo} alt="Karthikeya Speed" className="w-full"/><button onClick={() => setOpen(false)} aria-label="Close menu" className="absolute right-2 top-2 text-slate-700 lg:hidden"><X size={20}/></button></div>
      <nav className="p-4 space-y-2">
        {links.map(({ name, to, icon: Icon }) => <NavLink key={to} to={to} end={to === "/admin"} onClick={() => setOpen(false)} className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${isActive ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-800"}`}><Icon size={20} className="shrink-0"/><span>{name}</span></NavLink>)}
        <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl"><LogOut size={20}/> Logout</button>
      </nav>
    </aside>
    <main className="lg:ml-64 min-w-0"><header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-4 flex justify-between items-center"><button className="lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}><Menu/></button><h2 className="font-bold text-lg">Admin Portal</h2><div className="flex items-center gap-3"><div className="hidden sm:flex w-10 h-10 rounded-full bg-sky-100 text-sky-700 items-center justify-center font-bold">{user?.name?.charAt(0).toUpperCase() || "A"}</div><div className="text-right"><p className="font-semibold">{user?.name}</p><p className="text-xs text-slate-500">Administrator</p></div></div></header><div className="p-4 md:p-7"><Outlet/></div></main>
  </div>;
}
