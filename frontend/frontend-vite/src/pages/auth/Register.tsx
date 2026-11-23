import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "axios";

import { AuthAPI } from "../../services/api";
import logo from "../../assets/logo.png";

export default function Register() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    mobile: "",
    village: "",
    password: "",
  });

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      await AuthAPI.register(form);

      toast.success("Registration successful");
      navigate("/login");
    } catch (error) {
      toast.error(
        axios.isAxiosError(error)
          ? error.response?.data?.message || "Registration failed"
          : "Registration failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-sky-50">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl p-8">
        <img
          src={logo}
          alt="Karthikeya Speed"
          className="w-52 mx-auto mb-5"
        />

        <h1 className="text-2xl font-bold text-center">
          Create Account
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div>
            <label className="field-label" htmlFor="name">
              Customer Name
            </label>

            <input
              id="name"
              className="form-input"
              value={form.name}
              maxLength={100}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="field-label" htmlFor="mobile">
              Mobile Number
            </label>

            <input
              id="mobile"
              className="form-input"
              type="tel"
              maxLength={10}
              pattern="[6-9][0-9]{9}"
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="field-label" htmlFor="village">
              Village / City
            </label>

            <input
              id="village"
              className="form-input"
              value={form.village}
              maxLength={150}
              onChange={(e) => setForm({ ...form, village: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="field-label" htmlFor="password">
              Password
            </label>

            <input
              id="password"
              type="password"
              className="form-input"
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <button disabled={loading} className="primary-btn w-full">
            {loading ? "Creating Account..." : "Register"}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-slate-500">
          Already registered?{" "}
          <Link to="/login" className="text-sky-600 font-semibold">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}