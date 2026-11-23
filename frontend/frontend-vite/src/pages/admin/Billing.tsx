import { useEffect, useState } from "react";
import { AdminAPI, InvoiceAPI, PaymentAPI } from "../../services/api";
import { toast } from "react-toastify";

interface Bill {
  request_id: number;
  invoice_id: number;
  invoice_number: string;
  customer_name: string;
  total_amount: string;
  payment_status: string;
}

export default function Billing() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [selected, setSelected] = useState<Bill | null>(null);
  const [method, setMethod] = useState("Cash");
  const [transactionId, setTransactionId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    AdminAPI.getRequests("Billed")
      .then(({ data }) => setBills(data.data))
      .catch(() => toast.error("Unable to load bills"));
  };

  useEffect(() => {
    load();
  }, []);

  const pay = async () => {
    if (!selected) return;

    if (method !== "Cash" && !transactionId.trim()) {
      toast.error("Transaction ID is required");
      return;
    }

    setSaving(true);

    try {
      await PaymentAPI.pay(selected.invoice_id, {
        payment_method: method,
        transaction_id: method === "Cash" ? undefined : transactionId.trim(),
      });

      toast.success("Payment recorded");
      setSelected(null);
      load();
    } catch {
      toast.error("Payment could not be recorded");
    } finally {
      setSaving(false);
    }
  };

  const download = async (bill: Bill) => {
    try {
      const { data } = await InvoiceAPI.download(bill.invoice_id);

      const url = URL.createObjectURL(data);
      const link = document.createElement("a");

      link.href = url;
      link.download = `${bill.invoice_number}.pdf`;
      link.click();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("Download failed");
    }
  };

  return (
    <div>
      <h1 className="page-title mb-6">Billing & Payments</h1>

      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Customer</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {bills.map((bill) => (
              <tr key={bill.invoice_id}>
                <td>{bill.invoice_number}</td>
                <td>{bill.customer_name}</td>
                <td>₹{bill.total_amount}</td>
                <td>
                  <span className="badge">{bill.payment_status}</span>
                </td>

                <td>
                  <div className="flex gap-3">
                    {bill.payment_status !== "Paid" && (
                      <button
                        className="primary-btn"
                        onClick={() => {
                          setSelected(bill);
                          setMethod("Cash");
                          setTransactionId("");
                        }}
                      >
                        Record Payment
                      </button>
                    )}

                    <button
                      className="secondary-btn"
                      onClick={() => download(bill)}
                    >
                      PDF
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!bills.length && <p className="py-5">No bills available.</p>}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold">Record Payment</h2>

            <p className="text-3xl font-bold text-sky-600 my-5">
              ₹{selected.total_amount}
            </p>

            <label className="field-label">Payment Method</label>

            <select
              className="form-input"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option>Cash</option>
              <option>UPI</option>
              <option>Card</option>
            </select>

            {method !== "Cash" && (
              <input
                className="form-input mt-4"
                placeholder="Transaction ID"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
              />
            )}

            <div className="flex gap-3 mt-6">
              <button disabled={saving} className="primary-btn" onClick={pay}>
                {saving ? "Saving..." : "Confirm Received Payment"}
              </button>

              <button
                disabled={saving}
                className="secondary-btn"
                onClick={() => setSelected(null)}
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