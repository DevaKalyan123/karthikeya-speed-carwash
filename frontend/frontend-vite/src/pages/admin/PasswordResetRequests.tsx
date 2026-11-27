import { useEffect, useState } from "react";

import {
  KeyRound,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { toast } from "react-toastify";
import axios from "axios";

import {
  PasswordResetAPI,
} from "../../services/api";

interface ResetRequest {
  user_id: number;
  name: string;
  mobile: string;
  village: string | null;
  status: string;
  requested_at: string | null;
  approved_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
}

const statusClass = (status: string) => {

  switch (status) {

    case "Pending":
      return "bg-amber-100 text-amber-700";

    case "Code Generated":
      return "bg-sky-100 text-sky-700";

    case "Completed":
      return "bg-green-100 text-green-700";

    default:
      return "bg-red-100 text-red-700";
  }
};

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      })
    : "—";

export default function PasswordResetRequests() {

  const [requests, setRequests] =
    useState<ResetRequest[]>([]);

  const [selected, setSelected] =
    useState<ResetRequest | null>(null);

  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] = useState(false);

  const [saving, setSaving] = useState(false);

  const [verified, setVerified] = useState(false);

  const [resetCode, setResetCode] = useState("");

  const load = async () => {

    setLoading(true);
    setLoadError(false);

    try {

      const { data } =
        await PasswordResetAPI.getAll();

      setRequests(data.data);

    } catch {

      setLoadError(true);

      toast.error(
        "Unable to load password reset requests"
      );

    } finally {

      setLoading(false);
    }
  };

  useEffect(() => {

    void load();

  }, []);

  const approve = async () => {

    if (!selected || saving) return;

    if (!verified) {

      toast.error("Verify customer identity first");
      return;
    }

    setSaving(true);

    try {

      const { data } =
        await PasswordResetAPI.approve(
          selected.user_id
        );

      setResetCode(data.reset_code);

      toast.success("Reset code generated");

      await load();

    } catch (error) {

      toast.error(
        axios.isAxiosError(error)
          ? error.response?.data?.message ||
            "Unable to generate reset code"
          : "Unable to generate reset code"
      );

    } finally {

      setSaving(false);
    }
  };

  const closeModal = () => {

    setSelected(null);
    setVerified(false);
    setResetCode("");
  };

  const pendingCount = requests.filter(
    (item) => item.status === "Pending"
  ).length;

  return (

    <div>

      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">

        <div>

          <h1 className="page-title">
            Password Reset Requests
          </h1>

          <p className="text-slate-500 mt-2">
            Verify customers and assist with password recovery.
          </p>

        </div>

        <button
          className="secondary-btn flex items-center gap-2"
          onClick={load}
          disabled={loading || saving}
        >
          <RefreshCw size={18} />
          Refresh
        </button>

      </div>

      <div className="card mb-6 flex gap-4 items-center">

        <div className="bg-amber-100 text-amber-700 rounded-xl p-4">
          <KeyRound size={25} />
        </div>

        <div>

          <p className="text-slate-500">
            Pending Reset Requests
          </p>

          <h2 className="text-3xl font-bold">
            {loading ? "—" : pendingCount}
          </h2>

        </div>

      </div>

      <div className="card overflow-x-auto">

        {loading ? (

          <p>Loading reset requests...</p>

        ) : loadError ? (

          <p className="text-red-600">
            Unable to load requests. Please refresh.
          </p>

        ) : (

          <table className="data-table">

            <thead>

              <tr>
                <th>Customer Name</th>
                <th>Mobile Number</th>
                <th>Village</th>
                <th>Requested At</th>
                <th>Status</th>
                <th>Action</th>
              </tr>

            </thead>

            <tbody>

              {requests.map((item) => (

                <tr key={item.user_id}>

                  <td className="font-semibold">
                    {item.name}
                  </td>

                  <td>{item.mobile}</td>

                  <td>{item.village || "—"}</td>

                  <td>
                    {formatDate(item.requested_at)}
                  </td>

                  <td>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        statusClass(item.status)
                      }`}
                    >
                      {item.status}
                    </span>

                  </td>

                  <td>

                    {item.status === "Pending" ? (

                      <button
                        className="primary-btn"
                        onClick={() => {

                          setSelected(item);

                          setResetCode("");

                          setVerified(false);

                        }}
                      >
                        Verify & Generate Code
                      </button>

                    ) : (

                      <span className="text-sm text-slate-500">
                        {item.status === "Completed"
                          ? "Password Reset Completed"
                          : item.status === "Expired"
                          ? "Request Again"
                          : "Waiting for customer"}
                      </span>

                    )}

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        )}

        {!loading &&
          !loadError &&
          !requests.length && (

            <p className="py-5">
              No password reset requests found.
            </p>

          )}

      </div>

      {/* Verification Modal */}

      {selected && (

        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Password reset verification"
            className="bg-white rounded-2xl p-6 w-full max-w-md"
          >

            <h2 className="text-xl font-bold flex gap-2 items-center">

              <ShieldCheck className="text-sky-600" />

              Customer Verification

            </h2>

            <div className="bg-slate-50 rounded-xl p-4 space-y-2 my-5">

              <p>
                <strong>Name:</strong> {selected.name}
              </p>

              <p>
                <strong>Mobile:</strong> {selected.mobile}
              </p>

              <p>
                <strong>Village:</strong> {selected.village || "—"}
              </p>

            </div>

            {!resetCode ? (

              <>

                <p className="text-sm text-slate-600 mb-4">
                  Verify the customer's identity in person or
                  through a trusted contact before generating a code.
                  Knowing only their mobile number is not sufficient.
                </p>

                <label className="flex gap-3 items-start border rounded-xl p-4 mb-5">

                  <input
                    type="checkbox"
                    checked={verified}
                    onChange={(e) =>
                      setVerified(e.target.checked)
                    }
                    className="accent-sky-600 mt-1"
                    disabled={saving}
                  />

                  <span className="text-sm font-semibold">
                    I have verified this customer's identity.
                  </span>

                </label>

                <button
                  className="primary-btn w-full"
                  disabled={saving || !verified}
                  onClick={approve}
                >

                  {saving
                    ? "Generating..."
                    : "Generate Reset Code"}

                </button>

              </>

            ) : (

              <div className="bg-green-50 border border-green-200 rounded-xl text-center p-5">

                <p className="text-green-700 font-semibold">
                  One-Time Reset Code
                </p>

                <h2 className="text-4xl tracking-widest font-bold text-green-800 my-5">
                  {resetCode}
                </h2>

                <p className="text-sm text-green-700">
                  Valid for 5 minutes. Share privately with the
                  verified customer only.
                </p>

                <p className="text-xs mt-3 text-slate-500">
                  This code cannot be viewed again after closing.
                </p>

              </div>

            )}

            <button
              className="secondary-btn w-full mt-4"
              onClick={closeModal}
              disabled={saving}
            >
              {resetCode ? "Done" : "Cancel"}
            </button>

          </div>
        </div>

      )}

    </div>
  );
}