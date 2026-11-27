import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { UserPlus, RefreshCw, Pencil, UserCog } from "lucide-react";
import { toast } from "react-toastify";
import axios from "axios";
import { ManagementAPI } from "../../services/api";
import type { ManagementStaffRecord } from "../../services/api";

const errorMessage = (error: unknown, fallback: string) => axios.isAxiosError(error) ? error.response?.data?.message || fallback : fallback;

export default function ManagementStaff() {
  const [staff, setStaff] = useState<ManagementStaffRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ManagementStaffRecord | null>(null);
  const [target, setTarget] = useState<ManagementStaffRecord | null>(null);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const load = async () => {
    setLoading(true); setLoadError(false);
    try { const { data } = await ManagementAPI.getAll(); setStaff(data.data); }
    catch (error) { setLoadError(true); toast.error(errorMessage(error, "Unable to load staff")); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const open = (record: ManagementStaffRecord | null) => {
    setEditing(record); setName(record?.name || ""); setMobile(record?.mobile || ""); setPassword(""); setShowForm(true);
  };
  const close = () => { setShowForm(false); setPassword(""); setEditing(null); };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    if (!name.trim() || !/^[6-9][0-9]{9}$/.test(mobile.trim())) { toast.error("Enter valid name and mobile"); return; }
    if ((!editing || password) && (password.length < 8 || password.length > 128)) { toast.error("Password must contain 8 to 128 characters"); return; }
    setSaving(true);
    try {
      const fields = { name: name.trim(), mobile: mobile.trim() };
      const { data } = editing ? await ManagementAPI.update(editing.id, { ...fields, ...(password ? { password } : {}) }) : await ManagementAPI.create({ ...fields, password });
      toast.success(data.message); close(); await load();
    } catch (error) { toast.error(errorMessage(error, "Unable to save staff")); }
    finally { setSaving(false); }
  };
  const toggle = async () => {
    if (!target || saving) return;
    setSaving(true);
    try { const { data } = await ManagementAPI.update(target.id, { is_active: !target.is_active }); toast.success(data.message); setTarget(null); await load(); }
    catch (error) { toast.error(errorMessage(error, "Unable to update staff status")); }
    finally { setSaving(false); }
  };
  return <div>
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6"><div><h1 className="page-title">Management Staff</h1><p className="text-slate-500 mt-2">Create and manage staff login accounts for walk-in bookings.</p></div><div className="flex gap-2"><button className="secondary-btn flex items-center gap-2" disabled={loading || saving} onClick={load}><RefreshCw size={18}/> Refresh</button><button className="primary-btn flex items-center gap-2" disabled={saving} onClick={() => open(null)}><UserPlus size={18}/> Add Staff</button></div></div>
    <div className="card mb-5 flex items-center gap-4"><UserCog className="text-sky-600" size={30}/><div><p className="text-slate-500">Active Management Accounts</p><h2 className="text-2xl font-bold">{loading || loadError ? "—" : staff.filter(item => item.is_active).length}</h2></div></div>
    <div className="card overflow-x-auto">{loading ? <p>Loading staff...</p> : loadError ? <p className="text-red-600">Unable to load staff. Please refresh.</p> : <table className="data-table"><thead><tr><th>Name</th><th>Mobile</th><th>Status</th><th>Actions</th></tr></thead><tbody>{staff.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.mobile}</td><td><span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{item.is_active ? "Active" : "Inactive"}</span></td><td><div className="flex flex-wrap gap-3"><button className="secondary-btn flex gap-2 items-center" disabled={saving} onClick={() => open(item)}><Pencil size={16}/> Edit</button><button disabled={saving} className={`font-semibold ${item.is_active ? "text-red-700" : "text-green-700"}`} onClick={() => setTarget(item)}>{item.is_active ? "Deactivate" : "Activate"}</button></div></td></tr>)}</tbody></table>}{!loading && !loadError && !staff.length && <p className="py-4">No management staff yet.</p>}</div>
    {showForm && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"><div role="dialog" aria-modal="true" aria-label="Staff account" className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-auto"><h2 className="text-xl font-bold mb-5">{editing ? "Edit Staff Account" : "Create Staff Account"}</h2><form onSubmit={save} className="space-y-4"><div><label className="field-label" htmlFor="staff-name">Staff Name</label><input id="staff-name" className="form-input" maxLength={100} value={name} onChange={e => setName(e.target.value)} required disabled={saving}/></div><div><label className="field-label" htmlFor="staff-mobile">Mobile Number</label><input id="staff-mobile" className="form-input" type="tel" pattern="[6-9][0-9]{9}" maxLength={10} value={mobile} onChange={e => setMobile(e.target.value)} required disabled={saving}/></div><div><label className="field-label" htmlFor="staff-password">{editing ? "New Password (Optional)" : "Password"}</label><input id="staff-password" className="form-input" type="password" autoComplete="new-password" minLength={8} maxLength={128} required={!editing} value={password} onChange={e => setPassword(e.target.value)} disabled={saving}/></div><p className="text-xs text-slate-500">Share credentials privately. Passwords cannot be viewed after saving.</p><div className="flex gap-3"><button type="submit" className="primary-btn" disabled={saving}>{saving ? "Saving..." : "Save Staff"}</button><button type="button" className="secondary-btn" disabled={saving} onClick={close}>Cancel</button></div></form></div></div>}
    {target && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"><div role="dialog" aria-modal="true" aria-label="Change staff status" className="bg-white rounded-2xl p-6 w-full max-w-md"><h2 className="text-xl font-bold">{target.is_active ? "Deactivate" : "Activate"} Staff?</h2><p className="mt-3 text-slate-600">{target.name} — {target.is_active ? "Login and existing staff booking sessions will be blocked. Booking history is preserved." : "Staff can sign in again."}</p><div className="flex gap-3 mt-6"><button className="primary-btn" disabled={saving} onClick={toggle}>{saving ? "Saving..." : "Confirm"}</button><button className="secondary-btn" disabled={saving} onClick={() => setTarget(null)}>Cancel</button></div></div></div>}
  </div>;
}
