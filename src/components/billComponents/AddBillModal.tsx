import React, { useState, useEffect } from "react";
import { X, Receipt } from "lucide-react";
import { Button } from "../ui/Button";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../hooks/useAuth";
import { Patient } from "../../types";

interface AddBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddBillModal({
  isOpen,
  onClose,
  onSuccess,
}: AddBillModalProps) {
  const [formData, setFormData] = useState({
    patient_id: "",
    amount: "",
    tax_amount: "",
    due_date: "",
    notes: "", // REMOVED service_description, only use notes
  });
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !isOpen) return;

    const fetchPatients = async () => {
      console.log("Fetching patients for user:", user.id);

      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("user_id", user.id)
        .order("name");

      if (error) {
        console.error("Error fetching patients:", error);
      } else {
        console.log("Patients fetched:", data);
        setPatients(data || []);
      }
    };

    fetchPatients();
  }, [user, isOpen]);

  const generateBillNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    return `INV-${year}${month}${day}-${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError("");

    try {
      const amount = parseFloat(formData.amount);
      const taxAmount = parseFloat(formData.tax_amount) || 0;
      const totalAmount = amount + taxAmount;

      // FIXED: Only use columns that actually exist in the database
      const billData = {
        user_id: user.id,
        patient_id: formData.patient_id,
        bill_number: generateBillNumber(),
        amount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        due_date: formData.due_date || null,
        notes: formData.notes || null, // Only use notes field
        status: "pending",
      };

      console.log("Creating bill with data:", billData);

      const { data: billResult, error } = await supabase
        .from("bills")
        .insert(billData)
        .select()
        .single();

      if (error) {
        console.error("Bill creation error:", error);
        throw error;
      }

      console.log("Bill created successfully:", billResult);

      // Create notification
      const patient = patients.find((p) => p.id === formData.patient_id);
      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "payment",
        title: "Bill Generated",
        message: `Bill generated for ${patient?.name} - ₹${totalAmount.toFixed(
          2
        )}`,
        priority: "normal",
      });

      onSuccess?.();
      onClose();
      setFormData({
        patient_id: "",
        amount: "",
        tax_amount: "",
        due_date: "",
        notes: "",
      });
    } catch (err: any) {
      console.error("Error in handleSubmit:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const totalAmount =
    (parseFloat(formData.amount) || 0) + (parseFloat(formData.tax_amount) || 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold flex items-center">
            <Receipt className="h-6 w-6 mr-2 text-blue-600" />
            Generate New Bill
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Patient *
              </label>
              <select
                name="patient_id"
                value={formData.patient_id}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select a patient</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.name} - {patient.contact}
                  </option>
                ))}
              </select>
              {patients.length === 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  No patients found. Make sure you have added patients first.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount *
              </label>
              <input
                type="number"
                name="amount"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter bill amount"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tax Amount
              </label>
              <input
                type="number"
                name="tax_amount"
                step="0.01"
                min="0"
                value={formData.tax_amount}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter tax amount (optional)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date
              </label>
              <input
                type="date"
                name="due_date"
                value={formData.due_date}
                onChange={handleInputChange}
                min={new Date().toISOString().split("T")[0]}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {totalAmount > 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-blue-700">
                    Amount: ₹{parseFloat(formData.amount || "0").toFixed(2)}
                  </p>
                  {parseFloat(formData.tax_amount || "0") > 0 && (
                    <p className="text-sm text-blue-700">
                      Tax: ₹{parseFloat(formData.tax_amount || "0").toFixed(2)}
                    </p>
                  )}
                </div>
                <p className="text-lg font-semibold text-blue-900">
                  Total: ₹{totalAmount.toFixed(2)}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes / Service Description
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add notes or service description (e.g., Consultation, X-Ray, Blood Test)"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !formData.patient_id || !formData.amount}
            >
              {loading ? "Generating..." : "Generate Bill"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
