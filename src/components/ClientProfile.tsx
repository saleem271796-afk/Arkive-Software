import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  CreditCard,
  FileText,
  Calendar,
  DollarSign,
  Receipt,
  Download,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Target,
  Eye,
  X,
  Upload,
  Shield,
  Building,
  Copy,
  Lock,
  Clock,
  Users,
  Edit,
  AlertTriangle,
  CheckSquare,
  Square,
  Timer,
  Star,
  TrendingUp,
  Activity,
  Filter,
  Search
} from 'lucide-react';
import { useDatabase } from '../hooks/useDatabase';
import { useAuth } from '../contexts/AuthContext';
import { format, isAfter, differenceInDays } from 'date-fns';
import { exportService } from '../services/export';
import { db } from '../services/database';
import { clsx } from 'clsx';

interface ClientProfileProps {
  client: {
    id: string;
    name: string;
    cnic: string;
    type: string;
    phone?: string;
    email?: string;
    password?: string;
    createdAt: Date;
    notes?: string;
  };
  onBack: () => void;
}

interface ClientTask {
  id: string;
  title: string;
  description: string;
  clientId: string;
  clientName: string;
  clientCnic: string;
  assignedTo?: string;
  assignedBy: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  deadline?: Date;
  completedAt?: Date;
  documentsRequired: string[];
  documentsReceived: string[];
  createdAt: Date;
  updatedAt: Date;
}

const getTaskStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    completed: 'bg-green-100 text-green-800 border-green-200',
    in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200',
  };
  return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
};

const getPriorityColor = (priority: string) => {
  const colors: Record<string, string> = {
    urgent: 'bg-red-100 text-red-800 border-red-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-green-100 text-green-800 border-green-200',
  };
  return colors[priority] || 'bg-gray-100 text-gray-800 border-gray-200';
};

const getTaskStatusIcon = (status: string) => {
  switch (status) {
    case 'completed': return <CheckCircle className="w-4 h-4 text-green-600" />;
    case 'in_progress': return <Clock className="w-4 h-4 text-blue-600" />;
    case 'pending': return <Timer className="w-4 h-4 text-yellow-600" />;
    case 'cancelled': return <X className="w-4 h-4 text-red-600" />;
    default: return <Square className="w-4 h-4 text-gray-600" />;
  }
};

