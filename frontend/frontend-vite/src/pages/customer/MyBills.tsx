import { useEffect, useState } from "react";
import { Download, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "react-toastify";
import { InvoiceAPI } from "../../services/api";

interface Invoice {
  invoice_id: number;
  invoice_number: string;
  car_name: string;
  car_make?: string;
  customer_name?: string;
  mobile?: string;
  car_number: string;
  subtotal: string;
  discount_amount: string;
  service_amount: string;
  tip_amount: string;
  total_amount: string;
  payment_status: string;
  payment_method: string;
  transaction_id: string | null;
  paid_at: string | null;
  created_at: string;
  services: { service_name: string; amount: string | null }[];
}

const money = (value: string | null) => value == null ? "—" : Number(value).toLocaleString("en-IN", { style: "currency", currency: "INR" });

export default function MyBills() {
  const [bills, setBills] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const { data } = await InvoiceAPI.getMyInvoices();
      setBills((data.data as Invoice[]).filter(bill => bill.payment_status === "Paid"));
    } catch {
      setError(true);
      toast.error("Unable to load bills");
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const download = async (bill: Invoice) => {
    if (downloading !== null) return;
    setDownloading(bill.invoice_id);
    try {
      const { data } = await InvoiceAPI.download(bill.invoice_id);
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${bill.invoice_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { toast.error("PDF download failed"); }
    finally { setDownloading(null); }
  };

  return <div>
    <div className="flex justify-between items-center gap-3 mb-6"><h1 className="page-title">My Bills</h1><button className="secondary-btn flex items-center gap-2" disabled={loading} onClick={load}><RefreshCw size={18} /> Refresh</button></div>
    <p className="text-slate-500 mb-5">Completed payments and final invoices.</p>
    {loading && <p>Loading bills...</p>}
    {!loading && error && <p className="text-red-600">Unable to load bills. Please refresh.</p>}
    <div className="grid md:grid-cols-2 gap-5">
      {bills.map(bill => <div key={bill.invoice_id} className="card">
        <div className="flex justify-between flex-wrap gap-2"><h2 className="font-bold">{bill.invoice_number}</h2><span className="bg-green-100 text-green-700 rounded-full px-3 py-1 text-xs font-semibold flex gap-1 items-center"><CheckCircle2 size={14}/> Paid / Closed</span></div>
        <p className="mt-4 font-semibold">{bill.car_make || bill.car_name}</p><p className="text-slate-500">{bill.car_number}</p>
        {bill.customer_name && <p className="text-sm text-slate-600 mt-2">{bill.customer_name} {bill.mobile ? `· ${bill.mobile}` : ""}</p>}
        <div className="border-t mt-4 pt-4 space-y-2">
          {bill.services?.map((service, index) => <div key={index} className="flex justify-between gap-2 text-sm"><span>{service.service_name}</span><span>{money(service.amount)}</span></div>)}
        </div>
        <div className="bg-sky-50 rounded-xl p-4 mt-4 space-y-3">
          <div className="flex justify-between"><span>Subtotal</span><span>{money(bill.subtotal)}</span></div>
          <div className="flex justify-between text-green-700"><span>Discount</span><span>{Number(bill.discount_amount) > 0 ? `- ${money(bill.discount_amount)}` : "No Discount"}</span></div>
          <div className="flex justify-between"><span>Service Amount</span><span>{money(bill.service_amount)}</span></div>
          <div className="flex justify-between text-green-700"><span>Tips</span><span>{money(bill.tip_amount)}</span></div>
          <div className="flex justify-between font-bold text-xl border-t border-sky-200 pt-3"><span>Final Paid Amount</span><span className="text-sky-700">{money(bill.total_amount)}</span></div>
        </div>
        <div className="text-sm space-y-2 mt-4 text-slate-600"><p>Payment Method: {bill.payment_method === "UPI" ? "PhonePe / UPI" : bill.payment_method || "—"}</p>{bill.transaction_id && <p>Transaction ID: {bill.transaction_id}</p>}{bill.paid_at && <p>Paid on: {new Date(bill.paid_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>}</div>
        <button onClick={() => download(bill)} disabled={downloading !== null} className="primary-btn mt-5 flex items-center gap-2"><Download size={18} /> {downloading === bill.invoice_id ? "Downloading..." : "Download Bill"}</button>
      </div>)}
    </div>
    {!loading && !error && !bills.length && <p>No completed bills yet. Your invoice will appear here after admin confirms payment.</p>}
  </div>;
}
