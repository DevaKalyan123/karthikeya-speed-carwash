import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Download, Search, Plus, Trash2, UserPlus, RefreshCw } from "lucide-react";
import { toast } from "react-toastify";
import axios from "axios";
import { AdminAPI, ServiceAPI } from "../../services/api";

interface Customer {
  customer_id: number;
  name: string | null;
  mobile: string | null;
  village: string | null;
  total_visits: number;
  vehicles: { vehicle_id: number; car_name: string; car_number: string }[];
}

interface HistoryItem {
  request_id: number | null;
  manual_visit_id?: number;
  source?: string;
  service_date?: string;
  services?: { service_id: number; service_name: string }[];
  car_name: string;
  car_number: string;
  status: string;
  total_amount: string | null;
  created_at: string;
}

interface VehicleInput {
  car_make: string;
  car_number: string;
}

const emptyVehicle = (): VehicleInput => ({ car_make: "", car_number: "" });
const errorMessage = (error: unknown, fallback: string) =>
  axios.isAxiosError(error) ? error.response?.data?.message || fallback : fallback;

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [history, setHistory] = useState<HistoryItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [village, setVillage] = useState("");
  const [vehicles, setVehicles] = useState<VehicleInput[]>([emptyVehicle()]);
  const [serviceDate, setServiceDate] = useState("");
  const [amount, setAmount] = useState("");
  const [serviceIds, setServiceIds] = useState<number[]>([]);
  const [services, setServices] = useState<{ id: number; service_name: string }[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [serviceError, setServiceError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(false);
    const timer = setTimeout(() => {
      AdminAPI.getCustomers(search)
        .then(({ data }) => { if (active) setCustomers(data.data); })
        .catch(() => {
          if (active) {
            setLoadError(true);
            toast.error("Unable to load customers");
          }
        })
        .finally(() => { if (active) setLoading(false); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [search, refresh]);

  const loadServices = async () => {
    setServicesLoading(true);
    setServiceError(false);
    try {
      const { data } = await ServiceAPI.getAllAdmin();
      setServices(data.data);
    } catch {
      setServiceError(true);
      toast.error("Unable to load services");
    } finally { setServicesLoading(false); }
  };

  const openAdd = () => {
    setName("");
    setMobile("");
    setVillage("");
    setVehicles([emptyVehicle()]);
    setServiceDate("");
    setAmount("");
    setServiceIds([]);
    setShowAdd(true);
    void loadServices();
  };

  const updateVehicle = (index: number, field: keyof VehicleInput, value: string) => {
    setVehicles(previous => previous.map((vehicle, i) => i === index ? { ...vehicle, [field]: value } : vehicle));
  };

  const addVehicle = () => {
    if (vehicles.length >= 20) { toast.error("Maximum 20 vehicles allowed"); return; }
    setVehicles(previous => [...previous, emptyVehicle()]);
  };
  const removeVehicle = (index: number) => setVehicles(previous => previous.filter((_, i) => i !== index));

  const saveCustomer = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;
    if (mobile.trim() && !/^[6-9][0-9]{9}$/.test(mobile.trim())) { toast.error("Enter valid mobile number or leave it empty"); return; }
    if (amount.trim() && (!/^\d+(\.\d{1,2})?$/.test(amount.trim()) || Number(amount) > 9999999999.99)) {
      toast.error("Enter a valid received amount"); return;
    }
    if (serviceDate) {
      const [day, month, year] = serviceDate.split("/").map(Number);
      const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
      const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(serviceDate) || year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) {
        toast.error("Enter a valid DD/MM/YYYY date"); return;
      }
    }
    const selectedVehicles = vehicles
      .filter(vehicle => vehicle.car_make.trim() || vehicle.car_number.trim())
      .map(vehicle => ({
        car_make: vehicle.car_make.trim(),
        car_number: vehicle.car_number.replace(/\s+/g, "").toUpperCase(),
      }));
    const numbers = selectedVehicles.map(vehicle => vehicle.car_number).filter(Boolean);
    if (new Set(numbers).size !== numbers.length) {
      toast.error("Duplicate car numbers");
      return;
    }
    setSaving(true);
    try {
      const { data } = await AdminAPI.addCustomer({
        name: name.trim(), mobile: mobile.trim(), village: village.trim(), vehicles: selectedVehicles,
        service_date: serviceDate || null, service_ids: serviceIds, amount: amount.trim() || null,
      });
      toast.success(data.message);
      setShowAdd(false);
      setSearch("");
      setRefresh(value => value + 1);
    } catch (error) { toast.error(errorMessage(error, "Unable to add customer")); }
    finally { setSaving(false); }
  };

  const deleteCustomer = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const { data } = await AdminAPI.deleteCustomer(deleteTarget.customer_id);
      setCustomers(previous => previous.filter(customer => customer.customer_id !== deleteTarget.customer_id));
      toast.success(data.message);
      setDeleteTarget(null);
      setRefresh(value => value + 1);
    } catch (error) { toast.error(errorMessage(error, "Unable to delete customer")); }
    finally { setDeleting(false); }
  };

  const download = async () => {
    try {
      const { data } = await AdminAPI.exportCustomers(search);
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Karthikeya_Customers.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { toast.error("Export failed"); }
  };

  const viewHistory = async (id: number) => {
    try {
      const { data } = await AdminAPI.getCustomerHistory(id);
      setHistory(data.data);
    } catch { toast.error("Unable to load history"); }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title">Customers</h1>
        <p className="text-slate-500 mt-2">Manage customer records and vehicle details.</p>
      </div>
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex items-center border border-slate-200 bg-white rounded-xl px-4 grow">
          <Search size={20} className="text-slate-400" />
          <input className="w-full outline-none p-3" placeholder="Search name, mobile, car number..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="primary-btn flex items-center gap-2" onClick={openAdd}><UserPlus size={19} /> Add Customer</button>
        <button className="secondary-btn flex items-center gap-2" onClick={download}><Download size={18} /> Export Excel</button>
        <button className="secondary-btn flex items-center gap-2" disabled={loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={18} /> Refresh</button>
      </div>
      <div className="card overflow-x-auto">
        {loading ? <p className="py-5 text-slate-500">Loading customers...</p> : loadError ? <p className="py-5 text-red-600">Unable to load customers. Please refresh.</p> :
          <table className="data-table">
            <thead><tr><th>Customer</th><th>Mobile</th><th>Village</th><th>Vehicles</th><th>Visits</th><th>Action</th></tr></thead>
            <tbody>{customers.map(customer => (
              <tr key={customer.customer_id}>
                <td className="font-semibold">{customer.name ?? ""}</td>
                <td>{customer.mobile ?? ""}</td>
                <td>{customer.village ?? ""}</td>
                <td>{customer.vehicles.map(vehicle => <div key={vehicle.vehicle_id} className="mb-2"><p className="font-medium">{vehicle.car_number}</p><p className="text-xs text-slate-500">{vehicle.car_name}</p></div>)}{!customer.vehicles.length && "—"}</td>
                <td>{customer.total_visits}</td>
                <td><div className="flex items-center gap-4">
                  <button className="text-sky-600 font-semibold whitespace-nowrap" onClick={() => viewHistory(customer.customer_id)}>View History</button>
                  <button className="text-red-600 hover:text-red-800 flex items-center gap-1" onClick={() => setDeleteTarget(customer)}><Trash2 size={17} /> Delete</button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        }
        {!loading && !loadError && !customers.length && <p className="py-5 text-slate-500">No customers found.</p>}
      </div>

      {showAdd && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
        <div role="dialog" aria-modal="true" aria-label="Add customer" className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-auto">
          <h2 className="text-xl font-bold flex items-center gap-2"><UserPlus className="text-sky-600" /> Add Customer</h2>
          <p className="text-slate-500 text-sm mt-2 mb-6">Enter existing customer information.</p>
          <form onSubmit={saveCustomer} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label htmlFor="manual-name" className="field-label">Customer Name (Optional)</label><input id="manual-name" className="form-input" placeholder="Enter customer name" value={name} maxLength={100} onChange={e => setName(e.target.value)} disabled={saving} /></div>
              <div><label htmlFor="manual-mobile" className="field-label">Mobile Number (Optional)</label><input id="manual-mobile" className="form-input" type="tel" inputMode="numeric" placeholder="Enter mobile number" value={mobile} maxLength={10} pattern="[6-9][0-9]{9}" onChange={e => setMobile(e.target.value.replace(/\D/g, ""))} disabled={saving} /></div>
            </div>
            <div><label htmlFor="manual-village" className="field-label">Village / City (Optional)</label><input id="manual-village" className="form-input" placeholder="Enter village or city" value={village} maxLength={150} onChange={e => setVillage(e.target.value)} disabled={saving} /></div>
            <div className="border-t border-slate-200 pt-5">
              <div className="flex justify-between items-center gap-3 mb-4"><h3 className="font-bold">Vehicle Details (Optional)</h3><button type="button" className="text-sky-600 font-semibold flex items-center gap-2" disabled={saving || vehicles.length >= 20} onClick={addVehicle}><Plus size={18} /> Add Vehicle</button></div>
              <div className="space-y-4">{vehicles.map((vehicle, index) => (
                <div key={index} className="border border-slate-200 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-4"><h4 className="font-semibold">Vehicle {index + 1}</h4><button type="button" aria-label="Remove vehicle" className="text-red-600" disabled={saving} onClick={() => removeVehicle(index)}><Trash2 size={18} /></button></div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div><label className="field-label" htmlFor={`make-${index}`}>Car Make</label><input id={`make-${index}`} className="form-input" placeholder="Honda, Hyundai, Toyota" value={vehicle.car_make} maxLength={100} disabled={saving} onChange={e => updateVehicle(index, "car_make", e.target.value)} /></div>
                    <div><label className="field-label" htmlFor={`number-${index}`}>Car Number</label><input id={`number-${index}`} className="form-input uppercase" placeholder="AP39AB1234" value={vehicle.car_number} maxLength={20} disabled={saving} onChange={e => updateVehicle(index, "car_number", e.target.value.toUpperCase())} /></div>
                  </div>
                </div>
              ))}</div>
            </div>
            <div className="border-t border-slate-200 pt-5 space-y-4">
              <h3 className="font-bold">Service History (Optional)</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label htmlFor="manual-date" className="field-label">Service Date</label><input id="manual-date" className="form-input" type="text" inputMode="numeric" placeholder="DD/MM/YYYY" maxLength={10} value={serviceDate} disabled={saving} onChange={e => { const d = e.target.value.replace(/\D/g, "").slice(0, 8); setServiceDate([d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join("/")); }} /><p className="text-xs text-slate-500 mt-1">Defaults to today for a service entry.</p></div>
                <div><label htmlFor="manual-amount" className="field-label">Received Amount (₹)</label><input id="manual-amount" className="form-input" type="text" inputMode="decimal" placeholder="0.00" value={amount} disabled={saving} onChange={e => setAmount(e.target.value)} /><p className="text-xs text-slate-500 mt-1">Enter only money already received.</p></div>
              </div>
              <div><div className="flex justify-between items-center"><p className="field-label">Services (Multiple / Optional)</p><span className="text-xs text-slate-500">{serviceIds.length} selected</span></div>
                {servicesLoading ? <p>Loading services...</p> : serviceError ? <button type="button" className="secondary-btn" onClick={loadServices}>Retry loading services</button> : <div className="grid sm:grid-cols-2 gap-2 max-h-48 overflow-auto">{services.map(service => <label key={service.id} className="flex items-center gap-2 border border-slate-200 rounded-lg p-3 cursor-pointer"><input type="checkbox" checked={serviceIds.includes(service.id)} disabled={saving} onChange={() => setServiceIds(previous => previous.includes(service.id) ? previous.filter(id => id !== service.id) : [...previous, service.id])}/>{service.service_name}</label>)}</div>}
                {!servicesLoading && !serviceError && !services.length && <p className="text-sm text-slate-500">No services available.</p>}
              </div>
            </div>
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-sm text-sky-800">All fields are optional. Any received amount is recorded as manual revenue without creating a login account or online payment request.</div>
            <div className="flex gap-3"><button type="submit" disabled={saving} className="primary-btn">{saving ? "Saving..." : "Save Customer"}</button><button type="button" className="secondary-btn" disabled={saving} onClick={() => setShowAdd(false)}>Cancel</button></div>
          </form>
        </div>
      </div>}

      {deleteTarget && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
        <div role="dialog" aria-modal="true" aria-label="Delete customer" className="bg-white rounded-2xl p-6 w-full max-w-md">
          <div className="bg-red-100 text-red-600 w-14 h-14 rounded-full flex items-center justify-center mb-4"><Trash2 size={25} /></div>
          <h2 className="text-xl font-bold">Delete Customer?</h2>
          <p className="text-slate-600 mt-3">Are you sure you want to remove <strong>{deleteTarget.name?.trim() || deleteTarget.vehicles[0]?.car_number || `Customer #${deleteTarget.customer_id}`}</strong> from the customer list?</p>
          <p className="text-sm text-slate-500 mt-3">Existing login accounts, invoices and service history will be preserved by archiving the record. Unlinked records without history will be permanently deleted.</p>
          <div className="flex gap-3 mt-6"><button className="bg-red-600 hover:bg-red-700 text-white rounded-xl px-5 py-3 font-semibold disabled:opacity-50" disabled={deleting} onClick={deleteCustomer}>{deleting ? "Removing..." : "Confirm Delete"}</button><button className="secondary-btn" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</button></div>
        </div>
      </div>}

      {history !== null && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
        <div role="dialog" aria-modal="true" aria-label="Service history" className="bg-white rounded-2xl p-6 w-full max-w-xl max-h-[85vh] overflow-auto">
          <h2 className="text-xl font-bold mb-5">Service History</h2>
          {history.map(item => <div key={item.source === "Manual" ? `manual-${item.manual_visit_id}` : `request-${item.request_id}`} className="border-b border-slate-200 py-4"><p className="font-bold">{item.car_name}</p><p>{item.car_number}</p>{item.source === "Manual" && <p className="text-xs font-semibold text-sky-700">Manual service entry</p>}<p>Status: {item.status}</p>{!!item.services?.length && <p>Services: {item.services.map(s => s.service_name).join(", ")}</p>}<p>Amount: {item.total_amount !== null ? `₹${item.total_amount}` : item.source === "Manual" ? "Not recorded" : "Pending"}</p><p className="text-sm text-slate-500">{item.service_date ? item.service_date.split("-").reverse().join("/") : new Date(item.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</p></div>)}
          {!history.length && <p>No previous service records.</p>}
          <button className="secondary-btn mt-5" onClick={() => setHistory(null)}>Close</button>
        </div>
      </div>}
    </div>
  );
}
