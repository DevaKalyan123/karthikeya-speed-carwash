import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "react-toastify";
import { InvoiceAPI } from "../../services/api";

interface Invoice {
  invoice_id: number;
  invoice_number: string;
  car_name: string;
  car_number: string;
  subtotal: string;
  discount_amount: string;
  total_amount: string;
  payment_status: string;

  services: {
    service_name: string;
    amount: string;
  }[];
}

export default function MyBills() {

  const [bills, setBills] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {

    InvoiceAPI.getMyInvoices()
      .then(({ data }) => setBills(data.data))
      .catch(() => toast.error("Unable to load bills"))
      .finally(() => setLoading(false));

  }, []);

  const download = async (bill: Invoice) => {

    try {

      const { data } = await InvoiceAPI.download(
        bill.invoice_id
      );

      const url = URL.createObjectURL(data);

      const link = document.createElement("a");

      link.href = url;
      link.download = `${bill.invoice_number}.pdf`;

      link.click();

      setTimeout(() => URL.revokeObjectURL(url), 1000);

    } catch {
      toast.error("PDF download failed");
    }
  };

  return (
    <div>

      <h1 className="page-title mb-6">
        My Bills
      </h1>

      {loading && <p>Loading bills...</p>}

      <div className="grid md:grid-cols-2 gap-5">

        {bills.map((bill) => (

          <div key={bill.invoice_id} className="card">

            <div className="flex justify-between gap-3">

              <h2 className="font-bold text-lg">
                {bill.invoice_number}
              </h2>

              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                bill.payment_status === "Paid"
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700"
              }`}>
                {bill.payment_status}
              </span>

            </div>

            <p className="mt-4 font-semibold">
              {bill.car_name}
            </p>

            <p className="text-slate-500">
              {bill.car_number}
            </p>

            {/* Service Details */}
            <div className="border-t border-slate-200 mt-5 pt-4 space-y-3">

              {bill.services.map((service, index) => (

                <div
                  key={index}
                  className="flex justify-between gap-3 text-sm"
                >

                  <span>
                    {service.service_name}
                  </span>

                  <span className="font-semibold shrink-0">
                    ₹{service.amount}
                  </span>

                </div>
              ))}

            </div>

            {/* Invoice Summary */}
            <div className="border-t border-slate-200 mt-5 pt-4 space-y-3">

              <div className="flex justify-between">

                <span>Subtotal</span>

                <span className="font-semibold">
                  ₹{bill.subtotal}
                </span>

              </div>

              <div className="flex justify-between text-green-700">

                <span>Discount</span>

                <span className="font-semibold">

                  {Number(bill.discount_amount) > 0
                    ? `- ₹${bill.discount_amount}`
                    : "No Discount"}

                </span>

              </div>

              <div className="bg-sky-50 p-4 rounded-xl flex justify-between items-center flex-wrap gap-3">

                <span className="font-semibold">
                  Final Amount
                </span>

                <span className="text-2xl font-bold text-sky-700">
                  ₹{bill.total_amount}
                </span>

              </div>

            </div>

            <button
              onClick={() => download(bill)}
              className="primary-btn mt-5 flex items-center gap-2"
            >
              <Download size={18} />
              Download Bill
            </button>

          </div>
        ))}
      </div>

      {!loading && !bills.length && (
        <p>No bills available yet.</p>
      )}

    </div>
  );
}