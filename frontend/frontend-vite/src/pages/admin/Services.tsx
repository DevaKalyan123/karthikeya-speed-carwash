import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import {
  Plus,
  Search,
  Pencil,
  X,
  Wrench,
  CheckCircle2,
  Ban,
  IndianRupee,
} from "lucide-react";

import axios from "axios";
import { toast } from "react-toastify";

import { ServiceAPI } from "../../services/api";
import type { Service } from "../../types";

const initialForm = {
  service_name: "",
  description: "",
  price: "",
};

export default function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] =
    useState<Service | null>(null);

  const [form, setForm] = useState(initialForm);

  // Load all services
  const loadServices = async () => {
    setLoading(true);
    setLoadError(false);

    try {
      const { data } = await ServiceAPI.getAllAdmin();
      setServices(data.data);
    } catch {
      setLoadError(true);
      toast.error("Unable to load services");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  // Add Service Modal
  const openAddModal = () => {
    setEditingService(null);
    setForm(initialForm);
    setModalOpen(true);
  };

  // Edit Service Modal
  const openEditModal = (service: Service) => {
    setEditingService(service);

    setForm({
      service_name: service.service_name,
      description: service.description || "",
      price: service.price ?? "",
    });

    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setEditingService(null);
    setForm(initialForm);
  };

  // Add / Update Service
  const handleSubmit = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!form.service_name.trim()) {
      toast.error("Service name is required");
      return;
    }

    if (
      !/^\d+(\.\d{1,2})?$/.test(form.price) ||
      Number(form.price) > 9999999999.99
    ) {
      toast.error("Enter a valid service price");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        service_name: form.service_name.trim(),
        description: form.description.trim(),
        price: form.price,
      };

      if (editingService) {
        await ServiceAPI.update(
          editingService.id,
          payload
        );

        toast.success("Service updated successfully");
      } else {
        await ServiceAPI.add(payload);

        toast.success("Service added successfully");
      }

      setModalOpen(false);
      setEditingService(null);
      setForm(initialForm);

      await loadServices();

    } catch (error) {
      toast.error(
        axios.isAxiosError(error)
          ? error.response?.data?.message ||
              "Unable to save service"
          : "Unable to save service"
      );
    } finally {
      setSaving(false);
    }
  };

  // Activate / Deactivate
  const toggleStatus = async (service: Service) => {
    const confirmed = window.confirm(
      `Are you sure you want to ${
        service.is_active ? "deactivate" : "activate"
      } this service?`
    );

    if (!confirmed) return;

    setUpdatingId(service.id);

    try {
      await ServiceAPI.update(service.id, {
        is_active: !service.is_active,
      });

      toast.success(
        service.is_active
          ? "Service deactivated"
          : "Service activated"
      );

      await loadServices();

    } catch {
      toast.error("Unable to update service status");
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredServices = services.filter((service) =>
    service.service_name
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const activeCount = services.filter(
    (service) => service.is_active
  ).length;

  const formatPrice = (price: string | null) => {
    if (price === null) return "Not configured";

    return Number(price).toLocaleString("en-IN", {
      style: "currency",
      currency: "INR",
    });
  };

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="page-title">
            Service Management
          </h1>

          <p className="text-slate-500 mt-2">
            Manage car wash services and pricing.
          </p>
        </div>

        <button
          className="primary-btn flex items-center gap-2"
          onClick={openAddModal}
        >
          <Plus size={20} />
          Add Service
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-3 gap-4">

        <div className="card flex items-center gap-4">
          <div className="bg-sky-100 text-sky-600 p-3 rounded-xl">
            <Wrench size={26} />
          </div>

          <div>
            <p className="text-sm text-slate-500">
              Total Services
            </p>

            <h2 className="text-2xl font-bold">
              {services.length}
            </h2>
          </div>
        </div>

        <div className="card flex items-center gap-4">
          <div className="bg-green-100 text-green-600 p-3 rounded-xl">
            <CheckCircle2 size={26} />
          </div>

          <div>
            <p className="text-sm text-slate-500">
              Active Services
            </p>

            <h2 className="text-2xl font-bold">
              {activeCount}
            </h2>
          </div>
        </div>

        <div className="card flex items-center gap-4">
          <div className="bg-red-100 text-red-600 p-3 rounded-xl">
            <Ban size={26} />
          </div>

          <div>
            <p className="text-sm text-slate-500">
              Inactive Services
            </p>

            <h2 className="text-2xl font-bold">
              {services.length - activeCount}
            </h2>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4">
        <Search size={20} className="text-slate-400" />

        <input
          className="w-full py-3 outline-none"
          placeholder="Search services..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Services Table */}
      <div className="card overflow-x-auto">

        {loading ? (
          <p className="py-10 text-center text-slate-500">
            Loading services...
          </p>
        ) : loadError ? (
          <div className="py-10 text-center">
            <p className="text-red-600">
              Unable to load services
            </p>

            <button
              className="secondary-btn mt-4"
              onClick={loadServices}
            >
              Retry
            </button>
          </div>
        ) : (
          <table className="data-table">

            <thead>
              <tr>
                <th>ID</th>
                <th>Service Name</th>
                <th>Description</th>
                <th>Starting Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredServices.map((service) => (
                <tr key={service.id}>
                  <td>{service.id}</td>

                  <td className="font-semibold">
                    {service.service_name}
                  </td>

                  <td className="max-w-xs whitespace-normal text-slate-500">
                    {service.description || "—"}
                  </td>

                  <td className="font-bold text-sky-700">
                    {formatPrice(service.price)}
                  </td>

                  <td>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        service.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {service.is_active
                        ? "Active"
                        : "Inactive"}
                    </span>
                  </td>

                  <td>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => openEditModal(service)}
                        className="flex items-center gap-1 text-sky-600 font-semibold"
                      >
                        <Pencil size={16} />
                        Edit
                      </button>

                      <button
                        disabled={updatingId !== null}
                        onClick={() => toggleStatus(service)}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50 ${
                          service.is_active
                            ? "bg-red-50 text-red-600"
                            : "bg-green-50 text-green-600"
                        }`}
                      >
                        {updatingId === service.id
                          ? "Updating..."
                          : service.is_active
                          ? "Deactivate"
                          : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading &&
          !loadError &&
          filteredServices.length === 0 && (
            <p className="text-center py-10 text-slate-500">
              No services found.
            </p>
          )}
      </div>

      {/* Add / Edit Service Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-modal-title"
            className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-auto"
          >

            <div className="flex justify-between items-center mb-6">
              <h2
                id="service-modal-title"
                className="text-xl font-bold"
              >
                {editingService
                  ? "Edit Service"
                  : "Add New Service"}
              </h2>

              <button
                type="button"
                aria-label="Close dialog"
                disabled={saving}
                onClick={closeModal}
              >
                <X size={22} />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >

              <div>
                <label
                  htmlFor="service-name"
                  className="field-label"
                >
                  Service Name
                </label>

                <input
                  id="service-name"
                  className="form-input"
                  placeholder="Enter service name"
                  value={form.service_name}
                  maxLength={150}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      service_name: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="service-description"
                  className="field-label"
                >
                  Description
                </label>

                <textarea
                  id="service-description"
                  className="form-input"
                  placeholder="Enter service description"
                  rows={3}
                  value={form.description}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      description: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <label
                  htmlFor="service-price"
                  className="field-label"
                >
                  Starting Price (INR)
                </label>

                <div className="relative">
                  <IndianRupee
                    size={18}
                    className="absolute left-3 top-4 text-slate-500"
                  />

                  <input
                    id="service-price"
                    type="number"
                    min="0"
                    max="9999999999.99"
                    step="0.01"
                    className="form-input pl-10"
                    placeholder="Enter amount"
                    value={form.price}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        price: e.target.value,
                      })
                    }
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  className="secondary-btn"
                  disabled={saving}
                  onClick={closeModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-btn"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingService
                    ? "Update Service"
                    : "Add Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}