import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

//website

import Website from "./pages/website/Website";

// Authentication
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";

// Layouts
import AdminLayout from "./layouts/AdminLayout";
import CustomerLayout from "./layouts/CustomerLayout";

// Admin Pages
import AdminDashboard from "./pages/admin/Dashboard";
import Requests from "./pages/admin/Requests";
import Customers from "./pages/admin/Customers";
import Billing from "./pages/admin/Billing";
import Settings from "./pages/admin/Settings";
import Services from "./pages/admin/Services";
import PasswordResetRequests from "./pages/admin/PasswordResetRequests";
import ManagementStaff from "./pages/admin/ManagementStaff";

// Customer Pages
import CustomerDashboard from "./pages/customer/Dashboard";
import BookService from "./pages/customer/BookService";
import MyRequests from "./pages/customer/MyRequests";
import MyBills from "./pages/customer/MyBills";

// Management Dashboard
import ManagementDashboard from "./pages/customer/ManagementDashboard";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          

          {/* Default Route */}
         <Route path="/" element={<Website />} />

          {/* Authentication */}
          <Route path="/login" element={<Login />} />

          <Route path="/register" element={<Register />} />

          <Route
            path="/forgot-password"
            element={<ForgotPassword />}
          />

          {/* ========================================== */}
          {/* ADMIN ROUTES */}
          {/* ========================================== */}

          <Route
            path="/admin"
            element={
              <ProtectedRoute role="admin">
                <AdminLayout />
              </ProtectedRoute>
            }
          >

            <Route index element={<AdminDashboard />} />

            <Route
              path="requests"
              element={<Requests />}
            />

            <Route
              path="customers"
              element={<Customers />}
            />

            <Route
              path="billing"
              element={<Billing />}
            />

            <Route
              path="services"
              element={<Services />}
            />

            <Route
              path="management-staff"
              element={<ManagementStaff />}
            />

            <Route
              path="password-reset-requests"
              element={<PasswordResetRequests />}
            />

            <Route
              path="settings"
              element={<Settings />}
            />

          </Route>

          {/* ========================================== */}
          {/* MANAGEMENT STAFF ROUTES */}
          {/* ========================================== */}

          <Route
            path="/management"
            element={
              <ProtectedRoute role="management">
                <CustomerLayout />
              </ProtectedRoute>
            }
          >

            <Route
              index
              element={<ManagementDashboard />}
            />

            <Route
              path="book"
              element={<BookService />}
            />

            <Route
              path="requests"
              element={<MyRequests />}
            />

            <Route
              path="bills"
              element={<MyBills />}
            />

          </Route>

          {/* ========================================== */}
          {/* CUSTOMER ROUTES */}
          {/* ========================================== */}

          <Route
            path="/customer"
            element={
              <ProtectedRoute role="customer">
                <CustomerLayout />
              </ProtectedRoute>
            }
          >

            <Route
              index
              element={<CustomerDashboard />}
            />

            <Route
              path="book"
              element={<BookService />}
            />

            <Route
              path="requests"
              element={<MyRequests />}
            />

            <Route
              path="bills"
              element={<MyBills />}
            />

          </Route>

          {/* Invalid Routes */}

          <Route
  path="*"
  element={<Navigate to="/" replace />}
/>

        </Routes>

        <ToastContainer
          position="top-right"
          autoClose={3000}
        />

      </AuthProvider>
    </BrowserRouter>
  );
}