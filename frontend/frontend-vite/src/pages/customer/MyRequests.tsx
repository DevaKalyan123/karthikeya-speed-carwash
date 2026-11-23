import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { RequestAPI } from "../../services/api";

interface RequestData {
  request_id: number;
  car_name: string;
  car_number: string;
  created_at: string;
  status: string;
  services: {
    service_id: number;
    service_name: string;
    amount: string | null;
  }[];
}

export default function MyRequests() {
  const [requests, setRequests] = useState<RequestData[]>([]);

  useEffect(() => {
    RequestAPI.getMyRequests()
      .then(({ data }) => setRequests(data.data))
      .catch(() => toast.error("Unable to load requests"));
  }, []);

  return (
    <div>
      <h1 className="page-title mb-6">My Service Requests</h1>

      <div className="grid md:grid-cols-2 gap-5">
        {requests.map((req) => (
          <div key={req.request_id} className="card">
            <div className="flex justify-between gap-3">
              <h2 className="text-xl font-bold">{req.car_name}</h2>

              <span className="badge">{req.status}</span>
            </div>

            <p className="text-slate-500 mt-2">{req.car_number}</p>

            <p className="text-sm text-slate-400 mt-1">
              {new Date(req.created_at).toLocaleDateString("en-IN")}
            </p>

            <div className="border-t border-slate-200 mt-4 pt-4 space-y-3">
              {req.services.map((service) => (
                <div key={service.service_id} className="flex justify-between gap-3">
                  <span>{service.service_name}</span>

                  <span className="font-semibold whitespace-nowrap">
                    {service.amount === null
                      ? "Pending"
                      : `₹${service.amount}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {!requests.length && <p>No service requests yet.</p>}
    </div>
  );
}