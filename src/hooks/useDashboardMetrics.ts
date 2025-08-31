import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { DashboardMetrics } from '../types';
import { format, startOfDay, endOfDay } from 'date-fns';

export function useDashboardMetrics() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalPatients: 0,
    totalDoctors: 0,
    todayAppointments: 0,
    pendingBills: 0,
    overdueFollowups: 0,
  });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const fetchMetrics = async () => {
      try {
        const today = new Date();
        const todayStart = startOfDay(today);
        const todayEnd = endOfDay(today);

        // Fetch all metrics in parallel
        const [
          patientsResult,
          doctorsResult,
          todayAppointmentsResult,
          pendingBillsResult,
          overdueFollowupsResult,
        ] = await Promise.all([
          supabase
            .from('patients')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id),
          supabase
            .from('doctors')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id),
          supabase
            .from('appointments')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('appointment_datetime', todayStart.toISOString())
            .lte('appointment_datetime', todayEnd.toISOString()),
          supabase
            .from('bills')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('status', 'pending'),
          supabase
            .from('followups')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('status', 'pending')
            .lt('due_date', format(today, 'yyyy-MM-dd')),
        ]);

        setMetrics({
          totalPatients: patientsResult.count || 0,
          totalDoctors: doctorsResult.count || 0,
          todayAppointments: todayAppointmentsResult.count || 0,
          pendingBills: pendingBillsResult.count || 0,
          overdueFollowups: overdueFollowupsResult.count || 0,
        });
      } catch (error) {
        console.error('Error fetching dashboard metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();

    // Set up real-time subscriptions
    const subscription = supabase
      .channel('dashboard-metrics')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'patients', filter: `user_id=eq.${user.id}` },
        () => fetchMetrics()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'doctors', filter: `user_id=eq.${user.id}` },
        () => fetchMetrics()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments', filter: `user_id=eq.${user.id}` },
        () => fetchMetrics()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bills', filter: `user_id=eq.${user.id}` },
        () => fetchMetrics()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'followups', filter: `user_id=eq.${user.id}` },
        () => fetchMetrics()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  return { metrics, loading };
}