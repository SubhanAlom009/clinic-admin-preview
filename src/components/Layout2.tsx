import React, { useState } from "react";
import { Outlet, NavLink, useNavigate, Link } from "react-router-dom";
import {
  Home,
  Users,
  UserCheck,
  Calendar,
  Receipt,
  BarChart3,
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
  const { signOut } = useAuth();
  const navigate = useNavigate();

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
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Activity className="h-6 w-6 text-white" />
            </div>
            {!sidebarCollapsed && (
              <h1 className="text-xl font-bold text-gray-800">ClinicAdmin</h1>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:block p-1 rounded-md hover:bg-gray-100 transition-colors duration-200"
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-5 w-5 text-gray-600" />
              ) : (
                <ChevronLeft className="h-5 w-5 text-gray-600" />
              )}
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 rounded-md hover:bg-gray-100"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <nav className="mt-6 px-2">
          <ul className="space-y-2">
            {navigationItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-colors duration-200 mx-2 ${
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon
                    className={`h-5 w-5 ${sidebarCollapsed ? "" : "mr-3"}`}
                  />
                  {!sidebarCollapsed && item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="absolute bottom-0 w-full p-2 border-t border-gray-200">
          <button
            onClick={handleSignOut}
            title={sidebarCollapsed ? "Sign Out" : undefined}
            className="flex items-center w-full px-3 py-3 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors duration-200 mx-2"
          >
            <LogOut className={`h-5 w-5 ${sidebarCollapsed ? "" : "mr-3"}`} />
            {!sidebarCollapsed && "Sign Out"}
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
              {/* Add Home Button */}
              <Link
                to="/"
                className="ml-2 px-3 py-2 rounded-md bg-blue-50 text-blue-700 font-medium hover:bg-blue-100 transition-colors duration-200 flex items-center"
                title="Go to Home"
              >
                <Home className="h-5 w-5 mr-1" />
                <span className="hidden sm:inline">Go back to Home</span>
              </Link>
              <button
                onClick={() => setNotificationOpen(!notificationOpen)}
                className="relative p-2 rounded-full hover:bg-gray-100 transition-colors duration-200"
              >
                <Bell className="h-6 w-6 text-gray-600" />
                <span className="absolute top-0 right-0 h-2 w-2 bg-red-500 rounded-full"></span>
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="relative">
            <Outlet />
            {notificationOpen && (
              <NotificationCenter onClose={() => setNotificationOpen(false)} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
