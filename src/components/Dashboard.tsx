import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Receipt, 
  CreditCard, 
  TrendingUp, 
  Calendar,
  DollarSign,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Plus,
  ArrowUpRight,
  Banknote,
  Building,
  UserCheck,
  Timer,
  BarChart3,
  Shield,
  Bell
} from 'lucide-react';
import { useDatabase } from '../hooks/useDatabase';
import { useAuth } from '../contexts/AuthContext';
import { format, startOfMonth, endOfMonth, isToday } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { db } from '../services/database';

interface DashboardProps {
  onPageChange: (page: string) => void;
  onOpenForm: (formType: 'receipt' | 'client' | 'expense') => void;
}

export default function Dashboard({ onPageChange, onOpenForm }: DashboardProps) {
  const { user, isAdmin } = useAuth();
  const { 
    clients = [], 
    receipts = [], 
    expenses = [], 
    employees = [],
    attendance = [],
    notifications = [],
    clientAccessRequests = [],
    markNotificationAsRead
  } = useDatabase();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  // Calculate dashboard statistics
  const totalClients = clients.length;
  const totalReceipts = receipts.length;
  const totalRevenue = receipts.reduce((sum, receipt) => sum + (receipt.amount || 0), 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;

  // Monthly statistics
  const currentMonth = new Date();
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const monthlyReceipts = receipts.filter(receipt => {
    const receiptDate = new Date(receipt.date);
    return receiptDate >= monthStart && receiptDate <= monthEnd;
  });

  const monthlyExpenses = expenses.filter(expense => {
    const expenseDate = new Date(expense.date);
    return expenseDate >= monthStart && expenseDate <= monthEnd;
  });

  const monthlyRevenue = monthlyReceipts.reduce((sum, receipt) => sum + (receipt.amount || 0), 0);
  const monthlyExpenseTotal = monthlyExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);

  // Recent activities
  const recentReceipts = receipts
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const recentClients = clients
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  // Employee attendance today (for admin)
  const todayAttendance = attendance.filter(att => isToday(new Date(att.date)));
  const presentToday = todayAttendance.filter(att => att.status === 'present').length;

  // Unread notifications
  const unreadNotifications = notifications.filter(n => !n.read);

  // Password change requests from notifications
  const passwordRequests = notifications.filter(n => 
    n.message.includes('Password Change Request') && !n.read
  );

  // Monthly revenue chart data
  const monthlyData = React.useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date();
      monthDate.setMonth(monthDate.getMonth() - i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      
      const monthReceipts = receipts.filter(r => {
        const date = new Date(r.date);
        return date >= monthStart && date <= monthEnd;
      });
      
      const monthExpenses = expenses.filter(e => {
        const date = new Date(e.date);
        return date >= monthStart && date <= monthEnd;
      });
      
      months.push({
        month: format(monthDate, 'MMM'),
        revenue: monthReceipts.reduce((sum, r) => sum + (r.amount || 0), 0),
        expenses: monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
      });
    }
    return months;
  }, [receipts, expenses]);

  const handlePasswordRequestAction = async (notificationId: string, action: 'approve' | 'deny') => {
    try {
      await markNotificationAsRead(notificationId);
      
      // Create response notification
      await db.createNotification({
        message: `🔐 Password change request has been ${action}d by administrator`,
        type: action === 'approve' ? 'success' : 'warning',
        read: false,
        createdAt: new Date()
      });
    } catch (error) {
      console.error('Error handling password request:', error);
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      const request = clientAccessRequests.find(r => r.id === requestId);
      if (!request) return;

      // Update the request status
      await db.updateClientAccessRequest({
        ...request,
        status: 'approved',
        respondedAt: new Date(),
        respondedBy: user!.id
      });
      
      // Create notification for employee
      await db.createNotification({
        message: `✅ Your client credential request has been approved by administrator`,
        type: 'success',
        read: false,
        createdAt: new Date()
      });
      
      showMessage('Request approved successfully!', 'success');
    } catch (error) {
      console.error('Error approving request:', error);
      showMessage('Error approving request', 'error');
    }
  };

  const handleDenyRequest = async (requestId: string) => {
    try {
      const request = clientAccessRequests.find(r => r.id === requestId);
      if (!request) return;

      // Update the request status
      await db.updateClientAccessRequest({
        ...request,
        status: 'denied',
        respondedAt: new Date(),
        respondedBy: user!.id
      });
      
      // Create notification for employee
      await db.createNotification({
        message: `❌ Your client credential request has been denied by administrator`,
        type: 'warning',
        read: false,
        createdAt: new Date()
      });
      
      showMessage('Request denied successfully!', 'success');
    } catch (error) {
      console.error('Error denying request:', error);
      showMessage('Error denying request', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg border ${
          message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
        } animate-slideInRight`}>
          <div className="flex items-center">
            {message.type === 'success' ? <CheckCircle className="w-5 h-5 mr-2" /> : <AlertCircle className="w-5 h-5 mr-2" />}
            {message.text}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome back, {user?.username}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Here's what's happening with your tax office today
          </p>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {format(new Date(), 'EEEE, MMMM dd, yyyy')}
        </div>
      </div>

      {/* Password Change Requests (Admin Only) */}
      {isAdmin && passwordRequests.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-orange-800 dark:text-orange-200 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Password Change Requests ({passwordRequests.length})
            </h3>
          </div>
          <div className="space-y-3">
            {passwordRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-orange-200 dark:border-orange-700">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{request.message}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {format(request.createdAt, 'MMM dd, yyyy HH:mm')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePasswordRequestAction(request.id, 'approve')}
                    className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handlePasswordRequestAction(request.id, 'deny')}
                    className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 rounded-xl shadow-lg hover-lift">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total Clients</p>
              <p className="text-white text-3xl font-bold">{totalClients}</p>
              <p className="text-blue-200 text-xs mt-1">Active clients</p>
            </div>
            <Users className="w-10 h-10 text-white opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 rounded-xl shadow-lg hover-lift">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Total Revenue</p>
              <p className="text-white text-3xl font-bold">PKR {totalRevenue.toLocaleString('en-PK')}</p>
              <p className="text-green-200 text-xs mt-1">All time</p>
            </div>
            <DollarSign className="w-10 h-10 text-white opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 rounded-xl shadow-lg hover-lift">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Monthly Revenue</p>
              <p className="text-white text-3xl font-bold">PKR {monthlyRevenue.toLocaleString('en-PK')}</p>
              <p className="text-purple-200 text-xs mt-1">{format(new Date(), 'MMMM yyyy')}</p>
            </div>
            <TrendingUp className="w-10 h-10 text-white opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 rounded-xl shadow-lg hover-lift">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium">Net Profit</p>
              <p className="text-white text-3xl font-bold">PKR {netProfit.toLocaleString('en-PK')}</p>
              <p className="text-orange-200 text-xs mt-1">Revenue - Expenses</p>
            </div>
            <Banknote className="w-10 h-10 text-white opacity-80" />
          </div>
        </div>
      </div>

      {/* Client Access Requests (Admin Only) */}
      {isAdmin && clientAccessRequests.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-orange-600" />
                Client Credential Requests ({clientAccessRequests.filter(r => r.status === 'pending').length} pending)
              </h3>
            </div>
          </div>
          
          <div className="p-6">
            <div className="space-y-4">
              {clientAccessRequests.filter(r => r.status === 'pending').map((request) => (
                <div key={request.id} className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {request.employeeName} requesting client credentials
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Reason: {request.reason}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {request.requestedAt ? format(new Date(request.requestedAt), 'MMM dd, yyyy HH:mm') : 'N/A'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproveRequest(request.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleDenyRequest(request.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              ))}
              
              {clientAccessRequests.filter(r => r.status === 'pending').length === 0 && (
                <div className="text-center py-8">
                  <Shield className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No pending credential requests</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Revenue Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Revenue vs Expenses (Last 6 Months)
          </h3>
        </div>
        <div className="p-6">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#d1d5db' }}
              />
              <YAxis 
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#d1d5db' }}
                tickFormatter={(value) => `${(value / 1000)}K`}
              />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  `PKR ${value.toLocaleString('en-PK')}`, 
                  name === 'revenue' ? 'Revenue' : 'Expenses'
                ]}
                contentStyle={{ 
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="revenue" fill="#10B981" name="revenue" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" fill="#EF4444" name="expenses" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button
          onClick={() => onOpenForm('receipt')}
          className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300 text-left group"
        >
          <div className="flex items-center justify-between mb-4">
            <Receipt className="w-8 h-8 text-blue-600 group-hover:scale-110 transition-transform" />
            <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Add Receipt</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">Create a new client receipt</p>
        </button>

        <button
          onClick={() => onOpenForm('client')}
          className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-lg hover:border-green-300 dark:hover:border-green-600 transition-all duration-300 text-left group"
        >
          <div className="flex items-center justify-between mb-4">
            <Users className="w-8 h-8 text-green-600 group-hover:scale-110 transition-transform" />
            <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-green-600 transition-colors" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Add Client</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">Register a new client</p>
        </button>

        <button
          onClick={() => onOpenForm('expense')}
          className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-lg hover:border-red-300 dark:hover:border-red-600 transition-all duration-300 text-left group"
        >
          <div className="flex items-center justify-between mb-4">
            <CreditCard className="w-8 h-8 text-red-600 group-hover:scale-110 transition-transform" />
            <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-red-600 transition-colors" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Add Expense</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">Record a business expense</p>
        </button>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Receipts */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-green-600" />
                Recent Receipts
              </h3>
              <button
                onClick={() => onPageChange('receipts')}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 text-sm"
              >
                <Eye className="w-4 h-4" />
                View All
              </button>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {recentReceipts.map((receipt) => {
                const client = clients.find(c => c.cnic === receipt.clientCnic);
                return (
                  <div key={receipt.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{receipt.clientName}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{receipt.natureOfWork}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {format(new Date(receipt.date), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600 dark:text-green-400">
                        PKR {receipt.amount.toLocaleString('en-PK')}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 capitalize">
                        {receipt.paymentMethod.replace('_', ' ')}
                      </p>
                    </div>
                  </div>
                );
              })}
              
              {recentReceipts.length === 0 && (
                <div className="text-center py-8">
                  <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No receipts yet</p>
                  <button
                    onClick={() => onOpenForm('receipt')}
                    className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Create First Receipt
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Clients */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Recent Clients
              </h3>
              <button
                onClick={() => onPageChange('clients')}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 text-sm"
              >
                <Eye className="w-4 h-4" />
                View All
              </button>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {recentClients.map((client) => {
                const clientReceipts = receipts.filter(r => r.clientCnic === client.cnic);
                const totalPaid = clientReceipts.reduce((sum, r) => sum + (r.amount || 0), 0);
                
                return (
                  <div key={client.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{client.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{client.type}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        CNIC: {client.cnic}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-600 dark:text-blue-400">
                        PKR {totalPaid.toLocaleString('en-PK')}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {clientReceipts.length} receipts
                      </p>
                    </div>
                  </div>
                );
              })}
              
              {recentClients.length === 0 && (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No clients yet</p>
                  <button
                    onClick={() => onOpenForm('client')}
                    className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add First Client
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-600" />
            {format(new Date(), 'MMMM yyyy')} Summary
          </h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-3">
                <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                PKR {monthlyRevenue.toLocaleString('en-PK')}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Monthly Revenue</p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {monthlyReceipts.length} receipts
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-3">
                <CreditCard className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                PKR {monthlyExpenseTotal.toLocaleString('en-PK')}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Monthly Expenses</p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                {monthlyExpenses.length} expenses
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-3">
                <Banknote className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <p className={`text-2xl font-bold ${
                (monthlyRevenue - monthlyExpenseTotal) >= 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                PKR {(monthlyRevenue - monthlyExpenseTotal).toLocaleString('en-PK')}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Net Profit</p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                This month
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {unreadNotifications.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-orange-600" />
                Recent Notifications ({unreadNotifications.length})
              </h3>
              <button
                onClick={() => onPageChange('notifications')}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 text-sm"
              >
                <Eye className="w-4 h-4" />
                View All
              </button>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {unreadNotifications.slice(0, 5).map((notification) => (
                <div key={notification.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className={`p-2 rounded-full ${
                    notification.type === 'success' ? 'bg-green-100 dark:bg-green-900' :
                    notification.type === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900' :
                    notification.type === 'error' ? 'bg-red-100 dark:bg-red-900' :
                    'bg-blue-100 dark:bg-blue-900'
                  }`}>
                    {notification.type === 'success' && <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />}
                    {notification.type === 'warning' && <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />}
                    {notification.type === 'error' && <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />}
                    {notification.type === 'info' && <Bell className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {format(notification.createdAt, 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}