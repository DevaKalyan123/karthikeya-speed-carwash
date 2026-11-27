import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Car, CalendarDays, Clock, CheckCircle2, IndianRupee } from "lucide-react";
import axios from "axios";
import { ServiceAPI, RequestAPI } from "../../services/api";
import type { Service } from "../../types";
import { useAuth } from "../../context/AuthContext";

// Native date inputs follow the browser locale; use a fixed DD/MM/YYYY field.
const formatDateInput = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("/");
};

const toISODate = (value: string): string | null => {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return null;
  const [day, month, year] = value.split("/").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return null;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > days[month - 1]) return null;
  const [dd, mm, yyyy] = value.split("/");
  return `${yyyy}-${mm}-${dd}`;
};
const formatPrice = (value: string | number) => Number(value).toLocaleString("en-IN", { style: "currency", currency: "INR" });

export default function BookService() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isManagement = user?.role === "management";
  const base = isManagement ? "/management" : "/customer";
  const [services, setServices] = useState<Service[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [mobile, setMobile] = useState("");
  const [village, setVillage] = useState("");
  const [carMake, setCarMake] = useState("");
  const [carNumber, setCarNumber] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadServices = async () => {
    setServicesLoading(true); setLoadError(false);
    try {
      const { data } = await ServiceAPI.getAll();
      const activeServices: Service[] = data.data;
      setServices(activeServices);
      setSelected(previous => previous.filter(id => activeServices.some(service => service.id === id)));
    } catch { setLoadError(true); toast.error("Unable to load services"); }
    finally { setServicesLoading(false); }
  };
  useEffect(() => { void loadServices(); }, []);
  const toggleService = (id: number) => setSelected(previous => previous.includes(id) ? previous.filter(item => item !== id) : [...previous, id]);
  const selectedServices = services.filter(service => selected.includes(service.id));
  const estimatedTotal = selectedServices.reduce((total, service) => total + Number(service.price ?? 0), 0);
  const hasUnpricedServices = selectedServices.some(service => service.price === null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading || servicesLoading || loadError) return;
    if (!carMake.trim() || !carNumber.replace(/\s/g, "")) { toast.error("Car make and car number are required"); return; }
    if (mobile.trim() && !/^[6-9][0-9]{9}$/.test(mobile.trim())) { toast.error("Enter a valid mobile number or leave it empty"); return; }
    const isoDate = appointmentDate ? toISODate(appointmentDate) : null;
    if (appointmentDate && !isoDate) { toast.error("Enter a valid date in DD/MM/YYYY format or leave it empty"); return; }
    if (!selected.length) { toast.error("Select at least one service"); return; }
    setLoading(true);
    try {
      await RequestAPI.create({ customer_name: customerName.trim(), mobile: mobile.trim(), village: isManagement ? village.trim() : undefined, car_make: carMake.trim(), car_number: carNumber.replace(/\s/g, "").toUpperCase(), service_ids: selected, appointment_date: isoDate, preferred_start_time: startTime || null });
      toast.success("Service request submitted successfully");
      navigate(`${base}/requests`);
    } catch (error) { toast.error(axios.isAxiosError(error) ? error.response?.data?.message || "Unable to submit request" : "Unable to submit request"); }
    finally { setLoading(false); }
  };

  return <div className="space-y-6">
    <div><h1 className="page-title">{isManagement ? "Book Walk-in Customer Service" : "Book Car Wash Service"}</h1><p className="text-slate-500 mt-2">{isManagement ? "Enter the actual customer's details and services." : "Choose your services and optional appointment time."}</p></div>
    <form onSubmit={submit} className="card space-y-7">
      <div className="flex items-center gap-3"><div className="bg-sky-100 p-3 rounded-xl text-sky-600"><Car size={24}/></div><h2 className="text-xl font-bold">Vehicle Information</h2></div>
      <div className="grid md:grid-cols-2 gap-5">
        <div><label className="field-label" htmlFor="booking-name">Customer Name (Optional)</label><input id="booking-name" className="form-input" placeholder="Enter customer name" maxLength={100} value={customerName} onChange={e => setCustomerName(e.target.value)} autoComplete="off" disabled={loading}/></div>
        <div><label className="field-label" htmlFor="booking-mobile">Mobile Number (Optional)</label><input id="booking-mobile" className="form-input" type="tel" inputMode="numeric" placeholder="Enter mobile number" maxLength={10} pattern="[6-9][0-9]{9}" value={mobile} onChange={e => setMobile(e.target.value)} autoComplete="off" disabled={loading}/></div>
        <div><label className="field-label" htmlFor="car-make">Car Make</label><input id="car-make" className="form-input" placeholder="E.g. Honda, Hyundai, Toyota" maxLength={100} value={carMake} onChange={e => setCarMake(e.target.value)} disabled={loading} required/></div>
        <div><label className="field-label" htmlFor="car-number">Car Number</label><input id="car-number" className="form-input uppercase" placeholder="AP39AB1234" maxLength={20} value={carNumber} onChange={e => setCarNumber(e.target.value)} disabled={loading} required/></div>
        {isManagement && <div className="md:col-span-2"><label className="field-label" htmlFor="booking-village">Village / City (Optional)</label><input id="booking-village" className="form-input" placeholder="Enter customer's village or city" value={village} maxLength={150} onChange={e => setVillage(e.target.value)} disabled={loading}/></div>}
      </div>
      <div className="border-t border-slate-200"/>
      <div className="flex items-center gap-3"><div className="bg-sky-100 text-sky-600 p-3 rounded-xl"><CalendarDays size={24}/></div><div><h2 className="text-xl font-bold">Appointment Schedule (Optional)</h2><p className="text-sm text-slate-500">Date and time are independently optional.</p></div></div>
      <div className="grid md:grid-cols-2 gap-5">
        <div><label htmlFor="appointment-date" className="field-label">Appointment Date (Optional)</label><input id="appointment-date" type="text" inputMode="numeric" placeholder="DD/MM/YYYY" maxLength={10} className="form-input" value={appointmentDate} onChange={e => setAppointmentDate(formatDateInput(e.target.value))} disabled={loading}/></div>
        <div><label htmlFor="start-time" className="field-label">Preferred Start Time (Optional)</label><input id="start-time" type="time" className="form-input" value={startTime} onChange={e => setStartTime(e.target.value)} disabled={loading}/></div>
      </div>
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800"><Clock size={20} className="shrink-0"/><p>You can enter any valid date and time, or leave either field empty. All requests are sent to the admin. Complete appointment slots are subject to admin approval. All times are in IST.</p></div>
      <div className="border-t border-slate-200"/>
      <div className="flex justify-between items-center gap-3"><h2 className="text-xl font-bold">Select Services</h2><span className="badge">{selected.length} Selected</span></div>
      {servicesLoading ? <p>Loading services...</p> : loadError ? <div><p className="text-red-600">Unable to load services.</p><button type="button" className="secondary-btn mt-3" onClick={loadServices}>Retry</button></div> : <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {services.map(service => { const isSelected = selected.includes(service.id); return <label key={service.id} className={`flex items-start gap-3 border p-4 rounded-xl cursor-pointer ${isSelected ? "bg-sky-50 border-sky-500" : "border-slate-200 hover:border-sky-300"}`}><input type="checkbox" checked={isSelected} onChange={() => toggleService(service.id)} disabled={loading} className="accent-sky-600 w-5 h-5 mt-1 shrink-0"/><div className="flex-1"><p className="font-semibold">{service.service_name}</p>{service.description && <p className="text-xs text-slate-500 mt-1">{service.description}</p>}<p className="text-sky-700 font-bold text-sm mt-2">{service.price !== null ? `From ${formatPrice(service.price)}` : "Contact for Price"}</p></div>{isSelected && <CheckCircle2 size={18} className="text-sky-600 shrink-0"/>}</label>; })}
      </div>}
      {!servicesLoading && !loadError && services.length === 0 && <p>No services currently available.</p>}
      {selected.length > 0 && <div className="bg-sky-50 border border-sky-200 rounded-2xl p-5"><h2 className="font-bold text-lg flex items-center gap-2"><IndianRupee size={20}/> Booking Summary</h2><div className="space-y-3 mt-4">{selectedServices.map(service => <div key={service.id} className="flex justify-between gap-4 text-sm"><span>{service.service_name}</span><span className="font-semibold">{service.price !== null ? formatPrice(service.price) : "On request"}</span></div>)}</div><div className="border-t border-sky-200 mt-4 pt-4 flex justify-between gap-3"><span className="font-bold">{hasUnpricedServices ? "Known Price Subtotal" : "Estimated Total"}</span><span className="text-xl font-bold text-sky-700">{formatPrice(estimatedTotal)}</span></div><p className="text-xs text-slate-500 mt-3">Final service charges will be confirmed by the administrator.</p></div>}
      <button type="submit" disabled={loading || servicesLoading || loadError || selected.length === 0} className="primary-btn w-full sm:w-auto">{loading ? "Submitting..." : "Submit Service Request"}</button>
    </form>
  </div>;
}
