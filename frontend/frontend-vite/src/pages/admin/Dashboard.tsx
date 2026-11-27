import { useEffect, useState } from "react";
import { Users, Car, Clock, IndianRupee, Receipt, Banknote, Smartphone, CheckCircle2, RefreshCw } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { DashboardAPI } from "../../services/api";

interface PeriodSummary { customers: number; revenue: string; tips: string; service_revenue: string; manual_revenue: string; }
interface Summary {
  total_customers: number;
  total_requests: number;
  pending_requests: number;
  billed_requests: number;
  total_revenue: string;
  total_tips: string;
  total_service_revenue: string;
  total_manual_revenue: string;
  total_manual_visits: number;
  paid_invoices: number;
  unpaid_invoices: number;
  awaiting_payment_selection: number;
  pending_payment_requests: number;
  pending_cash_payments: number;
  pending_upi_payments: number;
  daily: PeriodSummary;
  weekly: PeriodSummary;
  monthly: PeriodSummary;
}
interface ChartItem { name: string; value: number; }
interface Charts { services: ChartItem[]; request_status: ChartItem[]; payment_status: ChartItem[]; payment_methods: ChartItem[]; }
const colors = ["#0EA5E9", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#14B8A6"];
const statusColors: Record<string, string> = { Paid: "#22C55E", Unpaid: "#F59E0B", "Awaiting Confirmation": "#F97316" };
const money = (value: string | number) => Number(value).toLocaleString("en-IN", { style: "currency", currency: "INR" });

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [charts, setCharts] = useState<Charts | null>(null);
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    DashboardAPI.getSummary().then(({ data }) => { if (active) setSummary(data.data); }).catch(() => { if (active) toast.error("Unable to load summary"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  useEffect(() => {
    let active = true;
    setCharts(null);
    DashboardAPI.getCharts(period).then(({ data }) => { if (active) setCharts(data); }).catch(() => { if (active) toast.error("Unable to load charts"); });
    return () => { active = false; };
  }, [period, refresh]);

  const cards = [
    { title: "Total Customers", value: summary?.total_customers, icon: Users },
    { title: "Total Requests", value: summary?.total_requests, icon: Car },
    { title: "Pending Requests", value: summary?.pending_requests, icon: Clock },
    { title: "Total Revenue (Including Tips)", value: summary ? money(summary.total_revenue) : undefined, icon: IndianRupee },
    { title: "Service Revenue", value: summary ? money(summary.total_service_revenue) : undefined, icon: IndianRupee },
    { title: "Total Tips Received", value: summary ? money(summary.total_tips) : undefined, icon: Banknote },
    { title: "Manual Revenue (Included in Total)", value: summary ? money(summary.total_manual_revenue) : undefined, icon: IndianRupee },
    { title: "Manual Service Visits", value: summary?.total_manual_visits, icon: Car },
  ];
  const paymentCards = [
    { title: "Outstanding Bills", value: summary?.unpaid_invoices, icon: Receipt },
    { title: "Waiting for Selection", value: summary?.awaiting_payment_selection, icon: Clock },
    { title: "Payment Requests", value: summary?.pending_payment_requests, icon: Receipt },
    { title: "Pending Cash", value: summary?.pending_cash_payments, icon: Banknote },
    { title: "Pending UPI", value: summary?.pending_upi_payments, icon: Smartphone },
    { title: "Closed Bills", value: summary?.paid_invoices, icon: CheckCircle2 },
  ];
  const chartCards = [
    { title: "Popular Services", data: charts?.services || [] },
    { title: "Request Status", data: charts?.request_status || [] },
    { title: "Payment Status", data: charts?.payment_status || [] },
    { title: "Revenue by Payment Method", data: charts?.payment_methods || [] },
  ];

  return <div>
    <div className="flex justify-between flex-wrap items-center gap-3"><h1 className="page-title">Dashboard Overview</h1><button className="secondary-btn flex gap-2 items-center" disabled={loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={18}/> Refresh</button></div>
    <p className="text-slate-500 mt-2 mb-6">Monitor your car wash business performance.</p>
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{cards.map(({ title, value, icon: Icon }) => <div key={title} className="card"><div className="bg-sky-100 text-sky-700 w-12 h-12 rounded-xl flex items-center justify-center"><Icon/></div><p className="text-slate-500 mt-4">{title}</p><h2 className="text-3xl font-bold mt-2">{value ?? "—"}</h2></div>)}</div>
    <div className="flex justify-between flex-wrap gap-3 items-center mt-7 mb-4"><h2 className="text-xl font-bold">Payment Overview</h2><Link to="/admin/billing" className="secondary-btn">Manage Payments</Link></div>
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">{paymentCards.map(({ title, value, icon: Icon }) => <div key={title} className="card flex items-center gap-4"><div className="bg-sky-100 text-sky-700 rounded-xl w-12 h-12 flex items-center justify-center"><Icon/></div><div><p className="text-slate-500 text-sm">{title}</p><h3 className="text-2xl font-bold">{value ?? "—"}</h3></div></div>)}</div>
    <p className="text-xs text-slate-500 mt-3">Revenue includes confirmed invoice payments and admin-recorded received amounts. Manual revenue and tips are already included in the total. Manual entries use their service date.</p>
    <div className="grid md:grid-cols-3 gap-4 mt-6">{(["daily", "weekly", "monthly"] as const).map(item => <div key={item} className="card"><h3 className="capitalize font-bold">{item} Performance</h3><p className="mt-3 text-slate-600">Customers: {summary?.[item].customers ?? "—"}</p><p className="text-sky-700 font-bold text-xl mt-2">{summary ? money(summary[item].revenue) : "—"}</p><div className="border-t mt-3 pt-3 space-y-2 text-sm"><p className="flex justify-between"><span>Service Revenue</span><span className="font-semibold">{summary ? money(summary[item].service_revenue) : "—"}</span></p><p className="flex justify-between"><span>Manual Revenue (Included)</span><span className="font-semibold">{summary ? money(summary[item].manual_revenue) : "—"}</span></p><p className="flex justify-between text-green-700"><span>Tips Received</span><span className="font-bold">{summary ? money(summary[item].tips) : "—"}</span></p></div></div>)}</div>
    <div className="flex flex-wrap justify-between items-center gap-4 my-7"><h2 className="text-2xl font-bold">Analytics</h2><div className="flex gap-2">{(["daily", "weekly", "monthly"] as const).map(item => <button key={item} onClick={() => setPeriod(item)} className={`px-4 py-2 rounded-lg capitalize ${period === item ? "bg-sky-600 text-white" : "bg-white border border-slate-200"}`}>{item}</button>)}</div></div>
    <div className="grid lg:grid-cols-2 gap-5">{chartCards.map(({ title, data }) => <div key={title} className="card min-w-0"><h3 className="font-bold mb-5">{title}</h3>{data.length ? <ResponsiveContainer width="100%" height={300}><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>{data.map((item, index) => <Cell key={item.name} fill={title === "Payment Status" ? statusColors[item.name] || colors[index % colors.length] : colors[index % colors.length]}/>)}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer> : <div className="h-72 flex items-center justify-center text-slate-500">No data available</div>}</div>)}</div>
  </div>;
}
