import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Plus,
  Eye,
  Edit,
  AlertCircle,
  User,
  Timer,
  Coffee,
  Home as HomeIcon,
  Target,
  Square,
  CheckSquare
} from 'lucide-react';
import { useAttendance } from '../hooks/useAttendance';
import { useTasks } from '../hooks/useTasks';
import { useAuth } from '../contexts/AuthContext';
import { useDatabase } from '../hooks/useDatabase';
import { format, startOfMonth, endOfMonth, isToday } from 'date-fns';
import { db } from '../services/database';

const EmployeeAttendance: React.FC = () => {
  const { attendance, markAttendance, updateAttendance, loading } = useAttendance();
  const { updateTask } = useDatabase();
  const { user } = useAuth();
  const [showMarkForm, setShowMarkForm] = useState(false);
  const [showPasswordRequest, setShowPasswordRequest] = useState(false);
  const [passwordRequestReason, setPasswordRequestReason] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    status: 'present' as 'present' | 'absent' | 'late' | 'half-day' | 'leave',
    notes: ''
  });

  // Get current user's attendance
  const myAttendance = attendance.filter(a => a.employeeId === user?.id);
  
  
  // Check if already marked attendance today
  useEffect(() => {
    const today = myAttendance.find(a => isToday(a.date));
    setTodayAttendance(today);
  }, [myAttendance]);

  // Load employee tasks
  useEffect(() => {
    const loadMyTasks = async () => {
      if (user?.id) {
        try {
          const employeeTasks = await db.getTasksByEmployee(user.id);
          setMyTasks(employeeTasks);
        } catch (error) {
          console.error('Error loading employee tasks:', error);
          setMyTasks([]);
        }
      }
    };
    
    loadMyTasks();
  }, [user?.id]);

  // Calculate task stats
  const completedTasks = myTasks.filter(task => task.status === 'completed').length;
  const pendingTasks = myTasks.filter(task => task.status === 'pending');

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleMarkAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (todayAttendance) {
      showMessage('Attendance already marked for today', 'error');
      return;
    }

    try {
      const checkInTime = new Date(); // Auto-capture current time

      await markAttendance({
        employeeId: user!.id,
        date: new Date(),
        checkIn: checkInTime,
        checkOut: null, // Will be set when checking out
        status: formData.status,
        notes: formData.notes,
        workingHours: 0, // Will be calculated on checkout
        createdAt: new Date()
      });

      // Log activity
      await db.createActivity({
        userId: user!.id,
        action: 'mark_attendance',
        details: `Marked attendance as ${formData.status} - Check-in: ${format(checkInTime, 'hh:mm a')}`,
        timestamp: new Date(),
      });

      setShowMarkForm(false);
      setFormData({
        status: 'present',
        notes: ''
      });
      
      showMessage('Attendance marked successfully!', 'success');
    } catch (error) {
      console.error('Error marking attendance:', error);
      showMessage('Error marking attendance. Please try again.', 'error');
    }
  };

  const handleUpdateAttendance = async () => {
    if (!todayAttendance) return;

    try {
      const checkOutTime = new Date();
      const workingHours = todayAttendance.checkIn ? 
        (checkOutTime.getTime() - todayAttendance.checkIn.getTime()) / (1000 * 60 * 60) : 0;

      const updatedAttendance = {
        ...todayAttendance,
        checkOut: checkOutTime,
        workingHours: Math.max(0, workingHours)
      };

      await updateAttendance(updatedAttendance);
      
      // Log activity
      await db.createActivity({
        userId: user!.id,
        action: 'checkout',
        details: `Checked out at ${format(checkOutTime, 'hh:mm a')} - Total hours: ${workingHours.toFixed(1)}`,
        timestamp: new Date(),
      });

      showMessage('Check-out time updated successfully!', 'success');
    } catch (error) {
      console.error('Error updating attendance:', error);
      showMessage('Error updating check-out time', 'error');
    }
  };

  const handlePasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Create notification for admin
      await db.createNotification({
        message: `🔐 Password Change Request: Employee "${user?.username}" has requested a password change. Reason: ${passwordRequestReason}`,
        type: 'warning',
        read: false,
        createdAt: new Date()
      });
      
      // Create client access request entry
      await db.createClientAccessRequest({
        employeeId: user!.id,
        employeeName: user!.username,
        clientId: 'password-change',
        clientName: 'Password Change Request',
        clientCnic: 'N/A',
        reason: passwordRequestReason,
        status: 'pending'
      });
      
      // Log activity
      await db.createActivity({
        userId: user!.id,
        action: 'password_change_request',
        details: `Requested password change - Reason: ${passwordRequestReason}`,
        timestamp: new Date(),
      });
      
      setShowPasswordRequest(false);
      setPasswordRequestReason('');
      showMessage('🔐 Password change request sent to administrator. You will be notified once reviewed.', 'success');
    } catch (error) {
      console.error('Error sending password request:', error);
      showMessage('Error sending password request', 'error');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      case 'late': return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
      case 'absent': return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
      case 'half-day': return 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200';
      case 'leave': return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200';
      default: return 'bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'late': return <Timer className="w-4 h-4 text-yellow-500" />;
      case 'absent': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'half-day': return <Coffee className="w-4 h-4 text-orange-500" />;
      case 'leave': return <HomeIcon className="w-4 h-4 text-blue-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  // Calculate monthly stats
  const thisMonthAttendance = myAttendance.filter(a => {
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    return a.date >= monthStart && a.date <= monthEnd;
  });

  const presentDays = thisMonthAttendance.filter(a => a.status === 'present').length;
  const totalWorkingHours = thisMonthAttendance.reduce((sum, a) => sum + (a.workingHours || 0), 0);
  const avgWorkingHours = thisMonthAttendance.length > 0 ? totalWorkingHours / thisMonthAttendance.length : 0;

  const handleTaskStatusChange = async (task: any, newStatus: string) => {
    try {
      const updatedTask = { 
        ...task, 
        status: newStatus,
        updatedAt: new Date(),
        completedAt: newStatus === 'completed' ? new Date() : undefined
      };
      await updateTask(updatedTask);
      
      // Update local state
      setMyTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));
      
      // Log activity
      await db.createActivity({
        userId: user!.id,
        action: 'update_task_status',
        details: `Updated task "${task.title}" status to ${newStatus}`,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Error updating task status:', error);
      showMessage('Error updating task status', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-7 h-7 text-blue-600" />
            My Attendance
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track your daily attendance and working hours
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPasswordRequest(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            <AlertCircle size={20} />
            Request Password Change
          </button>
          {!todayAttendance ? (
            <button
              onClick={() => setShowMarkForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300 hover:scale-105"
            >
              <Plus size={20} />
              Mark Attendance
            </button>
          ) : !todayAttendance.checkOut ? (
            <button
              onClick={handleUpdateAttendance}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-300 hover:scale-105"
            >
              <Clock size={20} />
              Check Out
            </button>
          ) : (
            <div className="text-green-600 dark:text-green-400 font-medium">
              ✅ Attendance Complete for Today
            </div>
          )}
        </div>
      </div>

      {/* Today's Status */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Today's Status</h2>
        {todayAttendance ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              {getStatusIcon(todayAttendance.status)}
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                <p className="font-medium text-gray-900 dark:text-white capitalize">{todayAttendance.status}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Check In</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {todayAttendance.checkIn ? format(todayAttendance.checkIn, 'hh:mm a') : '-'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-green-500" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Check Out</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {todayAttendance.checkOut ? format(todayAttendance.checkOut, 'hh:mm a') : 'Not yet'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Timer className="w-4 h-4 text-purple-500" />
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Working Hours</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {todayAttendance.workingHours ? `${todayAttendance.workingHours.toFixed(1)}h` : '-'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No attendance marked for today</p>
            <button
              onClick={() => setShowMarkForm(true)}
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Mark Attendance Now
            </button>
          </div>
        )}
      </div>

      {/* Monthly Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 hover-lift">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Present Days</p>
              <p className="text-2xl font-bold text-green-600">{presentDays}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 hover-lift">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Hours</p>
              <p className="text-2xl font-bold text-blue-600">{totalWorkingHours.toFixed(1)}h</p>
            </div>
            <Timer className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 hover-lift">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Avg Hours/Day</p>
              <p className="text-2xl font-bold text-purple-600">{avgWorkingHours.toFixed(1)}h</p>
            </div>
            <Clock className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 hover-lift">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Tasks Completed</p>
              <p className="text-2xl font-bold text-orange-600">{completedTasks}</p>
            </div>
            <Target className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* My Tasks Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            My Tasks ({pendingTasks.length} pending)
          </h2>
        </div>
        
        <div className="p-6">
          {myTasks.length > 0 ? (
            <div className="space-y-4">
              {myTasks.map((task) => (
                <div key={task.id} className={`p-4 rounded-lg border transition-all duration-200 ${
                  task.status === 'completed' 
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                    : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <button
                        onClick={() => {
                          if (task.status === 'completed') {
                            handleTaskStatusChange(task, 'pending');
                          } else if (task.status === 'pending') {
                            handleTaskStatusChange(task, 'in_progress');
                          } else {
                            handleTaskStatusChange(task, 'completed');
                          }
                        }}
                        className="mt-1 text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        {task.status === 'completed' ? (
                          <CheckSquare className="w-5 h-5 text-green-600" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                      <div className="flex-1">
                        <h3 className={`font-semibold ${
                          task.status === 'completed' 
                            ? 'text-green-700 dark:text-green-300 line-through' 
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          {task.title}
                        </h3>
                        <p className={`text-sm mt-1 ${
                          task.status === 'completed' 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          {task.description}
                        </p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            task.priority === 'urgent' ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' :
                            task.priority === 'high' ? 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200' :
                            task.priority === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                            'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                          }`}>
                            {task.priority} priority
                          </span>
                          {task.dueDate && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              Due: {format(task.dueDate, 'MMM dd')}
                            </span>
                          )}
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            task.status === 'completed' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                            task.status === 'in_progress' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' :
                            'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                          }`}>
                            {task.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Target className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No tasks assigned yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Tasks assigned by your manager will appear here
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Attendance History */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 min-h-[500px]">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Attendance History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Check In
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Check Out
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Working Hours
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {myAttendance.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((record) => (
                <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {format(record.date, 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(record.status)}
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(record.status)}`}>
                        {record.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {record.checkIn ? format(record.checkIn, 'hh:mm a') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {record.checkOut ? format(record.checkOut, 'hh:mm a') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {record.workingHours ? `${record.workingHours.toFixed(1)}h` : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {record.notes || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {myAttendance.length === 0 && (
          <div className="text-center py-12">
            <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No attendance records</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Start by marking your attendance for today
            </p>
            <button
              onClick={() => setShowMarkForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300"
            >
              <Plus size={20} />
              Mark Attendance
            </button>
          </div>
        )}
      </div>

      {/* Mark Attendance Modal */}
      {showMarkForm && (
        <div className="form-modal">
          <div className="form-container animate-slideInRight">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Mark Today's Attendance
            </h2>
            
            <form onSubmit={handleMarkAttendance} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status *
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                >
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="half-day">Half Day</option>
                  <option value="leave">On Leave</option>
                  <option value="absent">Absent</option>
                </select>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">Automatic Time Tracking</span>
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  Check-in time will be automatically recorded when you mark attendance
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional notes..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </form>

            <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowMarkForm(false);
                  setFormData({
                    status: 'present',
                    notes: ''
                  });
                }}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-all duration-300"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkAttendance}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300"
              >
                Mark Attendance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Request Modal */}
      {showPasswordRequest && (
        <div className="form-modal">
          <div className="form-container animate-slideInRight">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Request Password Change
            </h2>
            
            <form onSubmit={handlePasswordRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason for Password Change *
                </label>
                <textarea
                  value={passwordRequestReason}
                  onChange={(e) => setPasswordRequestReason(e.target.value)}
                  placeholder="Please explain why you need a password change..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Important</span>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Your request will be sent to the administrator for review. You will be notified once your password has been updated.
                </p>
              </div>
            </form>

            <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordRequest(false);
                  setPasswordRequestReason('');
                }}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-all duration-300"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordRequest}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all duration-300"
              >
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeAttendance;