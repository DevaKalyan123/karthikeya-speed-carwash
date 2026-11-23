import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import {
  UserRound,
  ShieldCheck,
  Save,
  Eye,
  EyeOff,
} from "lucide-react";

import axios from "axios";
import { toast } from "react-toastify";

import { AdminAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

export default function Settings() {
  const { logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    name: "",
    mobile: "",
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  // Load Admin Profile
  useEffect(() => {
    AdminAPI.getProfile()
      .then(({ data }) => {
        setForm((previous) => ({
          ...previous,
          name: data.data.name,
          mobile: data.data.mobile,
        }));
      })
      .catch(() => {
        setLoadError(true);
        toast.error("Unable to load admin profile");
      })
      .finally(() => setLoading(false));
  }, []);

  // Update Admin Profile
  const updateProfile = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (form.new_password !== form.confirm_password) {
      toast.error("Passwords do not match");
      return;
    }

    if (
      form.new_password &&
      form.new_password.length < 8
    ) {
      toast.error(
        "Password must contain at least 8 characters"
      );

      return;
    }

    setSaving(true);

    try {
      const { data } = await AdminAPI.updateProfile({
        name: form.name,
        mobile: form.mobile,
        current_password: form.current_password,
        new_password: form.new_password,
      });

      toast.success(data.message);

      logout();

    } catch (error) {
      toast.error(
        axios.isAxiosError(error)
          ? error.response?.data?.message ||
              "Profile update failed"
          : "Profile update failed"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        Loading admin profile...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="card text-red-600">
        Unable to load profile. Please refresh the page.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">

      <h1 className="page-title">
        Account Settings
      </h1>

      <p className="text-slate-500 mt-2 mb-6">
        Manage your administrator account and security.
      </p>

      <form
        onSubmit={updateProfile}
        className="space-y-6"
      >

        {/* Personal Information */}
        <div className="card">
          <div className="flex items-center gap-3 mb-6">

            <div className="bg-sky-100 text-sky-600 p-3 rounded-xl">
              <UserRound size={24} />
            </div>

            <div>
              <h2 className="text-xl font-bold">
                Personal Information
              </h2>

              <p className="text-sm text-slate-500">
                Update your administrator details
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-5">

            <div>
              <label
                htmlFor="admin-name"
                className="field-label"
              >
                Admin Name
              </label>

              <input
                id="admin-name"
                className="form-input"
                value={form.name}
                maxLength={100}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                  })
                }
                required
              />
            </div>

            <div>
              <label
                htmlFor="admin-mobile"
                className="field-label"
              >
                Mobile Number
              </label>

              <input
                id="admin-mobile"
                type="tel"
                className="form-input"
                value={form.mobile}
                maxLength={10}
                pattern="[6-9][0-9]{9}"
                onChange={(e) =>
                  setForm({
                    ...form,
                    mobile: e.target.value,
                  })
                }
                required
              />
            </div>
          </div>
        </div>

        {/* Password Security */}
        <div className="card">

          <div className="flex items-center gap-3 mb-6">
            <div className="bg-green-100 text-green-600 p-3 rounded-xl">
              <ShieldCheck size={24} />
            </div>

            <div>
              <h2 className="text-xl font-bold">
                Password & Security
              </h2>

              <p className="text-sm text-slate-500">
                Change your administrator password
              </p>
            </div>
          </div>

          <div className="space-y-5">

            {/* Current Password */}
            <div>
              <label
                htmlFor="current-password"
                className="field-label"
              >
                Current Password
              </label>

              <div className="relative">
                <input
                  id="current-password"
                  type={showPassword ? "text" : "password"}
                  className="form-input pr-12"
                  placeholder="Enter current password"
                  autoComplete="current-password"
                  value={form.current_password}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      current_password: e.target.value,
                    })
                  }
                  required
                />

                <button
                  type="button"
                  aria-label="Toggle password visibility"
                  className="absolute right-4 top-3 text-slate-500"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                >
                  {showPassword ? (
                    <EyeOff size={20} />
                  ) : (
                    <Eye size={20} />
                  )}
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5">

              {/* New Password */}
              <div>
                <label
                  htmlFor="new-password"
                  className="field-label"
                >
                  New Password
                </label>

                <input
                  id="new-password"
                  type="password"
                  className="form-input"
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                  minLength={8}
                  value={form.new_password}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      new_password: e.target.value,
                    })
                  }
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="confirm-password"
                  className="field-label"
                >
                  Confirm New Password
                </label>

                <input
                  id="confirm-password"
                  type="password"
                  className="form-input"
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  value={form.confirm_password}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      confirm_password: e.target.value,
                    })
                  }
                  required={Boolean(form.new_password)}
                />
              </div>
            </div>

            <p className="text-sm text-slate-500">
              Leave the new password fields empty if you
              only want to update your name or mobile number.
            </p>
          </div>
        </div>

        {/* Information */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          After saving your changes, you will be logged out.
          Please sign in again using your updated credentials.
        </div>

        {/* Save Button */}
        <button
          type="submit"
          disabled={saving}
          className="primary-btn flex items-center gap-2"
        >
          <Save size={20} />

          {saving ? "Saving Changes..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}