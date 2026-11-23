import { Link } from "react-router-dom";
import { Car, Receipt, ClipboardList } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();

  const cards = [
    {
      title: "Book a Service",
      description: "Choose services for your vehicle",
      icon: Car,
      to: "/customer/book",
    },
    {
      title: "My Requests",
      description: "Track your service requests",
      icon: ClipboardList,
      to: "/customer/requests",
    },
    {
      title: "My Bills",
      description: "View and download your invoices",
      icon: Receipt,
      to: "/customer/bills",
    },
  ];

  return (
    <div>
      <div className="rounded-3xl bg-linear-to-r from-sky-700 to-sky-500 text-white p-7 md:p-12 mb-8">
        <p className="text-sky-100">Karthikeya Speed Car Wash & Detail</p>

        <h1 className="text-3xl md:text-4xl font-bold mt-3">
          Welcome, {user?.name}!
        </h1>

        <p className="mt-3">Give your car the care it deserves.</p>

        <Link
          to="/customer/book"
          className="inline-block mt-6 bg-white text-sky-700 px-6 py-3 rounded-xl font-semibold"
        >
          Book Now
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {cards.map(({ title, description, icon: Icon, to }) => (
          <Link key={to} to={to} className="card hover:border-sky-400">
            <Icon size={32} className="text-sky-600 mb-5" />
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="text-slate-500 mt-2">{description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}