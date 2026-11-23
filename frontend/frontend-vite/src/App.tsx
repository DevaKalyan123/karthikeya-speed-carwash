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

// Authentication
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";

// Layouts
import AdminLayout from "./layouts/AdminLayout";
import CustomerLayout from "./layouts/CustomerLayout";

// Admin Pages
import AdminDashboard from "./pages/admin/Dashboard";
import Requests from "./pages/admin/Requests";
import Customers from "./pages/admin/Customers";
import Billing from "./pages/admin/Billing";
import Settings from "./pages/admin/Settings";

// Customer Pages
import CustomerDashboard from "./pages/customer/Dashboard";
import BookService from "./pages/customer/BookService";
import MyRequests from "./pages/customer/MyRequests";
import MyBills from "./pages/customer/MyBills";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>

        <Routes>

          {/* Default Route */}
          <Route
            path="/"
            element={<Navigate to="/login" replace />}
          />

          {/* Authentication */}
          <Route
            path="/login"
            element={<Login />}
          />

          <Route
            path="/register"
            element={<Register />}
          />

          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute role="admin">
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route
              index
              element={<AdminDashboard />}
            />

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
              path="settings"
              element={<Settings />}
            />
          </Route>

          {/* Customer Routes */}
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

          {/* Invalid Route */}
          <Route
            path="*"
            element={<Navigate to="/login" replace />}
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