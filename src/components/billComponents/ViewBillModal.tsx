import { X, Download, Mail, Phone, MapPin } from "lucide-react";
import { Button } from "../ui/Button";
import { format } from "date-fns";

interface BillViewModalProps {
  bill: any;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (bill: any) => void;
}

export function BillViewModal({
  bill,
  isOpen,
  onClose,
  onDownload,
}: BillViewModalProps) {
  if (!isOpen || !bill) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800 border-green-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "overdue":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-semibold">Bill Details</h2>
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDownload(bill)}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Bill Content */}
        <div className="p-6">
          {/* Invoice Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-blue-600 mb-2">
              AbhiCure Clinic
            </h1>
            <p className="text-gray-600">Professional Healthcare Services</p>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h2 className="text-xl font-semibold">
                INVOICE #{bill.bill_number}
              </h2>
            </div>
          </div>

          {/* Bill Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Bill Details */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">
                Bill Information
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Invoice Number:</span>
                  <span className="font-medium">{bill.bill_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Date:</span>
                  <span>
                    {format(new Date(bill.created_at), "MMMM d, yyyy")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Due Date:</span>
                  <span>
                    {bill.due_date
                      ? format(new Date(bill.due_date), "MMMM d, yyyy")
                      : "No due date"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Status:</span>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                      bill.status
                    )}`}
                  >
                    {bill.status.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Patient Details */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Bill To</h3>
              <div className="space-y-2">
                <div className="font-medium text-lg">{bill.patient?.name}</div>
                <div className="flex items-center text-gray-600">
                  <Mail className="h-4 w-4 mr-2" />
                  {bill.patient?.email || "No email"}
                </div>
                <div className="flex items-center text-gray-600">
                  <Phone className="h-4 w-4 mr-2" />
                  {bill.patient?.phone || "No phone"}
                </div>
                <div className="flex items-start text-gray-600">
                  <MapPin className="h-4 w-4 mr-2 mt-1 flex-shrink-0" />
                  <span>{bill.patient?.address || "No address"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Amount Details */}
          <div className="bg-blue-50 p-6 rounded-lg mb-8">
            <h3 className="font-semibold text-gray-900 mb-4">Amount Details</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Service Amount:</span>
                <span>
                  ₹{bill.amount?.toFixed(2) || bill.total_amount.toFixed(2)}
                </span>
              </div>
              {bill.tax_amount > 0 && (
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span>₹{bill.tax_amount.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between font-bold text-lg">
                <span>Total Amount:</span>
                <span>₹{bill.total_amount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-gray-500 text-sm pt-8 border-t border-gray-200">
            <p>Thank you for choosing AbhiCure Clinic</p>
            <p className="mt-1">This is a computer-generated invoice.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
