import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface AddPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddPatientModal({ isOpen, onClose }: AddPatientModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: '',
    contact: '',
    email: '',
    address: '',
    emergency_contact: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      const { error } = await supabase
        .from('patients')
        .insert({
          user_id: user.id,
          name: formData.name,
          age: formData.age ? parseInt(formData.age) : null,
          gender: formData.gender || null,
          contact: formData.contact,
          email: formData.email || null,
          address: formData.address || null,
          emergency_contact: formData.emergency_contact || null,
        });

      if (error) throw error;

      // Create success notification
      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'system',
        title: 'Patient Added',
        message: `New patient ${formData.name} has been added successfully.`,
        priority: 'normal',
      });

      onClose();
      setFormData({
        name: '',
        age: '',
        gender: '',
        contact: '',
        email: '',
        address: '',
        emergency_contact: '',
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Patient" size="lg">
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Full Name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            placeholder="Enter patient's full name"
          />
          <Input
            label="Age"
            name="age"
            type="number"
            value={formData.age}
            onChange={handleInputChange}
            placeholder="Enter age"
            min="0"
            max="150"
          />
          <Select
            label="Gender"
            name="gender"
            value={formData.gender}
            onChange={handleInputChange}
            options={[
              { value: 'Male', label: 'Male' },
              { value: 'Female', label: 'Female' },
              { value: 'Other', label: 'Other' },
            ]}
          />
          <Input
            label="Contact Number"
            name="contact"
            value={formData.contact}
            onChange={handleInputChange}
            required
            placeholder="Enter contact number"
          />
          <Input
            label="Email Address"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="Enter email address"
          />
          <Input
            label="Emergency Contact"
            name="emergency_contact"
            value={formData.emergency_contact}
            onChange={handleInputChange}
            placeholder="Enter emergency contact"
          />
        </div>
        
        <Input
          label="Address"
          name="address"
          value={formData.address}
          onChange={handleInputChange}
          placeholder="Enter complete address"
        />

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
            {loading ? 'Adding...' : 'Add Patient'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}