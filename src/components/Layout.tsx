import React, { useState } from 'react';
import {
  Home, Receipt, Users, CreditCard, BarChart3, Activity, HardDrive,
  Settings, LogOut, Menu, X, Moon, Sun, TrendingUp, ChevronLeft, Clock,
  ChevronRight, Bell, Calculator, Shield, User
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTasks } from '../hooks/useTasks';
import { clsx } from 'clsx';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onPageChange: (page: string) => void;
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Home, number: '01' },
  { id: 'receipts', label: 'Receipts', icon: Receipt, number: '02' },
  { id: 'clients', label: 'Clients', icon: Users, number: '03' },
  { id: 'expenses', label: 'Expenses', icon: CreditCard, number: '04' },
  { id: 'employees', label: 'Employees', icon: Users, number: '05', adminOnly: true },
  { id: 'attendance', label: 'My Attendance', icon: Clock, number: '06', employeeOnly: true },
  { id: 'tax-calculator', label: 'Tax Calculator', icon: Calculator, number: '07' },
  { id: 'notifications', label: 'Notifications', icon: Bell, number: '08' },
  { id: 'backup', label: 'Backup/Restore', icon: HardDrive, number: '09', adminOnly: true },
];

export function Layout({ children, currentPage, onPageChange }: LayoutProps) {
  const { user, logout } = useAuth();
  const { getTasksByEmployee } = useTasks();
  const [canLogout, setCanLogout] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true';
  });
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true' ||
        (!localStorage.getItem('darkMode') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  const [themeTransition, setThemeTransition] = useState(false);

  // Check if employee can logout (only if all tasks are completed or pending)
  React.useEffect(() => {
    const checkLogoutPermission = async () => {
      if (user?.role === 'employee') {
        try {
          const employeeTasks = await getTasksByEmployee(user.id);
          const hasInProgressTasks = employeeTasks.some(task => task.status === 'in_progress');
          setCanLogout(!hasInProgressTasks);
        } catch (error) {
          console.error('Error checking tasks:', error);
          setCanLogout(true);
        }
      } else {
        setCanLogout(true);
      }
    };

    checkLogoutPermission();
  }, [user, getTasksByEmployee]);

  React.useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  React.useEffect(() => {
    localStorage.setItem('sidebarCollapsed', sidebarCollapsed.toString());
  }, [sidebarCollapsed]);

  const handleLogout = async () => {
    if (!canLogout) {
      const message = `🚫 LOGOUT RESTRICTED\n\nYou cannot logout while you have tasks in progress.\n\nPlease either:\n• Complete your current tasks, or\n• Mark them as "Pending" to logout\n\nThis ensures work continuity and accountability.`;
      alert(message);
      return;
    }
    
    const confirmMessage = user?.role === 'employee' 
      ? '✅ All tasks completed or pending.\n\nAre you sure you want to logout?'
      : 'Are you sure you want to logout?';
      
    if (confirm(confirmMessage)) {
      await logout();
    }
  };

  const toggleDarkMode = () => {
    setThemeTransition(true);
    setTimeout(() => {
      setDarkMode(!darkMode);
      setTimeout(() => setThemeTransition(false), 300);
    }, 150);
  };

  const toggleSidebarCollapse = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className={clsx("app-content flex h-screen bg-gray-50 dark:bg-gray-900 transition-all duration-500", themeTransition && "animate-pulse")}>

      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow-lg text-gray-900 dark:text-white transition-all duration-300 hover:scale-105 border border-gray-200 dark:border-gray-700"
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <div className={clsx(
        "z-40 bg-gradient-to-b from-blue-600 to-blue-700 dark:from-gray-800 dark:to-gray-900 shadow-xl transform transition-all duration-300 ease-in-out h-full flex flex-col flex-shrink-0",
        sidebarOpen ? "fixed inset-y-0 left-0" : "fixed inset-y-0 left-0 -translate-x-full",
        "lg:translate-x-0 lg:relative",
        sidebarCollapsed ? "lg:w-20" : "lg:w-80",
        "w-64" // Always full width on mobile
      )}>
        {/* Header */}
        <div className={clsx("border-b border-blue-500/20 dark:border-gray-700/50", sidebarCollapsed ? "p-3" : "p-6")}>
          <div className="flex items-center justify-between">
            {!sidebarCollapsed && (
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gradient-to-br from-white to-blue-50 rounded-xl flex items-center justify-center mr-3 shadow-lg">
                  <Shield className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">Arkive</h1>
                  <p className="text-base text-blue-100 mt-1">Tax Management</p>
                </div>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="flex items-center justify-center w-full mx-auto">
                <div className="w-12 h-12 bg-gradient-to-br from-white to-blue-50 rounded-xl flex items-center justify-center shadow-lg">
                  <Shield className="w-7 h-7 text-blue-600" />
                </div>
              </div>
            )}
            <button
              onClick={toggleSidebarCollapse}
              className="hidden lg:block p-2 rounded-lg hover:bg-white/10 text-blue-100 hover:text-white transition-all duration-200 text-lg"
            >
              <div className={clsx("transition-transform duration-300", sidebarCollapsed ? "rotate-180" : "rotate-0")}>
                {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
              </div>
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            // Filter menu items based on user role
            if (item.adminOnly && user?.role !== 'admin') return null;
            if (item.employeeOnly && user?.role !== 'employee') return null;
            
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onPageChange(item.id);
                  setSidebarOpen(false);
                }}
                className={clsx(
                  "w-full flex items-center text-left rounded-2xl transition-all duration-300",
                  sidebarCollapsed ? "px-2 py-4 justify-center" : "px-4 py-3",
                  currentPage === item.id
                    ? "border-2 border-white/30 text-white"
                    : "text-blue-100 hover:bg-white/15 hover:text-white"
                )}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon size={sidebarCollapsed ? 24 : 22} className={clsx(
                  "transition-all duration-200 flex-shrink-0",
                  sidebarCollapsed ? "mx-auto" : "mr-3",
                  currentPage === item.id ? "text-white drop-shadow-sm" : ""
                )} />
                {!sidebarCollapsed && (
                  <span className="font-medium text-base whitespace-nowrap">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={clsx("border-t border-blue-500/30 dark:border-gray-700/50 mt-auto backdrop-blur-sm", sidebarCollapsed ? "p-2" : "p-4")}>
          {/* Action Buttons */}
          <div className={clsx("mb-4", sidebarCollapsed ? "flex flex-col items-center space-y-2" : "flex items-center justify-between")}>
            <button
              onClick={toggleDarkMode}
              className={clsx("rounded-xl bg-white/15 hover:bg-white/25 transition-all duration-300 hover:scale-110 backdrop-blur-sm border border-white/20", sidebarCollapsed ? "p-2" : "p-3")}
              title="Toggle Dark Mode"
            >
              <div className={clsx("transition-all duration-300", themeTransition && "animate-spin")}>
                {darkMode ? <Sun size={sidebarCollapsed ? 18 : 20} className="text-yellow-300" /> : <Moon size={sidebarCollapsed ? 18 : 20} className="text-blue-100" />}
              </div>
            </button>
            <button
              onClick={() => onPageChange('settings')}
              className={clsx("text-blue-100 hover:text-white transition-all duration-300 rounded-xl hover:bg-white/15 hover:scale-110 backdrop-blur-sm border border-white/20", sidebarCollapsed ? "p-2" : "p-3")}
              title="Settings"
            >
              <Settings size={sidebarCollapsed ? 18 : 20} />
            </button>
            <button
              onClick={handleLogout}
              className={clsx(
                "transition-all duration-300 rounded-xl backdrop-blur-sm border border-white/20 relative",
                sidebarCollapsed ? "p-2" : "p-3",
                canLogout 
                  ? "text-blue-100 hover:text-red-300 hover:bg-red-500/30 hover:scale-110"
                  : "text-gray-400 cursor-not-allowed opacity-50 animate-pulse"
              )}
              title={canLogout ? "Logout" : "Complete tasks to logout"}
              disabled={!canLogout}
            >
              <LogOut size={sidebarCollapsed ? 18 : 20} />
              {!canLogout && !sidebarCollapsed && (
                <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-xs text-white font-bold">!</span>
                </div>
              )}
            </button>
          </div>
          
          {!sidebarCollapsed ? (
            <div className="flex items-center bg-white/10 rounded-xl p-3 backdrop-blur-sm">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-3">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-base font-bold text-white">{user?.username}</p>
                <div className="flex items-center">
                  <p className="text-sm text-blue-200 capitalize flex items-center font-medium">
                    {user?.role === 'admin' && <Shield className="w-3 h-3 mr-1" />}
                    {user?.role}
                  </p>
                  <span className="ml-2 text-xs text-blue-300 bg-blue-500/20 px-2 py-1 rounded-full">
                    {user?.role === 'admin' ? 'Administrator' : 'Team Member'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto">
                <User className="w-5 h-5 text-white" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/30 dark:from-gray-900 dark:via-blue-900/10 dark:to-indigo-900/10 h-full">
        <div className="p-6 lg:p-8 w-full min-h-full">
          {children}
        </div>
      </main>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}