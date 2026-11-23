import { useEffect, useState } from "react";
import { AdminAPI } from "../../services/api";
import { Download, Search } from "lucide-react";
import { toast } from "react-toastify";

interface Customer {
  customer_id: number;
  name: string;
  mobile: string;
  village: string;
  total_visits: number;
  vehicles: {
    vehicle_id: number;
    car_name: string;
    car_number: string;
  }[];
}

interface HistoryItem {
  request_id: number;
  car_name: string;
  car_number: string;
  status: string;
  total_amount: string | null;
  created_at: string;
}

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [history, setHistory] = useState<HistoryItem[] | null>(null);

  useEffect(() => {
    let active = true;

    const timer = setTimeout(() => {
      AdminAPI.getCustomers(search)
        .then(({ data }) => {
          if (active) setCustomers(data.data);
        })
        .catch(() => {
          if (active) toast.error("Unable to load customers");
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search]);

  const download = async () => {
    try {
      const { data } = await AdminAPI.exportCustomers(search);
      const url = URL.createObjectURL(data);

      const link = document.createElement("a");
      link.href = url;
      link.download = "Karthikeya_Customers.xlsx";
      link.click();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("Export failed");
    }
  };

  const viewHistory = async (id: number) => {
    try {
      const { data } = await AdminAPI.getCustomerHistory(id);
      setHistory(data.data);
    } catch {
      toast.error("Unable to load history");
    }
  };

  return (
    <div>
      <h1 className="page-title mb-6">Customers</h1>

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex items-center border border-slate-200 bg-white rounded-xl px-4 grow">
          <Search size={20} className="text-slate-400" />

          <input
            className="w-full outline-none p-3"
            placeholder="Search name, mobile, car number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button
          className="primary-btn flex items-center gap-2"
          onClick={download}
        >
          <Download size={18} /> Export Excel
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Mobile</th>
              <th>Village</th>
              <th>Vehicles</th>
              <th>Visits</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {customers.map((customer) => (
              <tr key={customer.customer_id}>
                <td>{customer.name}</td>
                <td>{customer.mobile}</td>
                <td>{customer.village}</td>
                <td>
                  {customer.vehicles.map((vehicle) => (
                    <div key={vehicle.vehicle_id}>{vehicle.car_number}</div>
                  ))}
                </td>
                <td>{customer.total_visits}</td>
                <td>
                  <button
                    className="text-sky-600 font-semibold"
                    onClick={() => viewHistory(customer.customer_id)}
                  >
                    View History
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!customers.length && <p className="py-5">No customers found.</p>}
      </div>

      {history !== null && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl max-h-[85vh] overflow-auto">
            <h2 className="text-xl font-bold mb-5">Service History</h2>

            {history.map((item) => (
              <div key={item.request_id} className="border-b border-slate-200 py-4">
                <p className="font-bold">{item.car_name}</p>
                <p>{item.car_number}</p>
                <p>Status: {item.status}</p>
                <p>Amount: {item.total_amount ? `₹${item.total_amount}` : "Pending"}</p>
                <p className="text-sm text-slate-500">
                  {new Date(item.created_at).toLocaleDateString("en-IN")}
                </p>
              </div>
            ))}

            {!history.length && <p>No previous service records.</p>}

            <button className="secondary-btn mt-5" onClick={() => setHistory(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}