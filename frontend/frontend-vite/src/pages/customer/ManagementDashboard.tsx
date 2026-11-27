import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Car, ClipboardList, Receipt, Clock } from "lucide-react";
import { RequestAPI, InvoiceAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";

export default function ManagementDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<{ total: number; pending: number; bills: number } | null>(null);
  useEffect(() => {
    let active = true;
    Promise.all([RequestAPI.getMyRequests(), InvoiceAPI.getMyInvoices()]).then(([requests, bills]) => {
      if (!active) return;
      const rows = requests.data.data as { status: string }[];
      setStats({ total: rows.length, pending: rows.filter(row => row.status === "Pending").length, bills: bills.data.data.length });
    }).catch(() => { if (active) toast.error("Unable to load booking summary"); });
    return () => { active = false; };
  }, []);
  return <div className="space-y-6">
    <div><h1 className="page-title">Welcome, {user?.name}</h1><p className="text-slate-500 mt-2">Management portal — book services on behalf of walk-in customers.</p></div>
    <div className="grid sm:grid-cols-3 gap-4">
      {[{ label: "My Bookings", value: stats?.total, icon: ClipboardList }, { label: "Pending Requests", value: stats?.pending, icon: Clock }, { label: "Completed Bills", value: stats?.bills, icon: Receipt }].map(({ label, value, icon: Icon }) => <div key={label} className="card"><Icon className="text-sky-600"/><p className="mt-3 text-slate-600">{label}</p><p className="text-3xl font-bold mt-2">{value ?? "—"}</p></div>)}
    </div>
    <div className="card space-y-4"><h2 className="text-xl font-bold">Walk-in Customer Booking</h2><p className="text-slate-600">Enter the customer's own contact and vehicle information. No customer login is required.</p><div className="flex flex-wrap gap-3"><Link className="primary-btn flex gap-2 items-center" to="/management/book"><Car size={18}/> Book Service</Link><Link className="secondary-btn" to="/management/requests">My Requests</Link><Link className="secondary-btn" to="/management/bills">My Bills</Link></div></div>
  </div>;
}
