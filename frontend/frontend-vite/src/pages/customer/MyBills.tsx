import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "react-toastify";
import { InvoiceAPI } from "../../services/api";

interface Invoice {
  invoice_id: number;
  invoice_number: string;
  car_name: string;
  car_number: string;
  total_amount: string;
  payment_status: string;
}

export default function MyBills() {
  const [bills, setBills] = useState<Invoice[]>([]);

  useEffect(() => {
    InvoiceAPI.getMyInvoices()
      .then(({ data }) => setBills(data.data))
      .catch(() => toast.error("Unable to load bills"));
  }, []);

  const download = async (bill: Invoice) => {
    try {
      const { data } = await InvoiceAPI.download(bill.invoice_id);
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
      <h1 className="page-title mb-6">My Bills</h1>

      <div className="grid md:grid-cols-2 gap-5">
        {bills.map((bill) => (
          <div key={bill.invoice_id} className="card">
            <div className="flex justify-between">
              <h2 className="font-bold">{bill.invoice_number}</h2>
              <span className="badge">{bill.payment_status}</span>
            </div>

            <p className="mt-4">{bill.car_name}</p>
            <p className="text-slate-500">{bill.car_number}</p>

            <h2 className="text-3xl font-bold mt-5 text-sky-700">
              ₹{bill.total_amount}
            </h2>

            <button
              onClick={() => download(bill)}
              className="primary-btn mt-5 flex items-center gap-2"
            >
              <Download size={18} /> Download Bill
            </button>
          </div>
        ))}
      </div>

      {!bills.length && <p>No bills available yet.</p>}
    </div>
  );
}