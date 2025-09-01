import React, { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  Home,
  Users,
  UserCheck,
  Calendar,
  Receipt,
  BarChart3,
  History,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Activity,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { NotificationCenter } from "./NotificationCenter";
import { supabase } from "../lib/supabase";

const navigationItems = [
  { to: "/admin/dashboard", icon: Home, label: "Dashboard" },
  { to: "/admin/patients", icon: Users, label: "Patients" },
  { to: "/admin/doctors", icon: UserCheck, label: "Doctors" },
  { to: "/admin/appointments", icon: Calendar, label: "Appointments" },
  { to: "/admin/billing", icon: Receipt, label: "Billing" },
  { to: "/admin/reports", icon: BarChart3, label: "Reports" },
  { to: "/admin/history", icon: History, label: "History" },
  { to: "/admin/settings", icon: Settings, label: "Settings" },
];

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0); // ADDED: Track unread notifications
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  // ADDED: Fetch unread notification count
  useEffect(() => {
    if (!user) return;

    const fetchUnreadCount = async () => {
      try {
        const { count, error } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("read", false);

        if (error) {
          console.error("Error fetching unread count:", error);
        } else {
          console.log("Unread notifications count:", count);
          setUnreadCount(count || 0);
        }
      } catch (error) {
        console.error("Error in fetchUnreadCount:", error);
      }
    };

    fetchUnreadCount();

    // ADDED: Real-time subscription for notifications
    const subscription = supabase
      .channel("notification-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          console.log("Notifications updated, refetching unread count...");
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  // ADDED: Function to handle notification updates
  const handleNotificationUpdate = () => {
    if (!user) return;

    // Refetch unread count when notifications are updated
    const fetchUnreadCount = async () => {
      try {
        const { count, error } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("read", false);

        if (error) {
          console.error("Error fetching unread count:", error);
        } else {
          console.log("Updated unread notifications count:", count);
          setUnreadCount(count || 0);
        }
      } catch (error) {
        console.error("Error in handleNotificationUpdate:", error);
      }
    };

    fetchUnreadCount();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
        fixed inset-y-0 left-0 z-50 bg-white shadow-lg transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${sidebarCollapsed ? "w-20" : "w-64"}
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <div
            className={`flex items-center ${
              sidebarCollapsed ? "justify-center" : "space-x-3"
            }`}
          >
            <div className="p-2 bg-blue-600 rounded-lg">
              <Activity className="h-6 w-6 text-white" />
            </div>
            {!sidebarCollapsed && (
              <>
                <h1 className="text-xl font-bold text-gray-800">ClinicAdmin</h1>
              </>
            )}
          </div>

          <div className="flex items-center">
            {/* Desktop collapse button - only show when not collapsed */}
            {!sidebarCollapsed && (
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="hidden lg:block p-1 rounded-md hover:bg-gray-100 transition-colors duration-200"
              >
                <ChevronLeft className="h-5 w-5 text-gray-600" />
              </button>
            )}

            {/* Mobile close button */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 rounded-md hover:bg-gray-100 transition-colors duration-200"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Floating expand button when collapsed */}
        {sidebarCollapsed && (
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="hidden lg:block absolute top-4 -right-3 p-1 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors duration-200 shadow-sm z-10"
          >
            <ChevronRight className="h-4 w-4 text-gray-600" />
          </button>
        )}

        <nav className="mt-6">
          <ul className="space-y-2">
            {navigationItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 mx-3 ${
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon
                    className={`h-5 w-5 flex-shrink-0 ${
                      sidebarCollapsed ? "" : "mr-3"
                    }`}
                  />
                  {!sidebarCollapsed && item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="absolute bottom-0 w-full border-t border-gray-200">
          <button
            onClick={handleSignOut}
            title={sidebarCollapsed ? "Sign Out" : undefined}
            className="flex items-center w-full px-4 py-4 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors duration-200"
          >
            <div
              className={`flex items-center ${
                sidebarCollapsed ? "justify-center w-full" : ""
              }`}
            >
              <LogOut
                className={`h-5 w-5 flex-shrink-0 ${
                  sidebarCollapsed ? "" : "mr-3"
                }`}
              />
              {!sidebarCollapsed && "Sign Out"}
            </div>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md hover:bg-gray-100"
              >
                <Menu className="h-6 w-6" />
              </button>
              <div className="flex items-center space-x-3">
                <div>
                  <img
                    src="/abhicure_logo_nobg.png"
                    alt="AbhiCure Logo"
                    className="h-14 w-auto object-contain"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => setNotificationOpen(!notificationOpen)}
                className="relative p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
              >
                <Bell className="h-6 w-6 text-gray-600" />
                {/* FIXED: Only show red dot when there are unread notifications */}
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full animate-pulse"></span>
                )}
                {/* OPTIONAL: Show unread count badge */}
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="relative">
            <Outlet />
            {notificationOpen && (
              <NotificationCenter
                onClose={() => setNotificationOpen(false)}
                onNotificationUpdate={handleNotificationUpdate} // ADDED: Pass update handler
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
