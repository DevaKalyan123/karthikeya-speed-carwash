import { useEffect, useState } from "react";
import { AdminAPI } from "../../services/api";
import { toast } from "react-toastify";

interface RequestData {
  request_id: number;
  customer_name: string;
  mobile: string;
  village: string;
  car_name: string;
  car_number: string;
  status: string;
  services: {
    service_id: number;
    service_name: string;
    amount: string | null;
  }[];
}

export default function Requests() {
  const [requests, setRequests] = useState<RequestData[]>([]);
  const [selected, setSelected] = useState<RequestData | null>(null);
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  const load = () => {
    AdminAPI.getRequests("Pending")
      .then(({ data }) => setRequests(data.data))
      .catch(() => toast.error("Unable to load requests"));
  };

  useEffect(() => {
    load();
  }, []);

  const generate = async () => {
    if (!selected) return;

    const services = selected.services.map((item) => ({
      service_id: item.service_id,
      amount: amounts[item.service_id] ?? "",
    }));

    if (
      services.some(
        (item) =>
          item.amount.trim() === "" ||
          !/^\d+(\.\d{1,2})?$/.test(item.amount)
      )
    ) {
      toast.error("Enter valid amounts for all services");
      return;
    }

    setSaving(true);

    try {
      await AdminAPI.generateInvoice(selected.request_id, { services });

      toast.success("Invoice generated successfully");

      setSelected(null);
      setAmounts({});
      load();
    } catch {
      toast.error("Invoice generation failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="page-title mb-6">Pending Service Requests</h1>

      <div className="grid lg:grid-cols-2 gap-5">
        {requests.map((req) => (
          <div key={req.request_id} className="card">
            <h2 className="text-xl font-bold">{req.customer_name}</h2>
            <p className="text-slate-500">{req.mobile} · {req.village}</p>

            <p className="font-semibold mt-4">{req.car_name}</p>
            <p>{req.car_number}</p>

            <ul className="list-disc pl-5 my-4 text-slate-600">
              {req.services.map((service) => (
                <li key={service.service_id}>{service.service_name}</li>
              ))}
            </ul>

            <button
              className="primary-btn"
              onClick={() => {
                setAmounts({});
                setSelected(req);
              }}
            >
              Enter Amount & Generate Bill
            </button>
          </div>
        ))}
      </div>

      {!requests.length && <p>No pending requests.</p>}

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-auto">
            <h2 className="text-xl font-bold mb-5">Generate Invoice</h2>

            {selected.services.map((service) => (
              <div key={service.service_id} className="mb-4">
                <label className="field-label">{service.service_name}</label>

                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Enter amount"
                  value={amounts[service.service_id] ?? ""}
                  onChange={(e) =>
                    setAmounts({
                      ...amounts,
                      [service.service_id]: e.target.value,
                    })
                  }
                />
              </div>
            ))}

            <div className="bg-sky-50 p-4 rounded-xl font-bold text-xl">
              Total: ₹
              {Object.values(amounts)
                .reduce((sum, value) => {
                  const amount = Number(value);
                  return sum + (Number.isFinite(amount) ? amount : 0);
                }, 0)
                .toFixed(2)}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={generate}
                disabled={saving}
                className="primary-btn"
              >
                {saving ? "Generating..." : "Generate Bill"}
              </button>

              <button
                onClick={() => setSelected(null)}
                disabled={saving}
                className="secondary-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}