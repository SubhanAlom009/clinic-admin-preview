import React, { useState, useEffect } from 'react';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Patient } from '../types';
import { format } from 'date-fns';

interface AddBillModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddBillModal({ isOpen, onClose }: AddBillModalProps) {
  const [formData, setFormData] = useState({
    patient_id: '',
    amount: '',
    tax_amount: '',
    due_date: '',
    notes: '',
  });
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !isOpen) return;

    const fetchPatients = async () => {
      const { data } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (data) setPatients(data);
    };

    fetchPatients();
  }, [user, isOpen]);

  const generateBillNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `BILL-${year}${month}${day}-${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      const amount = parseFloat(formData.amount);
      const taxAmount = parseFloat(formData.tax_amount) || 0;
      const totalAmount = amount + taxAmount;

      const { error } = await supabase
        .from('bills')
        .insert({
          user_id: user.id,
          patient_id: formData.patient_id,
          bill_number: generateBillNumber(),
          amount,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          due_date: formData.due_date || null,
          notes: formData.notes || null,
        });

      if (error) throw error;

      // Create notification
      const patient = patients.find(p => p.id === formData.patient_id);
      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'payment',
        title: 'Bill Generated',
        message: `Bill generated for ${patient?.name} - ₹${totalAmount.toFixed(2)}`,
        priority: 'normal',
      });

      onClose();
      setFormData({
        patient_id: '',
        amount: '',
        tax_amount: '',
        due_date: '',
        notes: '',
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const totalAmount = (parseFloat(formData.amount) || 0) + (parseFloat(formData.tax_amount) || 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generate New Bill" size="lg">
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Patient"
            name="patient_id"
            value={formData.patient_id}
            onChange={handleInputChange}
            required
            options={patients.map(patient => ({
              value: patient.id,
              label: `${patient.name} - ${patient.contact}`,
            }))}
          />
          <Input
            label="Amount"
            name="amount"
            type="number"
            step="0.01"
            value={formData.amount}
            onChange={handleInputChange}
            required
            placeholder="Enter bill amount"
          />
          <Input
            label="Tax Amount"
            name="tax_amount"
            type="number"
            step="0.01"
            value={formData.tax_amount}
            onChange={handleInputChange}
            placeholder="Enter tax amount (optional)"
          />
          <Input
            label="Due Date"
            name="due_date"
            type="date"
            value={formData.due_date}
            onChange={handleInputChange}
          />
        </div>

        {totalAmount > 0 && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-lg font-semibold text-blue-900">
              Total Amount: ₹{totalAmount.toFixed(2)}
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            rows={3}
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Add any notes for the bill"
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
          <Button type="submit" disabled={loading}>
            {loading ? 'Generating...' : 'Generate Bill'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}