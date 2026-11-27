import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import axios from "axios";
import { CalendarDays, Clock, CheckCircle2, RefreshCw, Banknote, Smartphone, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { RequestAPI, PaymentAPI } from "../../services/api";
import type { AppointmentDetails, PaymentMethod } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

interface RequestData extends AppointmentDetails {
  request_id: number;
  car_name: string;
  car_make?: string;
  customer_name: string;
  mobile: string;
  booking_source?: string;
  car_number: string;
  status: string;
  created_at: string;
  can_delete?: boolean;
  invoice_id: number | null;
  invoice_number: string | null;
  subtotal: string | null;
  discount_amount: string | null;
  service_amount: string | null;
  tip_amount: string | null;
  total_amount: string | null;
  payment_status: string | null;
  requested_payment_method: PaymentMethod | null;
  services: { service_id: number; service_name: string; amount: string | null; price?: string | null }[];
}

const money = (value: string | number | null) => value == null ? "—" : Number(value).toLocaleString("en-IN", { style: "currency", currency: "INR" });
const toPaise = (value: string) => /^\d+(\.\d{1,2})?$/.test(value) && Number(value) <= 9999999999.99 ? Math.round(Number(value) * 100) : NaN;
const tipPaise = (value: string) => value.trim() === "" ? 0 : toPaise(value.trim());
const formatDate = (value: string | null) => value ? value.split("-").reverse().join("/") : "Not scheduled";
const formatTime = (value: string | null) => {
  if (!value) return "—";
  const [hours, minutes] = value.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
};
const statusClass = (status: string) => {
  switch (status) {
    case "Confirmed": return "bg-green-100 text-green-700";
    case "Reschedule Requested": return "bg-orange-100 text-orange-700";
    case "Cancelled": return "bg-red-100 text-red-700";
    default: return "bg-sky-100 text-sky-700";
  }
};

export default function MyRequests() {
  const { user } = useAuth();
  const isManagement = user?.role === "management";
  const base = isManagement ? "/management" : "/customer";
  const [requests, setRequests] = useState<RequestData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectingId, setSelectingId] = useState<number | null>(null);
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [methods, setMethods] = useState<Record<number, PaymentMethod>>({});
  const [tips, setTips] = useState<Record<number, string>>({});
  const [cancelTarget, setCancelTarget] = useState<RequestData | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data } = await RequestAPI.getMyRequests();
      setRequests(data.data);
    } catch {
      setLoadError(true);
      toast.error("Unable to load requests");
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const deleteRequest = async (req: RequestData) => {
    if (isManagement || !req.can_delete || deletingId !== null || loading || cancelling || selectingId !== null || paymentId !== null) return;
    if (!window.confirm("Remove this old request from My Requests? Your paid invoice and service history will remain saved.")) return;
    setDeletingId(req.request_id);
    try {
      const { data } = await RequestAPI.deleteMyRequest(req.request_id);
      setRequests(previous => previous.filter(item => item.request_id !== req.request_id));
      toast.success(data.message || "Request removed");
    } catch (error) {
      toast.error(axios.isAxiosError(error) ? error.response?.data?.message || "Unable to remove request" : "Unable to remove request");
      await load();
    } finally { setDeletingId(null); }
  };

  const cancel = async () => {
    if (!cancelTarget || cancelling) return;
    setCancelling(true);
    try {
      const { data } = await RequestAPI.cancel(cancelTarget.request_id, cancelReason.trim() || undefined);
      setRequests(previous => previous.map(req => req.request_id === cancelTarget.request_id ? { ...req, ...data } : req));
      setCancelTarget(null);
      toast.success(data.message || "Request cancelled");
      await load();
    } catch (error) {
      toast.error(axios.isAxiosError(error) ? error.response?.data?.message || "Unable to cancel request" : "Unable to cancel request");
    } finally { setCancelling(false); }
  };

  const selectSlot = async (requestId: number, slotId: number) => {
    if (selectingId !== null) return;
    setSelectingId(slotId);
    try {
      const { data } = await RequestAPI.selectSlot(requestId, slotId);
      toast.success(data.message);
      await load();
    } catch (error) {
      toast.error(axios.isAxiosError(error) ? error.response?.data?.message || "Unable to select slot" : "Unable to select slot");
    } finally { setSelectingId(null); }
  };

  const submitPayment = async (invoiceId: number) => {
    if (paymentId !== null || !methods[invoiceId]) return;
    const req = requests.find(item => item.invoice_id === invoiceId);
    if (!req || req.payment_status !== "Unpaid") return;
    const tip = tipPaise(tips[invoiceId] ?? "");
    const service = toPaise(req.service_amount ?? "");
    if (!Number.isFinite(tip) || !Number.isFinite(service) || tip + service > 999999999999) {
      toast.error("Enter a valid optional tip with up to two decimal places");
      return;
    }
    setPaymentId(invoiceId);
    try {
      const { data } = await PaymentAPI.selectMethod(invoiceId, methods[invoiceId], (tip / 100).toFixed(2));
      toast.success(data.message || "Payment request sent to admin");
      setTips(previous => { const next = { ...previous }; delete next[invoiceId]; return next; });
      setMethods(previous => { const next = { ...previous }; delete next[invoiceId]; return next; });
      await load();
    } catch (error) {
      toast.error(axios.isAxiosError(error) ? error.response?.data?.message || "Unable to submit payment request" : "Unable to submit payment request");
    } finally { setPaymentId(null); }
  };

  return (
    <div>
      <div className="flex justify-between items-center gap-3 mb-6">
        <h1 className="page-title">{isManagement ? "My Customer Bookings" : "My Service Requests"}</h1>
        <button className="secondary-btn flex items-center gap-2" onClick={load} disabled={loading || paymentId !== null || selectingId !== null || cancelling || deletingId !== null}>
          <RefreshCw size={18} /> Refresh
        </button>
      </div>
      {!isManagement && <p className="text-sm text-slate-500 mb-5">Cancelled, paid or bill-deleted requests can be removed from your list after 24 hours. Your paid bills and service history stay saved.</p>}
      {loading && <p>Loading requests...</p>}
      {!loading && loadError && <p className="text-red-600">Unable to load requests. Please refresh.</p>}
      <div className="grid lg:grid-cols-2 gap-5">
        {requests.map((req) => {
          const id = req.invoice_id;
          const isUnpaid = req.payment_status === "Unpaid";
          const draftTip = id === null ? "" : tips[id] ?? "";
          const service = toPaise(req.service_amount ?? "");
          const tip = tipPaise(draftTip);
          const validTip = Number.isFinite(tip) && Number.isFinite(service) && service + tip <= 999999999999;
          const previewTotal = validTip ? (service + tip) / 100 : null;
          return (
          <div key={req.request_id} className="card">
            <div className="flex flex-wrap justify-between gap-3">
              <h2 className="text-xl font-bold">{req.car_make || req.car_name}</h2>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusClass(req.appointment_status)}`}>
                {req.appointment_status === "Pending" ? "Pending Approval" : req.appointment_status}
              </span>
            </div>
            <p className="text-slate-500 mt-2">{req.car_number}</p>
            {(req.customer_name || req.mobile) && <p className="text-sm text-slate-600 mt-1">{[req.customer_name, req.mobile].filter(Boolean).join(" · ")}</p>}
            {req.booking_source === "Management" && <p className="text-xs text-sky-700 font-semibold mt-2">Staff-assisted booking</p>}
            <div className="bg-slate-50 rounded-xl p-4 mt-5 space-y-3">
              <div className="flex items-center gap-3"><CalendarDays size={20} className="text-sky-600" /> {formatDate(req.appointment_date)}</div>
              {(req.confirmed_start_time || req.preferred_start_time) && <div className="flex items-center gap-3"><Clock size={20} className="text-sky-600" />
                {formatTime(req.confirmed_start_time || req.preferred_start_time)}{(req.confirmed_end_time || req.preferred_end_time) && ` - ${formatTime(req.confirmed_end_time || req.preferred_end_time)}`}
              </div>}
              {req.appointment_status === "Not Scheduled" && <p className="text-sm text-sky-700">{req.appointment_date || req.preferred_start_time ? "Partial appointment details saved. Request submitted to admin." : "No appointment selected. Request submitted to admin."}</p>}
              {req.appointment_status === "Confirmed" && <div className="flex gap-2 text-green-700 text-sm font-semibold"><CheckCircle2 size={18} /> Your appointment is confirmed.</div>}
              {req.appointment_status === "Pending" && <p className="text-sm text-amber-700">Waiting for admin approval.</p>}
              {req.status === "Cancelled" && <div className="text-sm text-red-700"><p className="font-semibold">Cancelled{req.cancelled_by ? ` by ${req.cancelled_by}` : ""}</p>{req.cancellation_reason && <p>{req.cancellation_reason}</p>}</div>}
            </div>

            {req.status !== "Cancelled" && req.appointment_status === "Reschedule Requested" && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mt-5">
                <h3 className="font-bold text-orange-800">Alternative Time Slots</h3>
                <p className="text-sm text-orange-700 mt-1">Your requested time is unavailable. Select an alternative appointment.</p>
                <div className="space-y-3 mt-4">
                  {req.appointment_slots.map((slot) => {
                    const start = slot.start_time.length === 5 ? `${slot.start_time}:00` : slot.start_time;
                    const time = new Date(`${slot.appointment_date}T${start}+05:30`).getTime();
                    const expired = !Number.isFinite(time) || time <= Date.now();
                    return <div key={slot.id} className="bg-white border border-orange-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
                      <div><p className="font-semibold">{formatDate(slot.appointment_date)}</p><p className="text-sm text-slate-600">{formatTime(slot.start_time)} - {formatTime(slot.end_time)}</p></div>
                      <button className="primary-btn" disabled={selectingId !== null || expired || loading || loadError} onClick={() => selectSlot(req.request_id, slot.id)}>{expired ? "Expired" : selectingId === slot.id ? "Selecting..." : "Select Slot"}</button>
                    </div>;
                  })}
                  {!req.appointment_slots.length && <p className="text-sm">Waiting for new alternative slots.</p>}
                </div>
              </div>
            )}

            <div className="border-t border-slate-200 mt-5 pt-4 space-y-3">
              <h3 className="font-semibold">Selected Services</h3>
              {req.services.map((service) => <div key={service.service_id} className="flex justify-between gap-3 text-sm"><span>{service.service_name}</span><span className="font-semibold">{service.amount != null ? money(service.amount) : service.price != null ? `From ${money(service.price)}` : "Pending"}</span></div>)}
            </div>
            <p className="text-sm text-slate-500 mt-5">Billing Status: {req.status}</p>
            {!isManagement && req.can_delete && <button type="button" className="mt-4 inline-flex gap-2 items-center rounded-xl px-4 py-3 border border-red-200 text-red-700 font-semibold hover:bg-red-50 disabled:opacity-50" disabled={deletingId !== null || loading || loadError || cancelling || selectingId !== null || paymentId !== null} onClick={() => deleteRequest(req)}><Trash2 size={17} /> {deletingId === req.request_id ? "Removing..." : "Delete Request"}</button>}
            {req.can_cancel && req.status !== "Cancelled" && <button type="button" className="mt-4 rounded-xl px-4 py-3 border border-red-200 text-red-700 font-semibold hover:bg-red-50 disabled:opacity-50" disabled={loading || loadError || cancelling || selectingId !== null || paymentId !== null} onClick={() => { setCancelTarget(req); setCancelReason(""); }}>Cancel Request</button>}

            {req.invoice_id !== null && (
              <div className="mt-5 border border-sky-200 bg-sky-50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between gap-2"><h3 className="font-bold">Bill Summary</h3><span className="text-xs text-slate-500">{req.invoice_number}</span></div>
                <div className="flex justify-between"><span>Subtotal</span><span>{money(req.subtotal)}</span></div>
                <div className="flex justify-between text-green-700"><span>Discount</span><span>{Number(req.discount_amount) > 0 ? `- ${money(req.discount_amount)}` : "No Discount"}</span></div>
                <div className="flex justify-between"><span>Service Amount</span><span>{money(req.service_amount)}</span></div>
                {isUnpaid && id !== null ? <div className="space-y-2"><label htmlFor={`tip-${id}`} className="field-label">Tips (Optional)</label><input id={`tip-${id}`} className="form-input bg-white" type="text" inputMode="decimal" placeholder="0.00" value={draftTip} disabled={paymentId !== null || loading || loadError} onChange={e => setTips(previous => ({ ...previous, [id]: e.target.value }))}/><div className="flex flex-wrap gap-2">{["0", "20", "50", "100"].map(value => <button key={value} type="button" disabled={paymentId !== null || loading || loadError} onClick={() => setTips(previous => ({ ...previous, [id]: value }))} className={`rounded-lg px-3 py-2 border text-sm ${tip === Number(value) * 100 ? "bg-sky-100 border-sky-600" : "bg-white border-slate-200"}`}>{value === "0" ? "No Tip" : `₹${value}`}</button>)}</div><p className="text-xs text-slate-600">Tips are voluntary. Leave blank or select No Tip.</p>{!validTip && <p className="text-xs text-red-600">Enter a valid amount with up to two decimal places.</p>}</div> : <div className="flex justify-between"><span>Tips</span><span>{money(req.tip_amount)}</span></div>}
                <div className="flex justify-between border-t border-sky-200 pt-3 font-bold text-lg"><span>{req.payment_status === "Paid" ? "Final Paid Amount" : "Total Payable"}</span><span className="text-sky-700">{money(isUnpaid ? previewTotal : req.total_amount)}</span></div>
                {req.payment_status === "Unpaid" && <div className="space-y-3 border-t border-sky-200 pt-3">
                  <p className="font-semibold">Select Payment Method</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["Cash", "UPI"] as const).map((method) => {
                      const id = req.invoice_id!;
                      const Icon = method === "Cash" ? Banknote : Smartphone;
                      return <button key={method} type="button" aria-pressed={methods[id] === method} disabled={paymentId !== null || loading || loadError} onClick={() => setMethods(prev => ({ ...prev, [id]: method }))} className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold ${methods[id] === method ? "border-sky-600 bg-sky-100 text-sky-800" : "bg-white border-slate-200"}`}><Icon size={18} />{method === "UPI" ? "PhonePe / UPI" : "Cash"}</button>;
                    })}
                  </div>
                  <p className="text-xs text-slate-600">{methods[req.invoice_id] === "UPI" ? "Manual UPI mode: this sends a request only. Online payment is not yet integrated." : "Pay at the service center. Admin will confirm the received payment."}</p>
                  <button className="primary-btn w-full" disabled={!validTip || !methods[req.invoice_id] || paymentId !== null || loading || loadError} onClick={() => submitPayment(req.invoice_id!)}>{paymentId === req.invoice_id ? "Submitting..." : "Send Payment Request"}</button>
                </div>}
                {req.payment_status === "Awaiting Confirmation" && <div className="bg-amber-100 text-amber-800 p-3 rounded-lg text-sm"><p className="font-semibold">Awaiting Admin Confirmation</p><p>Selected: {req.requested_payment_method === "UPI" ? "PhonePe / UPI" : req.requested_payment_method}</p><p className="mt-1">Your bill will close after payment is verified. Refresh to check status.</p></div>}
                {req.payment_status === "Paid" && <div className="bg-green-100 text-green-800 rounded-lg p-3 text-sm"><p className="font-semibold flex gap-2"><CheckCircle2 size={18} /> Bill Closed</p><Link to={`${base}/bills`} className="underline font-semibold">View invoice in My Bills</Link></div>}
              </div>
            )}
          </div>
        ); })}
      </div>
      {!loading && !loadError && !requests.length && <p>No service requests yet.</p>}
      {cancelTarget && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"><div role="dialog" aria-modal="true" aria-label="Cancel appointment" className="bg-white rounded-2xl p-6 w-full max-w-md"><h2 className="text-xl font-bold">Cancel Appointment?</h2><p className="text-slate-600 mt-3">Cancel your appointment for {cancelTarget.car_make || cancelTarget.car_name} ({cancelTarget.car_number})?</p><label className="field-label mt-4" htmlFor="customer-cancel-reason">Reason (optional)</label><textarea id="customer-cancel-reason" className="form-input" rows={3} maxLength={250} value={cancelReason} disabled={cancelling} onChange={e => setCancelReason(e.target.value)} /><div className="flex gap-3 mt-5"><button onClick={cancel} disabled={cancelling} className="bg-red-600 text-white rounded-xl px-4 py-3 font-semibold disabled:opacity-50">{cancelling ? "Cancelling..." : "Confirm Cancellation"}</button><button onClick={() => setCancelTarget(null)} disabled={cancelling} className="secondary-btn">Keep Appointment</button></div></div></div>}
    </div>
  );
}
