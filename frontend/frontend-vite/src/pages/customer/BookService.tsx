import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import { ServiceAPI, RequestAPI } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import type { Service } from "../../types";

export default function BookService() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [services, setServices] = useState<Service[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [carName, setCarName] = useState("");
  const [carNumber, setCarNumber] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    ServiceAPI.getAll()
      .then(({ data }) => setServices(data.data))
      .catch(() => toast.error("Unable to load services"));
  }, []);

  const toggleService = (id: number) => {
    setSelected((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    );
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selected.length) {
      toast.error("Select at least one service");
      return;
    }

    setLoading(true);

    try {
      await RequestAPI.create({
        car_name: carName,
        car_number: carNumber.trim().toUpperCase(),
        service_ids: selected,
      });

      toast.success("Service request submitted");
      navigate("/customer/requests");
    } catch {
      toast.error("Unable to submit request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Book Car Wash Service</h1>

      <form onSubmit={submit} className="card mt-6 space-y-6">
        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <label className="field-label">Customer Name</label>
            <input className="form-input" value={user?.name || ""} readOnly />
          </div>

          <div>
            <label className="field-label">Mobile Number</label>
            <input className="form-input" value={user?.mobile || ""} readOnly />
          </div>

          <div>
            <label className="field-label">Car Name</label>
            <input
              className="form-input"
              placeholder="Hyundai Creta"
              value={carName}
              maxLength={100}
              onChange={(e) => setCarName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="field-label">Car Number</label>
            <input
              className="form-input uppercase"
              placeholder="AP39AB1234"
              value={carNumber}
              maxLength={20}
              onChange={(e) => setCarNumber(e.target.value)}
              required
            />
          </div>
        </div>

        <h2 className="text-xl font-bold">Select Services</h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {services.map((service) => (
            <label
              key={service.id}
              className={`flex items-center gap-3 border p-4 rounded-xl cursor-pointer ${
                selected.includes(service.id)
                  ? "bg-sky-50 border-sky-500"
                  : "border-slate-200"
              }`}
            >
              <input
                type="checkbox"
                checked={selected.includes(service.id)}
                onChange={() => toggleService(service.id)}
                className="accent-sky-600 w-5 h-5"
              />

              <span>{service.service_name}</span>
            </label>
          ))}
        </div>

        <button disabled={loading} className="primary-btn">
          {loading ? "Submitting..." : `Submit Request (${selected.length})`}
        </button>
      </form>
    </div>
  );
}