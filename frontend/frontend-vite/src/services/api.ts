import axios from "axios";

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    "http://localhost:5000/api",
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("access_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Authentication APIs
export const AuthAPI = {
  login: (data: {
    mobile: string;
    password: string;
  }) =>
    api.post("/auth/login", data),

  register: (data: {
    name: string;
    mobile: string;
    village: string;
    password: string;
  }) =>
    api.post("/auth/register", data),
};

// Services APIs
export const ServiceAPI = {
  getAll: () => api.get("/services/"),
};

// Customer Request APIs
export const RequestAPI = {
  create: (data: {
    car_name: string;
    car_number: string;
    service_ids: number[];
  }) =>
    api.post("/requests/", data),

  getMyRequests: () =>
    api.get("/requests/my-requests"),
};

// Admin APIs
export const AdminAPI = {
  getRequests: (status?: string) =>
    api.get("/admin/requests", {
      params: { status },
    }),

  getRequest: (id: number) =>
    api.get(`/admin/requests/${id}`),

  generateInvoice: (
    id: number,
    data: {
      services: {
        service_id: number;
        amount: string;
      }[];
    }
  ) =>
    api.post(`/admin/requests/${id}/invoice`, data),

  getCustomers: (search = "") =>
    api.get("/admin/customers", {
      params: { search },
    }),

  getCustomerHistory: (id: number) =>
    api.get(`/admin/customers/${id}/history`),

  exportCustomers: (search = "") =>
    api.get("/admin/customers/export", {
      params: { search },
      responseType: "blob",
    }),

  // Get Admin Profile
  getProfile: () =>
    api.get("/admin/profile"),

  // Update Admin Credentials
  updateProfile: (data: {
    name: string;
    mobile: string;
    current_password: string;
    new_password: string;
  }) =>
    api.put("/admin/profile", data),
};

// Dashboard APIs
export const DashboardAPI = {
  getSummary: () =>
    api.get("/dashboard/summary"),

  getCharts: (period: string) =>
    api.get("/dashboard/charts", {
      params: { period },
    }),
};

// Invoice APIs
export const InvoiceAPI = {
  getMyInvoices: () =>
    api.get("/invoices/my-invoices"),

  download: (id: number) =>
    api.get(`/invoices/${id}/download`, {
      responseType: "blob",
    }),
};

// Payment APIs
export const PaymentAPI = {
  pay: (
    id: number,
    data: {
      payment_method: string;
      transaction_id?: string;
    }
  ) =>
    api.post(`/payments/${id}/pay`, data),
};

export default api;