import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, Calendar, Receipt, Download } from 'lucide-react';
import { Card, CardHeader, CardContent, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

interface ReportData {
  appointmentStats: {
    total: number;
    completed: number;
    cancelled: number;
    noShow: number;
  };
  revenueStats: {
    totalRevenue: number;
    paidAmount: number;
    pendingAmount: number;
    overdueAmount: number;
  };
  patientStats: {
    totalPatients: number;
    newPatients: number;
    returningPatients: number;
  };
  doctorStats: {
    totalDoctors: number;
    averageAppointments: number;
  };
}

export function Reports() {
  const [reportData, setReportData] = useState<ReportData>({
    appointmentStats: { total: 0, completed: 0, cancelled: 0, noShow: 0 },
    revenueStats: { totalRevenue: 0, paidAmount: 0, pendingAmount: 0, overdueAmount: 0 },
    patientStats: { totalPatients: 0, newPatients: 0, returningPatients: 0 },
    doctorStats: { totalDoctors: 0, averageAppointments: 0 },
  });
  const [dateRange, setDateRange] = useState('thisMonth');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const fetchReportData = async () => {
      setLoading(true);

      const today = new Date();
      let startDate: Date;
      let endDate: Date = today;

      switch (dateRange) {
        case 'last7Days':
          startDate = subDays(today, 7);
          break;
        case 'last30Days':
          startDate = subDays(today, 30);
          break;
        case 'thisMonth':
          startDate = startOfMonth(today);
          endDate = endOfMonth(today);
          break;
        default:
          startDate = subDays(today, 30);
      }

      try {
        // Fetch appointment statistics
        const { data: appointments } = await supabase
          .from('appointments')
          .select('*')
          .eq('user_id', user.id)
          .gte('appointment_datetime', startDate.toISOString())
          .lte('appointment_datetime', endDate.toISOString());

        // Fetch revenue statistics
        const { data: bills } = await supabase
          .from('bills')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());

        // Fetch patient statistics
        const { data: allPatients } = await supabase
          .from('patients')
          .select('*')
          .eq('user_id', user.id);

        const { data: newPatients } = await supabase
          .from('patients')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString());

        // Fetch doctor statistics
        const { data: doctors } = await supabase
          .from('doctors')
          .select('*')
          .eq('user_id', user.id);

        // Calculate statistics
        const appointmentStats = {
          total: appointments?.length || 0,
          completed: appointments?.filter(a => a.status === 'completed').length || 0,
          cancelled: appointments?.filter(a => a.status === 'cancelled').length || 0,
          noShow: appointments?.filter(a => a.status === 'no_show').length || 0,
        };

        const revenueStats = {
          totalRevenue: bills?.reduce((sum, bill) => sum + bill.total_amount, 0) || 0,
          paidAmount: bills?.filter(b => b.status === 'paid').reduce((sum, bill) => sum + bill.total_amount, 0) || 0,
          pendingAmount: bills?.filter(b => b.status === 'pending').reduce((sum, bill) => sum + bill.total_amount, 0) || 0,
          overdueAmount: bills?.filter(b => b.status === 'overdue').reduce((sum, bill) => sum + bill.total_amount, 0) || 0,
        };

        const patientStats = {
          totalPatients: allPatients?.length || 0,
          newPatients: newPatients?.length || 0,
          returningPatients: (allPatients?.length || 0) - (newPatients?.length || 0),
        };

        const doctorStats = {
          totalDoctors: doctors?.length || 0,
          averageAppointments: doctors?.length ? Math.round(appointmentStats.total / doctors.length) : 0,
        };

        setReportData({
          appointmentStats,
          revenueStats,
          patientStats,
          doctorStats,
        });
      } catch (error) {
        console.error('Error fetching report data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, [user, dateRange]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
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
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600 mt-1">Comprehensive insights into your clinic performance</p>
        </div>
        <div className="flex space-x-3 mt-4 sm:mt-0">
          <Select
            name="dateRange"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            options={[
              { value: 'last7Days', label: 'Last 7 Days' },
              { value: 'last30Days', label: 'Last 30 Days' },
              { value: 'thisMonth', label: 'This Month' },
            ]}
          />
          <Button variant="outline">
            <Download className="h-5 w-5 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Appointment Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Appointment Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{reportData.appointmentStats.total}</p>
              <p className="text-sm text-gray-600">Total Appointments</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{reportData.appointmentStats.completed}</p>
              <p className="text-sm text-gray-600">Completed</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-600">{reportData.appointmentStats.cancelled}</p>
              <p className="text-sm text-gray-600">Cancelled</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-600">{reportData.appointmentStats.noShow}</p>
              <p className="text-sm text-gray-600">No Show</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            Revenue Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">₹{reportData.revenueStats.totalRevenue.toFixed(2)}</p>
              <p className="text-sm text-gray-600">Total Revenue</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">₹{reportData.revenueStats.paidAmount.toFixed(2)}</p>
              <p className="text-sm text-gray-600">Paid Amount</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-yellow-600">₹{reportData.revenueStats.pendingAmount.toFixed(2)}</p>
              <p className="text-sm text-gray-600">Pending Amount</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-600">₹{reportData.revenueStats.overdueAmount.toFixed(2)}</p>
              <p className="text-sm text-gray-600">Overdue Amount</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Patient & Doctor Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Patient Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{reportData.patientStats.totalPatients}</p>
                <p className="text-sm text-gray-600">Total Patients</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{reportData.patientStats.newPatients}</p>
                <p className="text-sm text-gray-600">New Patients</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{reportData.patientStats.returningPatients}</p>
                <p className="text-sm text-gray-600">Returning</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Doctor Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{reportData.doctorStats.totalDoctors}</p>
                <p className="text-sm text-gray-600">Total Doctors</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{reportData.doctorStats.averageAppointments}</p>
                <p className="text-sm text-gray-600">Avg. Appointments</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}