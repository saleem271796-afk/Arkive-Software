import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import { Layout } from './components/Layout';
import Dashboard from './components/Dashboard';
import ReceiptForm from './components/Receipts';
import { Clients } from './components/Clients';
import { Expenses, ActivityLog, BackupRestore } from './components/SimplePages';
import Settings from './components/Settings';
import EmployeeManagement from './components/EmployeeManagement';
import { TaxCalculator } from './components/TaxCalculator';
import { SmartNotifications } from './components/SmartNotifications';
import EmployeeAttendance from './components/EmployeeAttendance';
import { clsx } from 'clsx';

function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [showClientForm, setShowClientForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [pageTransition, setPageTransition] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4 shadow-lg"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading Arkive...</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">Initializing secure connections...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  const handlePageChange = (page: string) => {
    setPageTransition(true);
    setTimeout(() => {
      setCurrentPage(page);
      setPageTransition(false);
    }, 150);
  };

  const handleOpenForm = (formType: 'receipt' | 'client' | 'expense') => {
    // Close any existing forms first
    setShowReceiptForm(false);
    setShowClientForm(false);
    setShowExpenseForm(false);
    
    // Small delay to ensure clean state
    setTimeout(() => {
      switch (formType) {
        case 'receipt':
          setCurrentPage('receipts');
          setShowReceiptForm(true);
          break;
        case 'client':
          setCurrentPage('clients');
          setShowClientForm(true);
          break;
        case 'expense':
          setCurrentPage('expenses');
          setShowExpenseForm(true);
          break;
      }
    }, 100);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onPageChange={handlePageChange} onOpenForm={handleOpenForm} />;
      case 'receipts':
        return <ReceiptForm showForm={showReceiptForm} onCloseForm={() => setShowReceiptForm(false)} />;
      case 'clients':
        return <Clients showForm={showClientForm} onCloseForm={() => setShowClientForm(false)} />;
      case 'expenses':
        return <Expenses showForm={showExpenseForm} onCloseForm={() => setShowExpenseForm(false)} />;
      case 'employees':
        return <EmployeeManagement />;
      case 'attendance':
        return <EmployeeAttendance />;
      case 'tax-calculator':
        return <TaxCalculator />;
      case 'notifications':
        return <SmartNotifications />;
      case 'activity':
        return <ActivityLog />;
      case 'backup':
        return <BackupRestore />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard onPageChange={handlePageChange} onOpenForm={handleOpenForm} />;
    }
  };

  return (
    <Layout currentPage={currentPage} onPageChange={handlePageChange}>
      <div className={clsx(
        "transition-all duration-300 ease-in-out",
        pageTransition ? "opacity-0 transform translate-y-4 scale-95" : "opacity-100 transform translate-y-0 scale-100"
      )}>
        {renderPage()}
      </div>
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;