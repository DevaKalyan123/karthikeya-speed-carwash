import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5001/api",
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export interface SlotInput {
  appointment_date: string;
  start_time: string;
  end_time: string;
}

export interface AppointmentSlot extends SlotInput {
  id: number;
  status: string;
}

export interface AppointmentDetails {
  appointment_date: string | null;
  preferred_start_time: string | null;
  preferred_end_time: string | null;
  confirmed_start_time: string | null;
  confirmed_end_time: string | null;
  appointment_status: string;
  appointment_slots: AppointmentSlot[];
  can_cancel: boolean;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
}

export type PaymentMethod = "Cash" | "UPI";

export interface CustomerInput {
  name?: string | null;
  mobile?: string | null;
  village?: string | null;
  vehicles?: { car_make?: string | null; car_number?: string | null }[];
  service_date?: string | null;
  service_ids?: number[];
  amount?: string | null;
}

export interface ManagementStaffInput {
  name: string;
  mobile: string;
  password: string;
}

export interface ManagementStaffRecord {
  id: number;
  name: string;
  mobile: string;
  role: "management";
  is_active: boolean;
  created_at: string | null;
}

export const PasswordResetAPI = {
  getAll: () => api.get("/auth/admin/password-reset-requests"),
  approve: (userId: number) => api.post(`/auth/admin/password-reset-requests/${userId}/approve`, { identity_verified: true }),
};

export const ManagementAPI = {
  getAll: () => api.get("/admin/management-staff"),
  create: (data: ManagementStaffInput) => api.post("/admin/management-staff", data),
  update: (id: number, data: Partial<ManagementStaffInput> & { is_active?: boolean }) => api.put(`/admin/management-staff/${id}`, data),
};

export const AuthAPI = {
  login: (data: { mobile: string; password: string }) => api.post("/auth/login", data),
  register: (data: { name: string; mobile: string; village: string; password: string }) => api.post("/auth/register", data),
  forgotPassword: (mobile: string) => api.post("/auth/forgot-password", { mobile }),
  resetPassword: (data: { mobile: string; otp: string; new_password: string }) => api.post("/auth/reset-password", data),
};

export const ServiceAPI = {
  getAll: () => api.get("/services/"),
  getAllAdmin: () => api.get("/services/admin/all"),
  add: (data: { service_name: string; description: string; price: string }) => api.post("/services/admin/add", data),
  update: (id: number, data: { service_name?: string; description?: string; price?: string | null; is_active?: boolean }) => api.put(`/services/admin/${id}`, data),
};

export const RequestAPI = {
  create: (data: {
    customer_name?: string | null;
    mobile?: string | null;
    car_make: string;
    car_number: string;
    service_ids: number[];
    village?: string | null;
    appointment_date?: string | null;
    preferred_start_time?: string | null;
  }) => api.post("/requests/", data),
  getMyRequests: () => api.get("/requests/my-requests"),
  deleteMyRequest: (requestId: number) => api.delete(`/requests/${requestId}`),
  selectSlot: (requestId: number, slotId: number) => api.post(`/requests/${requestId}/select-slot`, { slot_id: slotId }),
  cancel: (requestId: number, reason?: string) => api.post(`/requests/${requestId}/cancel`, { reason }),
};

export const AdminAPI = {
  getRequests: (status?: string, appointmentStatus?: string, paymentStatus?: string) => api.get("/admin/requests", {
    params: { status, appointment_status: appointmentStatus, payment_status: paymentStatus },
  }),
  getRequest: (id: number) => api.get(`/admin/requests/${id}`),
  acceptAppointment: (id: number) => api.post(`/admin/requests/${id}/accept`),
  cancelRequest: (id: number, reason?: string) => api.post(`/admin/requests/${id}/cancel`, { reason }),
  suggestSlots: (id: number, slots: SlotInput[]) => api.post(`/admin/requests/${id}/suggest-slots`, { slots }),
  generateInvoice: (id: number, data: { services: { service_id: number; amount: string }[]; discount_amount?: string }) => api.post(`/admin/requests/${id}/invoice`, data),
  getInvoices: () => api.get("/admin/invoices"),
  deleteInvoice: (invoiceId: number) => api.delete(`/admin/invoices/${invoiceId}`),
  deleteAllInvoices: (expectedIds: number[]) => api.delete("/admin/invoices/all", {
    data: { confirmation: "DELETE ALL", expected_count: expectedIds.length, expected_ids: expectedIds },
  }),
  getCustomers: (search = "") => api.get("/admin/customers", { params: { search } }),
  getCustomerHistory: (id: number) => api.get(`/admin/customers/${id}/history`),
  addCustomer: (data: CustomerInput) => api.post("/admin/customers", data),
  deleteCustomer: (id: number) => api.delete(`/admin/customers/${id}`),
  exportCustomers: (search = "") => api.get("/admin/customers/export", { params: { search }, responseType: "blob" }),
  getProfile: () => api.get("/admin/profile"),
  updateProfile: (data: { name: string; mobile: string; current_password: string; new_password: string }) => api.put("/admin/profile", data),
};

export const DashboardAPI = {
  getSummary: () => api.get("/dashboard/summary"),
  getCharts: (period: string) => api.get("/dashboard/charts", { params: { period } }),
};

export const InvoiceAPI = {
  getMyInvoices: () => api.get("/invoices/my-invoices"),
  download: (id: number) => api.get(`/invoices/${id}/download`, { responseType: "blob" }),
};

export const PaymentAPI = {
  selectMethod: (id: number, payment_method: PaymentMethod, tip_amount = "0.00") => api.post(`/payments/${id}/select-method`, { payment_method, tip_amount }),
  getPending: () => api.get("/payments/admin/pending"),
  pay: (id: number, data: { payment_method: PaymentMethod; amount: string; transaction_id?: string }) => api.post(`/payments/${id}/pay`, data),
  reject: (id: number) => api.post(`/payments/${id}/reject`),
};

export default api;
