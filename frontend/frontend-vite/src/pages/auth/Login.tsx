import { useState } from "react";
import type { FormEvent } from "react";

import { Link, useNavigate } from "react-router-dom";

import {
  Eye,
  EyeOff,
  Phone,
  Lock,
  ArrowLeft,
} from "lucide-react";

import { toast } from "react-toastify";
import axios from "axios";

import { useAuth } from "../../context/AuthContext";
import logo from "../../assets/logo.png";

export default function Login() {

  const navigate = useNavigate();

  const { login } = useAuth();

  const [mobile, setMobile] = useState("");

  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  // Handle Login

  const handleSubmit = async (
    e: FormEvent<HTMLFormElement>
  ) => {

    e.preventDefault();

    if (loading) return;

    setLoading(true);

    try {

      const user = await login(
        mobile.trim(),
        password
      );

      toast.success("Login successful");

      // Role Based Dashboard Navigation

      navigate(`/${user.role}`, {
        replace: true,
      });

    } catch (error) {

      toast.error(
        axios.isAxiosError(error)
          ? error.response?.data?.message || "Login failed"
          : "Login failed"
      );

    } finally {

      setLoading(false);

    }
  };

  return (

    <div className="min-h-screen flex items-center justify-center p-4 bg-linear-to-br from-sky-100 via-white to-sky-50">

      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-sky-100 p-6 sm:p-8">

        {/* Back to Website */}

        <Link
          to="/"
          className="inline-flex items-center gap-2 mb-6 text-sm font-semibold text-sky-600 hover:text-sky-800 transition-colors"
        >
          <ArrowLeft size={19} />

          Back to Website
        </Link>

        {/* Company Logo */}

        <img
          src={logo}
          alt="Karthikeya Speed Car Wash"
          className="w-56 mx-auto mb-6"
        />

        {/* Login Heading */}

        <h1 className="text-3xl font-bold text-center text-slate-900">
          Welcome Back
        </h1>

        <p className="text-slate-500 text-center mt-2 mb-8">
          Sign in to manage your car wash services
        </p>

        {/* Login Form */}

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >

          {/* Mobile Number */}

          <div>

            <label
              htmlFor="mobile"
              className="field-label"
            >
              Mobile Number
            </label>

            <div className="flex items-center gap-3 border border-slate-300 rounded-xl px-4 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100">

              <Phone
                size={20}
                className="text-slate-400 shrink-0"
              />

              <input
                id="mobile"
                type="tel"
                inputMode="numeric"
                autoComplete="username"
                value={mobile}
                onChange={(e) =>
                  setMobile(
                    e.target.value.replace(/\D/g, "")
                  )
                }
                placeholder="Enter mobile number"
                maxLength={10}
                pattern="[6-9][0-9]{9}"
                className="w-full py-3 outline-none"
                required
                disabled={loading}
              />

            </div>

          </div>

          {/* Password */}

          <div>

            <label
              htmlFor="password"
              className="field-label"
            >
              Password
            </label>

            <div className="flex items-center gap-3 border border-slate-300 rounded-xl px-4 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-100">

              <Lock
                size={20}
                className="text-slate-400 shrink-0"
              />

              <input
                id="password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                autoComplete="current-password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder="Enter password"
                className="w-full min-w-0 py-3 outline-none"
                required
                disabled={loading}
              />

              <button
                type="button"
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
                className="text-slate-500 hover:text-sky-600"
                onClick={() =>
                  setShowPassword(!showPassword)
                }
              >

                {showPassword
                  ? <EyeOff size={21} />
                  : <Eye size={21} />}

              </button>

            </div>

            {/* Forgot Password */}

            <div className="text-right mt-3">

              <Link
                to="/forgot-password"
                state={{ mobile }}
                className="text-sky-700 font-semibold text-sm hover:underline"
              >
                Forgot Password?
              </Link>

            </div>

          </div>

          {/* Sign In Button */}

          <button
            type="submit"
            disabled={loading}
            className="primary-btn w-full"
          >

            {loading
              ? "Signing in..."
              : "Sign In"}

          </button>

        </form>

        {/* Customer Registration */}

        <p className="text-center text-sm text-slate-500 mt-6">

          New customer?{" "}

          <Link
            to="/register"
            className="text-sky-600 font-semibold hover:underline"
          >
            Create Account
          </Link>

        </p>

        {/* Footer */}

        <div className="border-t border-slate-100 mt-6 pt-5 text-center">

          <p className="text-xs text-slate-400">
            Karthikeya Speed Car Wash & Detail
          </p>

          <p className="text-xs text-slate-400 mt-1">
            Vijayawada, Andhra Pradesh
          </p>

        </div>

      </div>

    </div>

  );
}