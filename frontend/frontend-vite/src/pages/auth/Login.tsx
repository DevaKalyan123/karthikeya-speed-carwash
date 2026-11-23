import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Phone, Lock } from "lucide-react";
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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = await login(mobile, password);

      toast.success("Login successful");
      navigate(`/${user.role}`, { replace: true });
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-linear-to-br from-sky-100 to-white">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-sky-100 p-8">
        <img
          src={logo}
          alt="Karthikeya Speed"
          className="w-56 mx-auto mb-6"
        />

        <h1 className="text-3xl font-bold text-center">
          Welcome Back
        </h1>

        <p className="text-slate-500 text-center mt-2 mb-8">
          Sign in to manage your car wash services
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="mobile" className="field-label">
              Mobile Number
            </label>

            <div className="flex items-center gap-3 border border-slate-300 rounded-xl px-4">
              <Phone size={20} className="text-slate-400" />

              <input
                id="mobile"
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="Enter mobile number"
                maxLength={10}
                pattern="[6-9][0-9]{9}"
                className="w-full py-3 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="field-label">
              Password
            </label>

            <div className="flex items-center gap-3 border border-slate-300 rounded-xl px-4">
              <Lock size={20} className="text-slate-400" />

              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full min-w-0 py-3 outline-none"
                required
              />

              <button
                type="button"
                aria-label="Toggle password visibility"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </div>

          <button
            disabled={loading}
            className="primary-btn w-full"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          New customer?{" "}
          <Link to="/register" className="text-sky-600 font-semibold">
            Create Account
          </Link>
        </p>
      </div>
    </div>
  );
}