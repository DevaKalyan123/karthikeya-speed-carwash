import { useState } from "react";
import type { FormEvent } from "react";

import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  Eye,
  EyeOff,
  ArrowLeft,
  Clock,
} from "lucide-react";

import axios from "axios";
import { toast } from "react-toastify";
import { AuthAPI } from "../../services/api";
import logo from "../../assets/logo.png";

export default function ForgotPassword() {

  const navigate = useNavigate();
  const location = useLocation();

  const [mobile, setMobile] = useState(
    typeof location.state?.mobile === "string"
      ? location.state.mobile
      : ""
  );

  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);

  const [step, setStep] =
    useState<"request" | "reset">("request");

  const submit = async (
    e: FormEvent<HTMLFormElement>
  ) => {

    e.preventDefault();

    if (loading) return;

    if (!/^[6-9][0-9]{9}$/.test(mobile)) {

      toast.error("Enter a valid mobile number");
      return;
    }

    if (step === "reset") {

      if (!/^[0-9]{6}$/.test(otp)) {

        toast.error("Enter six-digit reset code");
        return;
      }

      if (
        password.length < 8 ||
        password.length > 128
      ) {

        toast.error(
          "Password must contain 8 to 128 characters"
        );
        return;
      }

      if (password !== confirm) {

        toast.error("Passwords do not match");
        return;
      }
    }

    setLoading(true);

    try {

      if (step === "request") {

        const { data } =
          await AuthAPI.forgotPassword(mobile);

        toast.success(data.message);

        setStep("reset");

      } else {

        const { data } =
          await AuthAPI.resetPassword({

            mobile,

            otp,

            new_password: password,
          });

        toast.success(data.message);

        navigate("/login", {
          replace: true,
        });
      }

    } catch (error) {

      toast.error(
        axios.isAxiosError(error)
          ? error.response?.data?.message ||
            "Request failed"
          : "Request failed"
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

        <h1 className="text-2xl font-bold text-center">

          {step === "request"
            ? "Forgot Password?"
            : "Reset Password"}

        </h1>

        <p className="text-slate-500 text-center mt-2 mb-6">

          {step === "request"
            ? "Submit a password reset request to the administrator."
            : "Enter the reset code provided by the administrator."}

        </p>

        {step === "reset" && (

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">

            <p className="text-amber-800 font-semibold flex gap-2 items-center">
              <Clock size={18} />
              Admin Verification Required
            </p>

            <p className="text-sm text-amber-700 mt-2">
              Contact the service center.
              After verifying your identity, the administrator
              will provide a six-digit reset code.
            </p>

          </div>
        )}

        <form onSubmit={submit} className="space-y-4">

          <div>

            <label className="field-label">
              Registered Mobile Number
            </label>

            <input
              type="tel"
              className="form-input"
              value={mobile}
              onChange={(e) =>
                setMobile(e.target.value)
              }
              maxLength={10}
              pattern="[6-9][0-9]{9}"
              required
              readOnly={step === "reset"}
              disabled={loading}
            />

          </div>

          {step === "reset" && (

            <>

              <div>

                <label className="field-label">
                  Reset Code
                </label>

                <input
                  className="form-input"
                  value={otp}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  onChange={(e) =>
                    setOtp(
                      e.target.value.replace(/\D/g, "")
                    )
                  }
                  placeholder="Enter admin reset code"
                  required
                />

              </div>

              <div>

                <label className="field-label">
                  New Password
                </label>

                <div className="flex items-center gap-3 border border-slate-300 rounded-xl px-4">

                  <input
                    className="w-full min-w-0 py-3 outline-none"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={password}
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    required
                  />

                  <button
                    type="button"
                    aria-label="Toggle password visibility"
                    onClick={() =>
                      setShowPassword(!showPassword)
                    }
                  >
                    {showPassword
                      ? <EyeOff />
                      : <Eye />}
                  </button>

                </div>

              </div>

              <div>

                <label className="field-label">
                  Confirm Password
                </label>

                <input
                  className="form-input"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={confirm}
                  onChange={(e) =>
                    setConfirm(e.target.value)
                  }
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  required
                />

              </div>

            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="primary-btn w-full"
          >

            {loading
              ? "Please wait..."
              : step === "request"
              ? "Send Reset Request"
              : "Reset Password"}

          </button>

          {step === "request" && (

            <button
              type="button"
              className="secondary-btn w-full"
              onClick={() => {

                if (!/^[6-9][0-9]{9}$/.test(mobile)) {

                  toast.error("Enter registered mobile number");
                  return;
                }

                setStep("reset");

              }}
            >
              Already Have a Reset Code?
            </button>
          )}

          {step === "reset" && (

            <button
              type="button"
              disabled={loading}
              className="secondary-btn w-full"
              onClick={() => {

                setStep("request");
                setOtp("");
                setPassword("");
                setConfirm("");

              }}
            >
              Back to Reset Request
            </button>
          )}

        </form>

        <Link
          to="/login"
          className="flex justify-center items-center gap-2 mt-6 text-sky-700 font-semibold text-sm"
        >
          <ArrowLeft size={16} />
          Back to Login
        </Link>

      </div>
    </div>
  );
}