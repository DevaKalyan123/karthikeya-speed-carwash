import { useEffect, useState } from "react";
import { AdminAPI, InvoiceAPI, PaymentAPI } from "../../services/api";
import { toast } from "react-toastify";
import axios from "axios";
import { RefreshCw, Trash2 } from "lucide-react";

interface Bill {
  request_id: number;
  invoice_id: number;
  invoice_number: string;
  customer_name: string;
  subtotal: string;
  discount_amount: string;
  service_amount: string;
  tip_amount: string;
  total_amount: string;
  payment_status: string;
  requested_payment_method: string | null;
  payment_method: string | null;
  payment_requested_at: string | null;
  balance_amount: string;
  paid_amount: string;
  transaction_id: string | null;
}

const money = (value: string | number) => Number(value).toLocaleString("en-IN", { style: "currency", currency: "INR" });
const discountText = (value: string) => Number(value) > 0 ? `- ${money(value)}` : "No Discount";
const labelMethod = (value: string | null) => value === "UPI" ? "PhonePe / UPI" : value || "Not selected";
const errorMessage = (error: unknown, fallback: string) => axios.isAxiosError(error) ? error.response?.data?.message || fallback : fallback;
const toPaise = (value: string) => /^\d+(\.\d{1,2})?$/.test(value) && Number(value) <= 9999999999.99 ? Math.round(Number(value) * 100) : NaN;

