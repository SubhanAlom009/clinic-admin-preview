import React, { useState } from 'react';
import { Users, UserCheck, Calendar, Receipt, AlertTriangle, Plus } from 'lucide-react';
import { MetricCard } from '../components/ui/MetricCard';
import { Card, CardHeader, CardContent, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import { AddPatientModal } from '../components/AddPatientModal';
import { AddAppointmentModal } from '../components/AddAppointmentModal';
import { AddBillModal } from '../components/AddBillModal';

export function Dashboard() {
  const { metrics, loading } = useDashboardMetrics();
  const [activeModal, setActiveModal] = useState<'patient' | 'appointment' | 'bill' | null>(null);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-gray-200 h-32 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome to your clinic management system</p>
        </div>
        <div className="flex space-x-3 mt-4 sm:mt-0">
          <Button
            onClick={() => setActiveModal('patient')}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Patient
          </Button>
          <Button
            onClick={() => setActiveModal('appointment')}
            size="sm"
            variant="outline"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Schedule
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <MetricCard
          title="Total Patients"
          value={metrics.totalPatients}
          icon={Users}
          color="blue"
        />
        <MetricCard
          title="Total Doctors"
          value={metrics.totalDoctors}
          icon={UserCheck}
          color="green"
        />
        <MetricCard
          title="Today's Appointments"
          value={metrics.todayAppointments}
          icon={Calendar}
          color="yellow"
        />
        <MetricCard
          title="Pending Bills"
          value={metrics.pendingBills}
          icon={Receipt}
          color="red"
        />
        <MetricCard
          title="Overdue Follow-ups"
          value={metrics.overdueFollowups}
          icon={AlertTriangle}
          color="red"
        />
      </div>

      {/* Quick Actions and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => setActiveModal('patient')}
              className="w-full justify-start"
              variant="outline"
            >
              <Users className="h-5 w-5 mr-3" />
              Add New Patient
            </Button>
            <Button
              onClick={() => setActiveModal('appointment')}
              className="w-full justify-start"
              variant="outline"
            >
              <Calendar className="h-5 w-5 mr-3" />
              Schedule Appointment
            </Button>
            <Button
              onClick={() => setActiveModal('bill')}
              className="w-full justify-start"
              variant="outline"
            >
              <Receipt className="h-5 w-5 mr-3" />
              Generate Bill
            </Button>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    Payment received from John Doe
                  </p>
                  <p className="text-xs text-gray-500">2 minutes ago</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    New appointment scheduled with Dr. Smith
                  </p>
                  <p className="text-xs text-gray-500">15 minutes ago</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-lg">
                <div className="h-2 w-2 bg-yellow-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    Follow-up reminder sent to patient
                  </p>
                  <p className="text-xs text-gray-500">1 hour ago</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      {activeModal === 'patient' && (
        <AddPatientModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === 'appointment' && (
        <AddAppointmentModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
        />
      )}
      {activeModal === 'bill' && (
        <AddBillModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
}