export function ClientProfile({ client, onBack }: ClientProfileProps) {
  const { receipts, getReceiptsByClient, documents, getDocumentsByClient, employees } = useDatabase();
  const { user, isAdmin } = useAuth();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [clientReceipts, setClientReceipts] = useState<any[]>([]);
  const [clientDocuments, setClientDocuments] = useState<any[]>([]);
  const [clientTasks, setClientTasks] = useState<ClientTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [editingTask, setEditingTask] = useState<ClientTask | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordRequestSent, setPasswordRequestSent] = useState(false);
  const [taskFilter, setTaskFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [taskFormData, setTaskFormData] = useState({
    title: '',
    description: '',
    assignedTo: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    deadline: '',
    documentsRequired: [''],
  });

  const [documentFormData, setDocumentFormData] = useState({
    fileName: '',
    fileType: 'other' as 'cnic' | 'tax_file' | 'contract' | 'invoice' | 'other',
    tags: [''],
    file: null as File | null,
  });

  useEffect(() => {
    loadClientData();
  }, [client.id]);

  const loadClientData = async () => {
    try {
      setLoading(true);
      
      // Ensure database is initialized
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const [receiptsData, documentsData, tasksData] = await Promise.all([
        getReceiptsByClient(client.cnic),
        getDocumentsByClient(client.cnic),
        db.getTasksByClient(client.id),
      ]);
      setClientReceipts(receiptsData);
      setClientDocuments(documentsData);
      setClientTasks(tasksData);
    } catch (error) {
      console.error('Error loading client data:', error);
      showMessage('Error loading client data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showMessage('Copied to clipboard!', 'success');
  };

  const totalPaid = clientReceipts.reduce((sum, receipt) => sum + (receipt.amount || 0), 0);
  const averagePayment = clientReceipts.length > 0 ? totalPaid / clientReceipts.length : 0;
  const lastPayment = clientReceipts.length > 0 
    ? clientReceipts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] 
    : null;

  const paymentMethods = clientReceipts.reduce((acc, receipt) => {
    acc[receipt.paymentMethod] = (acc[receipt.paymentMethod] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleExportPaymentHistory = async () => {
    try {
      await exportService.exportClientPaymentHistory(client, clientReceipts);
      showMessage('Payment history exported successfully!', 'success');
    } catch (error) {
      console.error('Export error:', error);
      showMessage('Error exporting payment history', 'error');
    }
  };

  const resetTaskForm = () => {
    setTaskFormData({
      title: '',
      description: '',
      assignedTo: '',
      priority: 'medium',
      deadline: '',
      documentsRequired: [''],
    });
    setEditingTask(null);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const taskData = {
        title: taskFormData.title,
        description: taskFormData.description,
        clientId: client.id,
        clientName: client.name,
        clientCnic: client.cnic,
        assignedTo: taskFormData.assignedTo || undefined,
        assignedBy: user!.id,
        priority: taskFormData.priority,
        status: 'pending' as const,
        deadline: taskFormData.deadline ? new Date(taskFormData.deadline) : undefined,
        documentsRequired: taskFormData.documentsRequired.filter(doc => doc.trim()),
        documentsReceived: [],
      };

      if (editingTask) {
        const updatedTask = { ...editingTask, ...taskData, updatedAt: new Date() };
        await db.updateClientTask(updatedTask);
        showMessage('Task updated successfully!', 'success');
      } else {
        await db.createClientTask(taskData);
        showMessage('Task created successfully!', 'success');
      }

      // Create notification if assigned to employee
      if (taskFormData.assignedTo) {
        const assignedEmployee = employees.find(emp => emp.id === taskFormData.assignedTo);
        await db.createNotification({
          message: `📋 New task assigned: "${taskFormData.title}" for client ${client.name}`,
          type: 'info',
          read: false,
          createdAt: new Date(),
        });
      }

      // Log activity
      await db.createActivity({
        userId: user!.id,
        action: editingTask ? 'update_client_task' : 'create_client_task',
        details: `${editingTask ? 'Updated' : 'Created'} task "${taskFormData.title}" for client ${client.name} (${client.cnic})`,
        timestamp: new Date(),
      });

      resetTaskForm();
      setShowTaskForm(false);
      loadClientData();
    } catch (error) {
      console.error('Error saving task:', error);
      showMessage('Error saving task', 'error');
    }
  };

  const handleUpdateTaskStatus = async (task: ClientTask, newStatus: string) => {
    try {
      const updatedTask = {
        ...task,
        status: newStatus as any,
        completedAt: newStatus === 'completed' ? new Date() : undefined,
        updatedAt: new Date(),
      };

      await db.updateClientTask(updatedTask);
      loadClientData();

      // Log activity
      await db.createActivity({
        userId: user!.id,
        action: 'update_task_status',
        details: `Updated task "${task.title}" status to ${newStatus} for client ${client.name}`,
        timestamp: new Date(),
      });

      // Create notification for assigned employee
      if (task.assignedTo && task.assignedTo !== user!.id) {
        const assignedEmployee = employees.find(emp => emp.id === task.assignedTo);
        await db.createNotification({
          message: `📋 Task "${task.title}" status updated to ${newStatus} by ${user!.username}`,
          type: newStatus === 'completed' ? 'success' : 'info',
          read: false,
          createdAt: new Date(),
        });
      }

      showMessage(`Task status updated to ${newStatus}!`, 'success');
    } catch (error) {
      console.error('Error updating task status:', error);
      showMessage('Error updating task status', 'error');
    }
  };

  const handleEditTask = (task: ClientTask) => {
    setTaskFormData({
      title: task.title,
      description: task.description,
      assignedTo: task.assignedTo || '',
      priority: task.priority,
      deadline: task.deadline ? format(task.deadline, 'yyyy-MM-dd') : '',
      documentsRequired: task.documentsRequired.length > 0 ? task.documentsRequired : [''],
    });
    setEditingTask(task);
    setShowTaskForm(true);
  };

  const handleDeleteTask = async (taskId: string, taskTitle: string) => {
    if (confirm(`Are you sure you want to delete the task "${taskTitle}"?`)) {
      try {
        await db.deleteClientTask(taskId);
        loadClientData();
        showMessage('Task deleted successfully!', 'success');
      } catch (error) {
        console.error('Error deleting task:', error);
        showMessage('Error deleting task', 'error');
      }
    }
  };

  const handleDocumentUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentFormData.file) {
      showMessage('Please select a file to upload', 'error');
      return;
    }

    try {
      const fileData = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(documentFormData.file!);
      });

      const newDocument = {
        clientCnic: client.cnic,
        fileName: documentFormData.fileName || documentFormData.file.name,
        fileType: documentFormData.fileType,
        fileSize: documentFormData.file.size,
        mimeType: documentFormData.file.type,
        encryptedData: fileData,
        tags: documentFormData.tags.filter(tag => tag.trim()),
        uploadedBy: user!.id,
      };

      await db.createDocument(newDocument);
      setDocumentFormData({ fileName: '', fileType: 'other', tags: [''], file: null });
      setShowDocumentUpload(false);
      loadClientData();
      showMessage('Document uploaded successfully!', 'success');
    } catch (error) {
      console.error('Error uploading document:', error);
      showMessage('Error uploading document', 'error');
    }
  };

  const handleRequestPasswordAccess = async () => {
    try {
      await db.createClientAccessRequest({
        employeeId: user!.id,
        employeeName: user!.username,
        clientId: client.id,
        clientName: client.name,
        clientCnic: client.cnic,
        reason: `Request access to view client credentials for ${client.name}`,
        status: 'pending'
      });
      
      setPasswordRequestSent(true);
      showMessage('Password access request sent to admin!', 'success');
    } catch (error) {
      console.error('Error requesting password access:', error);
      showMessage('Error sending password access request', 'error');
    }
  };

  const isTaskOverdue = (task: ClientTask) => {
    return task.deadline && task.status !== 'completed' && isAfter(new Date(), task.deadline);
  };

  const getDaysUntilDeadline = (task: ClientTask) => {
    if (!task.deadline) return null;
    return differenceInDays(task.deadline, new Date());
  };

  // Filter tasks
  const filteredTasks = clientTasks.filter(task => {
    const matchesFilter = taskFilter === 'all' || task.status === taskFilter;
    const matchesSearch = !searchTerm || 
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Task statistics
  const taskStats = {
    total: clientTasks.length,
    completed: clientTasks.filter(t => t.status === 'completed').length,
    inProgress: clientTasks.filter(t => t.status === 'in_progress').length,
    pending: clientTasks.filter(t => t.status === 'pending').length,
    overdue: clientTasks.filter(t => isTaskOverdue(t)).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Message */}
      {message && (
        <div className={clsx(
          "p-4 rounded-lg border animate-slideInRight",
          message.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        )}>
          <div className="flex items-center">
            {message.type === 'success' ? <CheckCircle className="w-5 h-5 mr-2" /> : <AlertCircle className="w-5 h-5 mr-2" />}
            <span className="font-medium">{message.text}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-3 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <User className="w-7 h-7 text-white" />
              </div>
              {client.name}
            </h1>
            <p className="text-gray-600 mt-1">
              CNIC: {client.cnic} • Type: {client.type} • Member since {format(client.createdAt, 'MMM yyyy')}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportPaymentHistory}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
          >
            <Download size={20} />
            Export History
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowTaskForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
            >
              <Plus size={20} />
              Create Task
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg p-6 border border-gray-200 hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Paid</p>
              <p className="text-2xl font-bold text-green-600">PKR {totalPaid.toLocaleString('en-PK')}</p>
              <p className="text-xs text-gray-500 mt-1">{clientReceipts.length} payments</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200 hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Payment</p>
              <p className="text-2xl font-bold text-blue-600">PKR {Math.round(averagePayment).toLocaleString('en-PK')}</p>
              <p className="text-xs text-gray-500 mt-1">per transaction</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200 hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Tasks</p>
              <p className="text-2xl font-bold text-orange-600">{taskStats.inProgress + taskStats.pending}</p>
              <p className="text-xs text-gray-500 mt-1">{taskStats.overdue} overdue</p>
            </div>
            <Target className="w-8 h-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200 hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Documents</p>
              <p className="text-2xl font-bold text-purple-600">{clientDocuments.length}</p>
              <p className="text-xs text-gray-500 mt-1">uploaded files</p>
            </div>
            <FileText className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Overview', icon: User },
              { id: 'tasks', label: 'Tasks', icon: Target, badge: taskStats.pending + taskStats.inProgress },
              { id: 'payments', label: 'Payment History', icon: Receipt, badge: clientReceipts.length },
              { id: 'documents', label: 'Documents', icon: FileText, badge: clientDocuments.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  "flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors relative",
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                )}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Client Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <User className="w-5 h-5 text-blue-600" />
                    Client Information
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 space-y-4">
                    {[
                      { icon: User, label: 'Full Name', value: client.name, copyable: true },
                      { icon: Shield, label: 'CNIC', value: client.cnic, copyable: true },
                      { icon: Building, label: 'Client Type', value: client.type, copyable: false },
                      { icon: Phone, label: 'Phone', value: client.phone || 'Not provided', copyable: !!client.phone },
                      { icon: Mail, label: 'Email', value: client.email || 'Not provided', copyable: !!client.email },
                      {
                        icon: Lock,
                        label: 'Password',
                        value: isAdmin ? (client.password || 'Not set') : (showPassword ? client.password || 'Not set' : '••••••••'),
                        copyable: isAdmin || showPassword,
                        restricted: !isAdmin,
                      },
                    ].map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <item.icon className="w-5 h-5 text-gray-600" />
                          <div>
                            <p className="text-sm font-medium text-gray-600">{item.label}</p>
                            <p className="font-semibold text-gray-900">{item.value}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.copyable && (
                            <button
                              onClick={() => copyToClipboard(item.value)}
                              className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-all"
                              title={`Copy ${item.label}`}
                            >
                              <Copy size={16} />
                            </button>
                          )}
                          {item.restricted && !isAdmin && !passwordRequestSent && !showPassword && (
                            <button
                              onClick={handleRequestPasswordAccess}
                              className="text-blue-600 hover:text-blue-700 text-sm font-medium transition-all"
                            >
                              Request Access
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Summary */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    Payment Summary
                  </h3>
                  <div className="space-y-4">
                    <div className="bg-green-50 rounded-lg p-6 border border-green-200">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-medium text-green-600">Total Revenue</p>
                        <DollarSign className="w-6 h-6 text-green-600" />
                      </div>
                      <p className="text-3xl font-bold text-green-700">PKR {totalPaid.toLocaleString('en-PK')}</p>
                      <p className="text-sm text-green-600 mt-1">From {clientReceipts.length} transactions</p>
                    </div>
                    
                    <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-medium text-blue-600">Average Payment</p>
                        <TrendingUp className="w-6 h-6 text-blue-600" />
                      </div>
                      <p className="text-2xl font-bold text-blue-700">PKR {Math.round(averagePayment).toLocaleString('en-PK')}</p>
                      <p className="text-sm text-blue-600 mt-1">per transaction</p>
                    </div>

                    {lastPayment && (
                      <div className="bg-purple-50 rounded-lg p-6 border border-purple-200">
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-sm font-medium text-purple-600">Last Payment</p>
                          <Calendar className="w-6 h-6 text-purple-600" />
                        </div>
                        <p className="text-2xl font-bold text-purple-700">PKR {lastPayment.amount.toLocaleString('en-PK')}</p>
                        <p className="text-sm text-purple-600 mt-1">{format(lastPayment.date, 'MMM dd, yyyy')}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment Methods */}
              {Object.keys(paymentMethods).length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-gray-600" />
                    Payment Methods Used
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {Object.entries(paymentMethods).map(([method, count]) => (
                      <div key={method} className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-center">
                        <p className="text-sm font-medium text-gray-600 capitalize">{method.replace('_', ' ')}</p>
                        <p className="text-xl font-bold text-gray-900">{count}</p>
                        <p className="text-xs text-gray-500">times used</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {client.notes && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-gray-600" />
                    Notes
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <p className="text-gray-700">{client.notes}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tasks Tab */}
          {activeTab === 'tasks' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-600" />
                  Client Tasks ({clientTasks.length})
                </h3>
                {isAdmin && (
                  <button
                    onClick={() => setShowTaskForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
                  >
                    <Plus size={20} />
                    Create Task
                  </button>
                )}
              </div>

              {/* Task Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-center">
                  <p className="text-sm font-medium text-gray-600">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{taskStats.total}</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200 text-center">
                  <p className="text-sm font-medium text-yellow-600">Pending</p>
                  <p className="text-2xl font-bold text-yellow-700">{taskStats.pending}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 text-center">
                  <p className="text-sm font-medium text-blue-600">In Progress</p>
                  <p className="text-2xl font-bold text-blue-700">{taskStats.inProgress}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 border border-green-200 text-center">
                  <p className="text-sm font-medium text-green-600">Completed</p>
                  <p className="text-2xl font-bold text-green-700">{taskStats.completed}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 border border-red-200 text-center">
                  <p className="text-sm font-medium text-red-600">Overdue</p>
                  <p className="text-2xl font-bold text-red-700">{taskStats.overdue}</p>
                </div>
              </div>

              {/* Task Filters */}
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search tasks..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    />
                  </div>
                  <select
                    value={taskFilter}
                    onChange={(e) => setTaskFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="all">All Tasks</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <div className="flex items-center text-sm text-gray-600">
                    <Filter className="w-4 h-4 mr-2" />
                    Showing {filteredTasks.length} of {clientTasks.length} tasks
                  </div>
                </div>
              </div>

              {/* Tasks List */}
              <div className="space-y-4">
                {filteredTasks.map((task) => {
                  const daysUntilDeadline = getDaysUntilDeadline(task);
                  const assignedEmployee = task.assignedTo ? employees.find(emp => emp.id === task.assignedTo) : null;
                  
                  return (
                    <div
                      key={task.id}
                      className={clsx(
                        "rounded-lg border p-6 transition-all",
                        isTaskOverdue(task) ? "bg-red-50 border-red-200" :
                        task.status === 'completed' ? "bg-green-50 border-green-200" :
                        task.status === 'in_progress' ? "bg-blue-50 border-blue-200" :
                        "bg-white border-gray-200 hover:border-blue-300"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            {getTaskStatusIcon(task.status)}
                            <h4 className="text-lg font-semibold text-gray-900">{task.title}</h4>
                            <span className={clsx("px-3 py-1 text-xs font-medium rounded-full border", getPriorityColor(task.priority))}>
                              {task.priority}
                            </span>
                            <span className={clsx("px-3 py-1 text-xs font-medium rounded-full border", getTaskStatusColor(task.status))}>
                              {task.status.replace('_', ' ')}
                            </span>
                            {isTaskOverdue(task) && (
                              <span className="px-3 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full border border-red-200 animate-pulse">
                                OVERDUE
                              </span>
                            )}
                          </div>
                          
                          <p className="text-gray-600 mb-4">{task.description}</p>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                            {assignedEmployee && (
                              <div>
                                <p className="text-gray-500 font-medium">Assigned To</p>
                                <p className="font-semibold text-gray-900 flex items-center gap-1">
                                  <Users className="w-4 h-4" />
                                  {assignedEmployee.name}
                                </p>
                                <p className="text-xs text-gray-500">{assignedEmployee.position}</p>
                              </div>
                            )}
                            {task.deadline && (
                              <div>
                                <p className="text-gray-500 font-medium">Deadline</p>
                                <p className="font-semibold text-gray-900 flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  {format(task.deadline, 'MMM dd, yyyy')}
                                </p>
                                {daysUntilDeadline !== null && (
                                  <p className={clsx(
                                    "text-xs font-medium",
                                    daysUntilDeadline < 0 ? "text-red-600" :
                                    daysUntilDeadline <= 3 ? "text-orange-600" :
                                    "text-gray-500"
                                  )}>
                                    {daysUntilDeadline < 0 ? `${Math.abs(daysUntilDeadline)} days overdue` :
                                     daysUntilDeadline === 0 ? 'Due today' :
                                     `${daysUntilDeadline} days left`}
                                  </p>
                                )}
                              </div>
                            )}
                            <div>
                              <p className="text-gray-500 font-medium">Created</p>
                              <p className="font-semibold text-gray-900 flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {format(task.createdAt, 'MMM dd, yyyy')}
                              </p>
                              {task.completedAt && (
                                <p className="text-xs text-green-600">
                                  Completed: {format(task.completedAt, 'MMM dd, yyyy')}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Document Requirements */}
                          {task.documentsRequired.length > 0 && (
                            <div className="mt-4">
                              <p className="text-sm font-medium text-gray-700 mb-2">Required Documents:</p>
                              <div className="flex flex-wrap gap-2">
                                {task.documentsRequired.map((doc, index) => {
                                  const isReceived = task.documentsReceived.includes(doc);
                                  return (
                                    <span
                                      key={index}
                                      className={clsx(
                                        "px-3 py-1 text-xs font-medium rounded-full border flex items-center gap-1",
                                        isReceived 
                                          ? "bg-green-100 text-green-800 border-green-200" 
                                          : "bg-gray-100 text-gray-800 border-gray-200"
                                      )}
                                    >
                                      {doc}
                                      {isReceived && <CheckCircle className="w-3 h-3" />}
                                    </span>
                                  );
                                })}
                              </div>
                              <p className="text-xs text-gray-500 mt-2">
                                {task.documentsReceived.length} of {task.documentsRequired.length} documents received
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Task Actions */}
                        {isAdmin && (
                          <div className="flex flex-col gap-2 ml-4">
                            <button
                              onClick={() => handleEditTask(task)}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-medium"
                            >
                              <Edit size={16} className="inline mr-1" />
                              Edit
                            </button>
                            {task.status !== 'completed' && (
                              <button
                                onClick={() => handleUpdateTaskStatus(task, 'completed')}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all text-sm font-medium"
                              >
                                <CheckCircle size={16} className="inline mr-1" />
                                Complete
                              </button>
                            )}
                            {task.status === 'pending' && (
                              <button
                                onClick={() => handleUpdateTaskStatus(task, 'in_progress')}
                                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all text-sm font-medium"
                              >
                                <Clock size={16} className="inline mr-1" />
                                Start
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteTask(task.id, task.title)}
                              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all text-sm font-medium"
                            >
                              <Trash2 size={16} className="inline mr-1" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredTasks.length === 0 && (
                <div className="text-center py-12">
                  <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {clientTasks.length === 0 ? 'No tasks created' : 'No tasks match your filters'}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    {clientTasks.length === 0 
                      ? 'Create tasks to track work for this client'
                      : 'Try adjusting your search or filter criteria'
                    }
                  </p>
                  {isAdmin && clientTasks.length === 0 && (
                    <button
                      onClick={() => setShowTaskForm(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
                    >
                      <Plus size={20} />
                      Create First Task
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Payments Tab */}
          {activeTab === 'payments' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-green-600" />
                  Payment History ({clientReceipts.length} receipts)
                </h3>
                <button
                  onClick={handleExportPaymentHistory}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
                >
                  <Download size={20} />
                  Export
                </button>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Work Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Method</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {clientReceipts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((receipt) => (
                      <tr key={receipt.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {format(receipt.date, 'MMM dd, yyyy')}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-green-600">
                          PKR {receipt.amount.toLocaleString('en-PK')}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {receipt.natureOfWork || 'No description'}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full border border-blue-200 capitalize">
                            {receipt.paymentMethod.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {format(receipt.createdAt, 'MMM dd, yyyy HH:mm')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {clientReceipts.length === 0 && (
                  <div className="text-center py-12">
                    <Receipt className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No payment history</h3>
                    <p className="text-gray-500">No receipts found for this client</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-purple-600" />
                  Documents ({clientDocuments.length})
                </h3>
                <button
                  onClick={() => setShowDocumentUpload(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all"
                >
                  <Upload size={20} />
                  Upload Document
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {clientDocuments.map((doc) => (
                  <div key={doc.id} className="bg-white rounded-lg p-6 border border-gray-200 hover:border-purple-300 transition-all">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{doc.fileName}</p>
                          <p className="text-sm text-gray-600 capitalize">{doc.fileType.replace('_', ' ')}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => db.logDocumentAccess(doc.id, user!.id, 'view')}
                        className="p-2 rounded-lg bg-purple-100 text-purple-600 hover:bg-purple-200 transition-all"
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                    <div className="text-sm text-gray-600 space-y-2">
                      <p>Size: {(doc.fileSize / 1024).toFixed(1)} KB</p>
                      <p>Uploaded: {format(doc.uploadedAt, 'MMM dd, yyyy')}</p>
                      {doc.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {doc.tags.map((tag: string, index: number) => (
                            <span key={index} className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs border border-purple-200">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {clientDocuments.length === 0 && (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No documents uploaded</h3>
                  <p className="text-gray-500 mb-4">Upload documents for this client</p>
                  <button
                    onClick={() => setShowDocumentUpload(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all"
                  >
                    <Upload size={20} />
                    Upload First Document
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Task Form Modal */}
      {showTaskForm && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60">
          <div className="bg-white rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" />
                {editingTask ? 'Edit Task' : 'Create Task'} for {client.name}
              </h2>
              <button
                onClick={() => {
                  resetTaskForm();
                  setShowTaskForm(false);
                }}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Task Title *
                </label>
                <input
                  type="text"
                  value={taskFormData.title}
                  onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                  placeholder="e.g. 2025 Tax Return Filing"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={taskFormData.description}
                  onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                  placeholder="Detailed description of the task..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assign to Employee
                  </label>
                  <select
                    value={taskFormData.assignedTo}
                    onChange={(e) => setTaskFormData({ ...taskFormData, assignedTo: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Unassigned</option>
                    {employees.filter(emp => emp.status === 'active').map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} - {emp.position}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <select
                    value={taskFormData.priority}
                    onChange={(e) => setTaskFormData({ ...taskFormData, priority: e.target.value as any })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deadline (Optional)
                </label>
                <input
                  type="date"
                  value={taskFormData.deadline}
                  onChange={(e) => setTaskFormData({ ...taskFormData, deadline: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Required Documents
                </label>
                <div className="space-y-3">
                  {taskFormData.documentsRequired.map((doc, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <input
                        type="text"
                        value={doc}
                        onChange={(e) => {
                          const newDocs = [...taskFormData.documentsRequired];
                          newDocs[index] = e.target.value;
                          setTaskFormData({ ...taskFormData, documentsRequired: newDocs });
                        }}
                        placeholder="e.g. CNIC Copy, Tax Certificate, Bank Statement"
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newDocs = taskFormData.documentsRequired.filter((_, i) => i !== index);
                            setTaskFormData({ ...taskFormData, documentsRequired: newDocs });
                          }}
                          className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setTaskFormData({ 
                    ...taskFormData, 
                    documentsRequired: [...taskFormData.documentsRequired, ''] 
                  })}
                  className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium transition-all flex items-center gap-1"
                >
                  <Plus size={16} />
                  Add Document Requirement
                </button>
              </div>

              <div className="flex gap-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    resetTaskForm();
                    setShowTaskForm(false);
                  }}
                  className="flex-1 px-6 py-3 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-all font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium"
                >
                  {editingTask ? 'Update Task' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Upload Modal */}
      {showDocumentUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-purple-600" />
                Upload Document
              </h2>
              <button
                onClick={() => setShowDocumentUpload(false)}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleDocumentUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  File *
                </label>
                <input
                  type="file"
                  onChange={(e) => setDocumentFormData({ ...documentFormData, file: e.target.files?.[0] || null })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  File Name
                </label>
                <input
                  type="text"
                  value={documentFormData.fileName}
                  onChange={(e) => setDocumentFormData({ ...documentFormData, fileName: e.target.value })}
                  placeholder="Custom file name (optional)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Type
                </label>
                <select
                  value={documentFormData.fileType}
                  onChange={(e) => setDocumentFormData({ ...documentFormData, fileType: e.target.value as any })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="cnic">CNIC</option>
                  <option value="tax_file">Tax File</option>
                  <option value="contract">Contract</option>
                  <option value="invoice">Invoice</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowDocumentUpload(false)}
                  className="flex-1 px-6 py-3 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-all font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all font-medium"
                >
                  Upload Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}