export default function Billing() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [selected, setSelected] = useState<Bill | null>(null);
  const [amount, setAmount] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState("All");

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data } = await AdminAPI.getInvoices();
      setBills(data.data);
    } catch { setLoadError(true); toast.error("Unable to load bills"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const pay = async () => {
    if (!selected || saving) return;
    const method = selected.requested_payment_method;
    if (method !== "Cash" && method !== "UPI") { toast.error("Invalid payment method"); return; }
    const received = toPaise(amount);
    if (!Number.isFinite(received) || received <= 0 || received !== toPaise(selected.balance_amount)) {
      toast.error(`Received amount must equal ${money(selected.balance_amount)}`);
      return;
    }
    if (method === "UPI" && !transactionId.trim()) { toast.error("UPI transaction reference is required"); return; }
    setSaving(true);
    try {
      await PaymentAPI.pay(selected.invoice_id, { payment_method: method, amount: (received / 100).toFixed(2), transaction_id: method === "UPI" ? transactionId.trim() : undefined });
      toast.success("Payment confirmed and bill closed");
      setSelected(null);
      await load();
    } catch (error) { toast.error(errorMessage(error, "Payment could not be recorded")); }
    finally { setSaving(false); }
  };

  const reject = async () => {
    if (!selected || saving || !window.confirm("Reject this selection? The customer can select a payment method again.")) return;
    setSaving(true);
    try {
      await PaymentAPI.reject(selected.invoice_id);
      toast.success("Payment request rejected");
      setSelected(null);
      await load();
    } catch (error) { toast.error(errorMessage(error, "Unable to reject payment")); }
    finally { setSaving(false); }
  };

  const deleteBill = async (bill: Bill) => {
    if (saving || loading || loadError) return;
    if (!window.confirm(`Remove ${bill.invoice_number} from billing and revenue? Original financial records will be retained. This does not issue a refund.`)) return;
    setSaving(true);
    try {
      await AdminAPI.deleteInvoice(bill.invoice_id);
      setBills(previous => previous.filter(item => item.invoice_id !== bill.invoice_id));
      setSelected(null);
      toast.success("Bill removed. Dashboard revenue updated.");
      await load();
    } catch (error) {
      toast.error(errorMessage(error, "Unable to delete bill"));
      await load();
    } finally { setSaving(false); }
  };

  const deleteAll = async () => {
    if (saving || loading || loadError || !bills.length) return;
    const confirmation = window.prompt(`Remove ALL ${bills.length} generated bills, including bills outside the selected filter? Manual revenue and customer records will stay. No refunds are issued. Type DELETE ALL to confirm.`);
    if (confirmation !== "DELETE ALL") return;
    setSaving(true);
    try {
      const { data } = await AdminAPI.deleteAllInvoices(bills.map(bill => bill.invoice_id));
      setBills([]);
      setSelected(null);
      setFilter("All");
      toast.success(`${data.deleted_count} bills removed. Manual revenue preserved.`);
      await load();
    } catch (error) {
      toast.error(errorMessage(error, "Unable to delete all bills"));
      await load();
    } finally { setSaving(false); }
  };

  const download = async (bill: Bill) => {
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
    } catch { toast.error("Download failed"); }
  };

  const visible = bills.filter(bill => filter === "All" || bill.payment_status === filter);
  return <div>
    <div className="flex flex-wrap justify-between items-center gap-3 mb-6"><h1 className="page-title">Billing & Payments</h1><div className="flex flex-wrap gap-2"><button className="secondary-btn flex items-center gap-2" onClick={load} disabled={loading || saving}><RefreshCw size={18}/> Refresh</button><button className="flex items-center gap-2 rounded-xl px-4 py-3 bg-red-600 text-white font-semibold disabled:opacity-50" disabled={loading || saving || loadError || !bills.length} onClick={deleteAll}><Trash2 size={18}/> Delete All Bills</button></div></div>
    <p className="text-xs text-slate-500 mb-4">Deleting generated bills removes them from active billing and dashboard revenue. Manual revenue stays unchanged. Original payment records are retained; no refund is issued.</p>
    <div className="flex flex-wrap gap-2 mb-5">{["All", "Unpaid", "Awaiting Confirmation", "Paid"].map(status => <button key={status} onClick={() => setFilter(status)} className={`px-4 py-2 rounded-xl font-semibold text-sm ${filter === status ? "bg-sky-600 text-white" : "bg-white border border-slate-200"}`}>{status === "Awaiting Confirmation" ? "Payment Requests" : status} ({bills.filter(b => status === "All" || b.payment_status === status).length})</button>)}</div>
    <div className="card overflow-x-auto">
      {loading ? <p>Loading invoices...</p> : loadError ? <p className="text-red-600">Unable to load invoices. Please refresh.</p> : <table className="data-table">
        <thead><tr><th>Invoice</th><th>Customer</th><th>Subtotal</th><th>Discount</th><th>Service Amount</th><th>Tips</th><th>Final Amount</th><th>Payment Method</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{visible.map(bill => <tr key={bill.invoice_id}>
          <td>{bill.invoice_number}</td><td>{bill.customer_name}</td><td>{money(bill.subtotal)}</td><td className="text-green-700 font-semibold">{discountText(bill.discount_amount)}</td><td>{money(bill.service_amount)}</td><td className="text-green-700 font-semibold">{money(bill.tip_amount)}</td><td className="font-bold text-sky-700">{money(bill.total_amount)}</td>
          <td>{bill.payment_status === "Paid" && Number(bill.total_amount) === 0 ? "No Payment Required" : labelMethod(bill.payment_method || bill.requested_payment_method)}</td>
          <td><span className={`px-3 py-1 rounded-full text-xs font-semibold ${bill.payment_status === "Paid" ? "bg-green-100 text-green-700" : bill.payment_status === "Awaiting Confirmation" ? "bg-orange-100 text-orange-700" : "bg-amber-100 text-amber-700"}`}>{bill.payment_status === "Paid" ? "Paid / Closed" : bill.payment_status}</span></td>
          <td><div className="flex gap-2 flex-wrap">{bill.payment_status === "Awaiting Confirmation" && <button className="primary-btn" disabled={saving} onClick={() => { setSelected(bill); setAmount(""); setTransactionId(""); }}>Verify & Close Bill</button>}{bill.payment_status === "Unpaid" && <span className="text-sm text-slate-500">Waiting for customer selection</span>}{bill.payment_status === "Paid" && <button className="secondary-btn" disabled={saving} onClick={() => download(bill)}>PDF</button>}<button className="text-red-600 border border-red-200 rounded-xl px-3 py-2 font-semibold flex items-center gap-1 hover:bg-red-50 disabled:opacity-50" disabled={saving || loading || loadError} onClick={() => deleteBill(bill)}><Trash2 size={16}/> Delete</button></div></td>
        </tr>)}</tbody>
      </table>}
      {!loading && !loadError && !visible.length && <p className="py-5">No bills available.</p>}
    </div>
    {selected && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-auto" role="dialog" aria-modal="true" aria-label="Confirm payment">
        <h2 className="text-xl font-bold mb-2">Verify Payment & Close Bill</h2><p className="text-sm text-slate-500 mb-4">{selected.invoice_number} · {selected.customer_name}</p>
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 space-y-3 mb-5"><div className="flex justify-between"><span>Subtotal</span><span>{money(selected.subtotal)}</span></div><div className="flex justify-between text-green-700"><span>Discount</span><span>{discountText(selected.discount_amount)}</span></div><div className="flex justify-between"><span>Service Amount</span><span>{money(selected.service_amount)}</span></div><div className="flex justify-between text-green-700"><span>Customer Tip</span><span>{money(selected.tip_amount)}</span></div><div className="flex justify-between font-semibold"><span>Final Bill (Including Tips)</span><span>{money(selected.total_amount)}</span></div><div className="flex justify-between border-t border-sky-200 pt-3 font-bold"><span>Outstanding Balance</span><span className="text-sky-700">{money(selected.balance_amount)}</span></div></div>
        <label className="field-label" htmlFor="method">Customer Selected Method</label><input id="method" className="form-input bg-slate-50" value={labelMethod(selected.requested_payment_method)} readOnly />
        <label className="field-label mt-4" htmlFor="received">Received Amount (₹)</label><input id="received" className="form-input" type="number" min="0.01" step="0.01" placeholder="Enter actual received amount" value={amount} disabled={saving} onChange={e => setAmount(e.target.value)} />
        {selected.requested_payment_method === "UPI" && <><label className="field-label mt-4" htmlFor="reference">UPI Transaction Reference</label><input id="reference" className="form-input" maxLength={100} value={transactionId} disabled={saving} onChange={e => setTransactionId(e.target.value)} placeholder="Verified transaction ID"/><p className="mt-2 text-xs text-amber-700">Manual UPI verification only. Confirm only after checking the actual received payment.</p></>}
        <div className="flex flex-wrap gap-3 mt-6"><button disabled={saving} className="primary-btn" onClick={pay}>{saving ? "Saving..." : "Confirm & Close Bill"}</button><button disabled={saving} className="secondary-btn" onClick={() => setSelected(null)}>Cancel</button><button disabled={saving} className="text-red-700 text-sm font-semibold" onClick={reject}>Reject Request</button></div>
      </div>
    </div>}
  </div>;
}
