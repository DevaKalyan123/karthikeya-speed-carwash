import { useEffect, useState } from "react";
import { Users, Car, Clock, IndianRupee } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { toast } from "react-toastify";
import { DashboardAPI } from "../../services/api";

interface PeriodSummary {
  customers: number;
  revenue: string;
}

interface Summary {
  total_customers: number;
  total_requests: number;
  pending_requests: number;
  total_revenue: string;
  daily: PeriodSummary;
  weekly: PeriodSummary;
  monthly: PeriodSummary;
}

interface ChartItem {
  name: string;
  value: number;
}

interface Charts {
  services: ChartItem[];
  request_status: ChartItem[];
  payment_status: ChartItem[];
  payment_methods: ChartItem[];
}

const colors = [
  "#0EA5E9",
  "#22C55E",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#14B8A6",
];

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [charts, setCharts] = useState<Charts | null>(null);
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");

  useEffect(() => {
    DashboardAPI.getSummary()
      .then(({ data }) => setSummary(data.data))
      .catch(() => toast.error("Unable to load summary"));
  }, []);

  useEffect(() => {
    let active = true;

    DashboardAPI.getCharts(period)
      .then(({ data }) => {
        if (active) setCharts(data);
      })
      .catch(() => {
        if (active) toast.error("Unable to load charts");
      });

    return () => {
      active = false;
    };
  }, [period]);

  const cards = [
    { title: "Total Customers", value: summary?.total_customers, icon: Users },
    { title: "Total Requests", value: summary?.total_requests, icon: Car },
    { title: "Pending Requests", value: summary?.pending_requests, icon: Clock },
    { title: "Total Revenue", value: `₹${summary?.total_revenue || 0}`, icon: IndianRupee },
  ];

  const chartCards = [
    { title: "Popular Services", data: charts?.services || [] },
    { title: "Request Status", data: charts?.request_status || [] },
    { title: "Payment Status", data: charts?.payment_status || [] },
    { title: "Revenue by Payment Method", data: charts?.payment_methods || [] },
  ];

  return (
    <div>
      <h1 className="page-title">Dashboard Overview</h1>

      <p className="text-slate-500 mt-2 mb-6">
        Monitor your car wash business performance.
      </p>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map(({ title, value, icon: Icon }) => (
          <div key={title} className="card">
            <div className="bg-sky-100 text-sky-700 w-12 h-12 rounded-xl flex items-center justify-center">
              <Icon />
            </div>

            <p className="text-slate-500 mt-4">{title}</p>
            <h2 className="text-3xl font-bold mt-2">{value ?? "—"}</h2>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-6">
        {(["daily", "weekly", "monthly"] as const).map((item) => (
          <div key={item} className="card">
            <h3 className="capitalize font-bold">{item} Performance</h3>
            <p className="mt-3 text-slate-600">
              Customers: {summary?.[item].customers ?? "—"}
            </p>
            <p className="text-sky-700 font-bold text-xl mt-2">
              ₹{summary?.[item].revenue ?? "0"}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-between items-center gap-4 my-7">
        <h2 className="text-2xl font-bold">Analytics</h2>

        <div className="flex gap-2">
          {(["daily", "weekly", "monthly"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setPeriod(item)}
              className={`px-4 py-2 rounded-lg capitalize ${
                period === item ? "bg-sky-600 text-white" : "bg-white border border-slate-200"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {chartCards.map(({ title, data }) => (
          <div key={title} className="card min-w-0">
            <h3 className="font-bold mb-5">{title}</h3>

            {data.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                  >
                    {data.map((item, index) => (
                      <Cell key={item.name} fill={colors[index % colors.length]} />
                    ))}
                  </Pie>

                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-72 flex items-center justify-center text-slate-500">
                No data available
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}