import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Phone, Mail } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardContent, CardTitle } from '../components/ui/Card';
import { AddDoctorModal } from '../components/AddDoctorModal';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Doctor } from '../types';
import { format } from 'date-fns';

export function Doctors() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const fetchDoctors = async () => {
      const { data } = await supabase
        .from('doctors')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (data) {
        setDoctors(data);
        setFilteredDoctors(data);
      }
      setLoading(false);
    };

    fetchDoctors();

    // Real-time subscription
    const subscription = supabase
      .channel('doctors')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'doctors',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchDoctors();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  useEffect(() => {
    const filtered = doctors.filter(doctor =>
      doctor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doctor.specialization.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doctor.contact.includes(searchTerm)
    );
    setFilteredDoctors(filtered);
  }, [searchTerm, doctors]);

  const deleteDoctor = async (id: string) => {
    if (!confirm('Are you sure you want to delete this doctor?')) return;

    const { error } = await supabase
      .from('doctors')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Error deleting doctor: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Doctors</h1>
          <p className="text-gray-600 mt-1">Manage your medical staff</p>
        </div>
        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="mt-4 sm:mt-0"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Doctor
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Search doctors by name, specialization, or contact..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Doctors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDoctors.map((doctor) => (
          <Card key={doctor.id} className="hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{doctor.name}</h3>
                  <p className="text-sm text-blue-600 font-medium">{doctor.specialization}</p>
                  {doctor.experience_years > 0 && (
                    <p className="text-sm text-gray-500">{doctor.experience_years} years experience</p>
                  )}
                </div>
                <div className="flex space-x-1">
                  <button className="p-1 text-gray-400 hover:text-green-600 transition-colors duration-200">
                    <Edit className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => deleteDoctor(doctor.id)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors duration-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <Phone className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-gray-900">{doctor.contact}</span>
                </div>
                {doctor.email && (
                  <div className="flex items-center text-sm">
                    <Mail className="h-4 w-4 text-gray-400 mr-2" />
                    <span className="text-gray-900">{doctor.email}</span>
                  </div>
                )}
                {doctor.consultation_fee > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Consultation Fee:</span>
                    <span className="font-semibold text-green-600">₹{doctor.consultation_fee}</span>
                  </div>
                )}
              </div>

              {doctor.qualifications && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600">{doctor.qualifications}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredDoctors.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-gray-400 mb-4">
              <UserCheck className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No doctors found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm ? 'Try adjusting your search criteria' : 'Get started by adding your first doctor'}
            </p>
            <Button onClick={() => setIsAddModalOpen(true)}>
              <Plus className="h-5 w-5 mr-2" />
              Add Doctor
            </Button>
          </CardContent>
        </Card>
      )}

      <AddDoctorModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
}