import { useEffect, useState } from "react";
import {
  AdminAPI,
} from "../../services/api";
import type {
  AppointmentDetails,
  SlotInput,
} from "../../services/api";
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  Plus,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { toast } from "react-toastify";
import axios from "axios";
interface RequestData extends AppointmentDetails {
  request_id: number;
  customer_name: string;
  mobile: string;
  village: string;
  car_name: string;
  car_make?: string;
  booking_source?: string;
  booked_by_name?: string | null;
  car_number: string;
  status: string;
  services: {
    service_id: number;
    service_name: string;
    price: string | null;
    amount: string | null;
  }[];
}
const validMoney = (value: string) =>
  /^\d+(\.\d{1,2})?$/.test(value) &&
  Number(value) <= 9999999999.99;
const toPaise = (value: string) =>
  validMoney(value)
    ? Math.round(Number(value) * 100)
    : 0;
const formatMoney = (paise: number) =>
  (paise / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
  });
const getToday = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());
const formatDate = (value: string | null) => {
  if (!value) return "Not scheduled";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};
const formatTime = (value: string | null) => {
  if (!value) return "—";
  const [hours, minutes] = value.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${
    hours >= 12 ? "PM" : "AM"
  }`;
};
const statusClass = (status: string) => {
  switch (status) {
    case "Confirmed":
      return "bg-green-100 text-green-700";
    case "Reschedule Requested":
      return "bg-orange-100 text-orange-700";
    case "Cancelled":
      return "bg-red-100 text-red-700";
    default:
      return "bg-sky-100 text-sky-700";
  }
};
export default function Requests() {
  const [requests, setRequests] =
    useState<RequestData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // Invoice States
  const [selected, setSelected] =
    useState<RequestData | null>(null);
  const [amounts, setAmounts] =
    useState<Record<number, string>>({});
  const [discount, setDiscount] = useState("");
  const [saving, setSaving] = useState(false);
  const [openingId, setOpeningId] =
    useState<number | null>(null);
  // Appointment States
  const [appointmentRequest, setAppointmentRequest] =
    useState<RequestData | null>(null);
  const [slots, setSlots] =
    useState<SlotInput[]>([]);
  const [appointmentSaving, setAppointmentSaving] =
    useState(false);
  const [confirmingId, setConfirmingId] =
    useState<number | null>(null);
  const [filter, setFilter] = useState("All");
  const [cancelTarget, setCancelTarget] = useState<RequestData | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data } = await AdminAPI.getRequests(
        "Pending"
      );
      setRequests((data.data as RequestData[]).filter(req => req.status !== "Cancelled" && req.appointment_status !== "Cancelled"));
    } catch {
      setLoadError(true);
      toast.error("Unable to load requests");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const cancel = async () => {
    if (!cancelTarget || cancelling) return;
    setCancelling(true);
    try {
      const { data } = await AdminAPI.cancelRequest(cancelTarget.request_id, cancelReason.trim() || undefined);
      setRequests(previous => previous.filter(req => req.request_id !== cancelTarget.request_id));
      setCancelTarget(null);
      toast.success(data.message || "Request cancelled");
      await load();
    } catch (error) {
      toast.error(axios.isAxiosError(error) ? error.response?.data?.message || "Unable to cancel request" : "Unable to cancel request");
    } finally { setCancelling(false); }
  };
  // ==========================================
  // ACCEPT APPOINTMENT
  // ==========================================
  const acceptAppointment = async (
    requestId: number
  ) => {
    if (confirmingId !== null) return;
    setConfirmingId(requestId);
    try {
      const { data } =
        await AdminAPI.acceptAppointment(requestId);
      toast.success(data.message);
      await load();
    } catch (error) {
      toast.error(
        axios.isAxiosError(error)
          ? error.response?.data?.message ||
              "Unable to confirm appointment"
          : "Unable to confirm appointment"
      );
    } finally {
      setConfirmingId(null);
    }
  };
  // ==========================================
  // OPEN SUGGEST SLOTS MODAL
  // ==========================================
  const openSuggestSlots = (
    req: RequestData
  ) => {
    setAppointmentRequest(req);
    setSlots([
      {
        appointment_date:
          req.appointment_date &&
          req.appointment_date >= getToday()
            ? req.appointment_date
            : getToday(),
        start_time: "",
        end_time: "",
      },
    ]);
  };
  const updateSlot = (
    index: number,
    field: keyof SlotInput,
    value: string
  ) => {
    setSlots((previous) =>
      previous.map((slot, i) =>
        i === index
          ? { ...slot, [field]: value }
          : slot
      )
    );
  };
  const addSlot = () => {
    if (slots.length >= 10) {
      toast.error("Maximum 10 time slots allowed");
      return;
    }
    setSlots((previous) => [
      ...previous,
      {
        appointment_date:
          previous[previous.length - 1]?.appointment_date ||
          getToday(),
        start_time: "",
        end_time: "",
      },
    ]);
  };
  const removeSlot = (index: number) => {
    setSlots((previous) =>
      previous.filter((_, i) => i !== index)
    );
  };
  // ==========================================
  // SUBMIT ALTERNATIVE SLOTS
  // ==========================================
  const submitSlots = async () => {
    if (!appointmentRequest || appointmentSaving) return;
    if (!slots.length) {
      toast.error("Add at least one time slot");
      return;
    }
    for (const slot of slots) {
      if (
        !slot.appointment_date ||
        !slot.start_time ||
        !slot.end_time
      ) {
        toast.error("Enter all slot details");
        return;
      }
      if (slot.end_time <= slot.start_time) {
        toast.error(
          "End time must be after start time"
        );
        return;
      }
      const start = new Date(
        `${slot.appointment_date}T${slot.start_time}:00+05:30`
      );
      if (
        !Number.isFinite(start.getTime()) ||
        start.getTime() <= Date.now()
      ) {
        toast.error("Select future time slots");
        return;
      }
    }
    const uniqueSlots = new Set(
      slots.map((slot) =>
        `${slot.appointment_date}-${slot.start_time}-${slot.end_time}`
      )
    );
    if (uniqueSlots.size !== slots.length) {
      toast.error("Duplicate time slots are not allowed");
      return;
    }
    setAppointmentSaving(true);
    try {
      const { data } = await AdminAPI.suggestSlots(
        appointmentRequest.request_id,
        slots
      );
      toast.success(data.message);
      setAppointmentRequest(null);
      setSlots([]);
      await load();
    } catch (error) {
      toast.error(
        axios.isAxiosError(error)
          ? error.response?.data?.message ||
              "Unable to suggest slots"
          : "Unable to suggest slots"
      );
    } finally {
      setAppointmentSaving(false);
    }
  };
  // ==========================================
  // OPEN INVOICE
  // ==========================================
  const openInvoice = async (requestId: number) => {
    setOpeningId(requestId);
    try {
      const { data } = await AdminAPI.getRequest(
        requestId
      );
      const req: RequestData = data.data;
      if (
        req.status !== "Pending" ||
        !["Confirmed", "Not Scheduled"].includes(
          req.appointment_status
        )
      ) {
        toast.error("Confirm appointment before generating invoice");
        await load();
        return;
      }
      const initialAmounts: Record<number, string> = {};
      req.services.forEach((service) => {
        initialAmounts[service.service_id] =
          service.amount ?? service.price ?? "";
      });
      setAmounts(initialAmounts);
      setDiscount("");
      setSelected(req);
    } catch {
      toast.error("Unable to load service prices");
    } finally {
      setOpeningId(null);
    }
  };
  const subtotal = Object.values(amounts).reduce(
    (sum, value) => sum + toPaise(value),
    0
  );
  const discountAmount = toPaise(discount);
  const finalAmount = subtotal - discountAmount;
  // ==========================================
  // GENERATE INVOICE
  // ==========================================
  const generate = async () => {
    if (!selected || saving) return;
    const services = selected.services.map((item) => ({
      service_id: item.service_id,
      amount: amounts[item.service_id] ?? "",
    }));
    if (
      services.some(
        (item) => !validMoney(item.amount)
      )
    ) {
      toast.error("Enter valid amounts for all services");
      return;
    }
    if (subtotal > 999999999999) {
      toast.error("Subtotal exceeds allowed limit");
      return;
    }
    if (
      discount !== "" &&
      !validMoney(discount)
    ) {
      toast.error("Enter a valid discount amount");
      return;
    }
    if (discountAmount > subtotal) {
      toast.error("Discount cannot exceed subtotal");
      return;
    }
    setSaving(true);
    try {
      await AdminAPI.generateInvoice(
        selected.request_id,
        {
          services,
          discount_amount:
            (discountAmount / 100).toFixed(2),
        }
      );
      toast.success("Invoice generated successfully");
      setSelected(null);
      setAmounts({});
      setDiscount("");
      await load();
    } catch (error) {
      toast.error(
        axios.isAxiosError(error)
          ? error.response?.data?.message ||
              "Invoice generation failed"
          : "Invoice generation failed"
      );
    } finally {
      setSaving(false);
    }
  };
  const filteredRequests = requests.filter(
    (req) =>
      filter === "All" ||
      req.appointment_status === filter
  );
  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <div>
          <h1 className="page-title">
            Service Requests
          </h1>
          <p className="text-slate-500 mt-2">
            Manage appointments and generate customer invoices.
          </p>
        </div>
        <button
          className="secondary-btn flex gap-2 items-center"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          "All",
          "Pending",
          "Reschedule Requested",
          "Confirmed",
          "Not Scheduled",
        ].map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold ${
              filter === item
                ? "bg-sky-600 text-white"
                : "bg-white border border-slate-200"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      {loading && <p>Loading requests...</p>}
      {!loading && loadError && (
        <p className="text-red-600">
          Unable to load requests. Please refresh.
        </p>
      )}
      {/* Request Cards */}
      <div className="grid xl:grid-cols-2 gap-5">
        {filteredRequests.map((req) => (
          <div key={req.request_id} className="card">
            <div className="flex flex-wrap justify-between gap-3">
              <h2 className="text-xl font-bold">
                {req.customer_name}
              </h2>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                statusClass(req.appointment_status)
              }`}>
                {req.appointment_status === "Pending"
                  ? "Pending Approval"
                  : req.appointment_status}
              </span>
            </div>
            <p className="text-slate-500">
              {[req.mobile, req.village].filter(Boolean).join(" · ")}
            </p>
            <p className="text-xs font-semibold mt-2 text-sky-700">{req.booking_source === "Management" ? `Walk-in · Booked by ${req.booked_by_name || "Management"}` : "Customer booking"}</p>
            <p className="font-semibold mt-4">
              Car Make: {req.car_make || req.car_name}
            </p>
            <p>{req.car_number}</p>
            {/* Appointment Details */}
            <div className="bg-slate-50 p-4 rounded-xl mt-5 space-y-3">
              <div className="flex items-center gap-2">
                <CalendarDays
                  size={19}
                  className="text-sky-600"
                />
                <span>
                  {formatDate(req.appointment_date)}
                </span>
              </div>
              {(req.confirmed_start_time || req.preferred_start_time) && <div className="flex items-center gap-2">
                <Clock
                  size={19}
                  className="text-sky-600"
                />
                <span>
                  {formatTime(
                    req.appointment_status === "Confirmed"
                      ? req.confirmed_start_time
                      : req.preferred_start_time
                  )}
                  {(req.confirmed_end_time || req.preferred_end_time) && ` - ${formatTime(req.confirmed_end_time || req.preferred_end_time)}`}
                </span>
              </div>}
              {req.appointment_status === "Confirmed" && (
                <p className="flex items-center gap-2 text-green-700 text-sm font-semibold">
                  <CheckCircle2 size={18} />
                  Appointment Confirmed
                </p>
              )}
              {req.appointment_status === "Reschedule Requested" && (
                <div className="text-sm text-orange-700">
                  <p className="font-semibold">
                    Waiting for customer slot selection
                  </p>
                  <div className="space-y-2 mt-3">
                    {req.appointment_slots.map((slot) => (
                      <div key={slot.id}>
                        {formatDate(slot.appointment_date)}
                        {" · "}
                        {formatTime(slot.start_time)}
                        {" - "}
                        {formatTime(slot.end_time)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {/* Services and Price */}
            <ul className="my-5 space-y-3">
              {req.services.map((service) => (
                <li
                  key={service.service_id}
                  className="flex justify-between gap-3 text-slate-600"
                >
                  <span>{service.service_name}</span>
                  <span className="font-semibold text-sky-700">
                    {service.price !== null
                      ? formatMoney(toPaise(service.price))
                      : "On request"}
                  </span>
                </li>
              ))}
            </ul>
            {/* Appointment Actions */}
            <div className="flex flex-wrap gap-3">
              {req.appointment_status === "Pending" && (
                <>
                  <button
                    className="bg-green-600 hover:bg-green-700 text-white rounded-xl px-4 py-3 font-semibold disabled:opacity-50"
                    disabled={confirmingId !== null || loading || loadError || cancelling}
                    onClick={() =>
                      acceptAppointment(req.request_id)
                    }
                  >
                    {confirmingId === req.request_id
                      ? "Confirming..."
                      : "Accept Appointment"}
                  </button>
                  <button
                    className="secondary-btn"
                    disabled={confirmingId !== null || loading || loadError || cancelling}
                    onClick={() =>
                      openSuggestSlots(req)
                    }
                  >
                    Suggest Time Slots
                  </button>
                </>
              )}
              {req.appointment_status === "Reschedule Requested" && (
                <button
                  className="secondary-btn"
                  onClick={() =>
                    openSuggestSlots(req)
                  }
                >
                  Update Suggested Slots
                </button>
              )}
              {["Confirmed", "Not Scheduled"].includes(
                req.appointment_status
              ) && (
                <button
                  className="primary-btn"
                  disabled={openingId !== null || loading || loadError || cancelling}
                  onClick={() =>
                    openInvoice(req.request_id)
                  }
                >
                  {openingId === req.request_id
                    ? "Loading..."
                    : "Generate Invoice"}
                </button>
              )}
              {req.can_cancel && <button type="button" className="rounded-xl px-4 py-3 border border-red-200 text-red-700 font-semibold hover:bg-red-50 disabled:opacity-50" disabled={loading || loadError || cancelling || confirmingId !== null || openingId !== null} onClick={() => { setCancelTarget(req); setCancelReason(""); }}>Cancel Request</button>}
            </div>
          </div>
        ))}
      </div>
      {!loading &&
        !loadError &&
        filteredRequests.length === 0 && (
          <p>No service requests found.</p>
        )}
      {cancelTarget && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"><div role="dialog" aria-modal="true" aria-label="Cancel service request" className="bg-white rounded-2xl p-6 w-full max-w-md"><h2 className="text-xl font-bold">Cancel Service Request?</h2><p className="text-slate-600 mt-3">{cancelTarget.customer_name} · {cancelTarget.car_number}. This releases the appointment slot and removes this request from active requests.</p><label className="field-label mt-4" htmlFor="cancel-reason">Reason (optional)</label><textarea id="cancel-reason" className="form-input" maxLength={250} rows={3} placeholder="E.g. Customer did not arrive" value={cancelReason} disabled={cancelling} onChange={e => setCancelReason(e.target.value)}/><div className="flex gap-3 mt-5"><button className="bg-red-600 text-white rounded-xl px-4 py-3 font-semibold disabled:opacity-50" disabled={cancelling} onClick={cancel}>{cancelling ? "Cancelling..." : "Confirm Cancellation"}</button><button className="secondary-btn" disabled={cancelling} onClick={() => setCancelTarget(null)}>Keep Request</button></div></div></div>}
      {/* ======================================
          ALTERNATIVE SLOT MODAL
      ====================================== */}
      {appointmentRequest && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl max-h-[90vh] overflow-auto">
            <h2 className="text-xl font-bold">
              Suggest Alternative Time Slots
            </h2>
            <p className="text-slate-500 text-sm mt-2 mb-5">
              Customer: {appointmentRequest.customer_name}
            </p>
            <div className="space-y-4">
              {slots.map((slot, index) => (
                <div
                  key={index}
                  className="border border-slate-200 rounded-xl p-4"
                >
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold">
                      Time Slot {index + 1}
                    </h3>
                    <button
                      type="button"
                      aria-label={`Remove slot ${index + 1}`}
                      className="text-red-600"
                      disabled={
                        slots.length === 1 ||
                        appointmentSaving
                      }
                      onClick={() => removeSlot(index)}
                    >
                      <Trash2 size={19} />
                    </button>
                  </div>
                  <label className="field-label">
                    Appointment Date
                  </label>
                  <input
                    type="date"
                    min={getToday()}
                    className="form-input"
                    value={slot.appointment_date}
                    disabled={appointmentSaving}
                    onChange={(e) =>
                      updateSlot(
                        index,
                        "appointment_date",
                        e.target.value
                      )
                    }
                  />
                  <div className="grid sm:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="field-label">
                        Start Time
                      </label>
                      <input
                        type="time"
                        className="form-input"
                        disabled={appointmentSaving}
                        value={slot.start_time}
                        onChange={(e) =>
                          updateSlot(
                            index,
                            "start_time",
                            e.target.value
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className="field-label">
                        End Time
                      </label>
                      <input
                        type="time"
                        className="form-input"
                        disabled={appointmentSaving}
                        value={slot.end_time}
                        onChange={(e) =>
                          updateSlot(
                            index,
                            "end_time",
                            e.target.value
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button
              className="flex gap-2 items-center text-sky-600 font-semibold mt-5"
              disabled={
                appointmentSaving ||
                slots.length >= 10
              }
              onClick={addSlot}
            >
              <Plus size={20} />
              Add Another Slot
            </button>
            <div className="flex flex-wrap gap-3 mt-6">
              <button
                className="primary-btn"
                disabled={appointmentSaving}
                onClick={submitSlots}
              >
                {appointmentSaving
                  ? "Sending..."
                  : "Send Available Slots"}
              </button>
              <button
                className="secondary-btn"
                disabled={appointmentSaving}
                onClick={() =>
                  setAppointmentRequest(null)
                }
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ======================================
          GENERATE INVOICE MODAL
      ====================================== */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-auto">
            <h2 className="text-xl font-bold mb-5">
              Generate Invoice
            </h2>
            {selected.services.map((service) => (
              <div
                key={service.service_id}
                className="mb-4"
              >
                <label className="field-label">
                  {service.service_name}
                </label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Enter amount"
                  value={
                    amounts[service.service_id] ?? ""
                  }
                  disabled={saving}
                  onChange={(e) =>
                    setAmounts({
                      ...amounts,
                      [service.service_id]: e.target.value,
                    })
                  }
                />
              </div>
            ))}
            {/* Discount */}
            <div className="mb-5">
              <label className="field-label">
                Discount Amount (Optional)
              </label>
              <input
                className="form-input"
                type="number"
                min="0"
                max={subtotal / 100}
                step="0.01"
                placeholder="Enter discount amount"
                value={discount}
                disabled={saving}
                onChange={(e) =>
                  setDiscount(e.target.value)
                }
              />
              <p className="text-xs text-slate-500 mt-2">
                Leave empty if no discount is applicable.
              </p>
            </div>
            {/* Final Amount */}
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-5 space-y-3">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatMoney(subtotal)}</span>
              </div>
              <div className="flex justify-between text-green-700">
                <span>Discount</span>
                <span>
                  {discountAmount > 0
                    ? `- ${formatMoney(discountAmount)}`
                    : "No Discount"}
                </span>
              </div>
              <div className="flex justify-between border-t border-sky-200 pt-3 font-bold text-xl">
                <span>Final Total</span>
                <span className={
                  finalAmount < 0
                    ? "text-red-600"
                    : "text-sky-700"
                }>
                  {formatMoney(finalAmount)}
                </span>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                className="primary-btn"
                disabled={
                  saving ||
                  finalAmount < 0
                }
                onClick={generate}
              >
                {saving
                  ? "Generating..."
                  : "Generate Bill"}
              </button>
              <button
                className="secondary-btn"
                disabled={saving}
                onClick={() => setSelected(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
