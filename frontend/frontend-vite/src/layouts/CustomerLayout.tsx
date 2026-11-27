import { NavLink, Outlet } from "react-router-dom";
import { Home, Car, ClipboardList, Receipt, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/logo.png";

export default function CustomerLayout() {
  const { user, logout } = useAuth();
  const management = user?.role === "management";
  const base = management ? "/management" : "/customer";
  const links = [
    { title: "Home", to: base, icon: Home },
    { title: "Book Service", to: `${base}/book`, icon: Car },
    { title: "My Requests", to: `${base}/requests`, icon: ClipboardList },
    { title: "My Bills", to: `${base}/bills`, icon: Receipt },
  ];
  return <div className="min-h-screen bg-slate-50">
    <header className="bg-white border-b border-slate-200 px-4 md:px-10 py-4 flex items-center justify-between"><img src={logo} alt="Logo" className="w-36 md:w-48"/><div className="flex items-center gap-3"><div className="text-right"><span className="font-semibold block">{user?.name}</span>{management && <span className="text-xs text-sky-700 font-semibold">Management Staff</span>}</div><button onClick={logout} aria-label="Logout" className="p-3 rounded-xl bg-red-50 text-red-600"><LogOut size={20}/></button></div></header>
    <nav className="bg-white flex justify-around md:justify-center md:gap-8 border-b border-slate-200">{links.map(({ title, to, icon: Icon }) => <NavLink key={to} to={to} end={to === base} className={({ isActive }) => `flex flex-col md:flex-row items-center gap-2 px-3 py-4 text-xs md:text-sm font-medium ${isActive ? "text-sky-600 border-b-2 border-sky-500" : "text-slate-500"}`}><Icon size={21}/>{title}</NavLink>)}</nav>
    <main className="max-w-7xl mx-auto p-4 md:p-8"><Outlet/></main>
  </div>;
}
