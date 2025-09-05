import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Search, 
  Filter,
  UserPlus,
  Building,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Timer,
  User,
  Shield,
  Download,
  X
} from 'lucide-react';
import { useEmployees } from '../hooks/useEmployees';
import { useAttendance } from '../hooks/useAttendance';
import { useAuth } from '../contexts/AuthContext';
import { format, isToday } from 'date-fns';
import { db } from '../services/database';

const EmployeeManagement: React.FC = () => {
  const { employees, createEmployee, updateEmployee, deleteEmployee, loading } = useEmployees();
  const { attendance } = useAttendance();
  const { user, isAdmin } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState('employees');
  const [employeePermissions, setEmployeePermissions] = useState<Record<string, any>>({});
  const [selectedEmployeeForPermissions, setSelectedEmployeeForPermissions] = useState<any>(null);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);

  const [formData, setFormData] = useState({
    employeeId: '',
    name: '',
    email: '',
    phone: '',
    position: '',
    department: '',
    salary: '',
    status: 'active' as 'active' | 'inactive' | 'terminated',
    username: '',
    password: '',
    role: 'employee' as 'employee' | 'manager'
  });

  // Load employee permissions
  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const permissions = await db.getAllEmployeePermissions();
        const permissionsMap = permissions.reduce((acc, perm) => {
          acc[perm.employeeId] = perm;
          return acc;
        }, {} as Record<string, any>);
        setEmployeePermissions(permissionsMap);
      } catch (error) {
        console.error('Error loading permissions:', error);
      }
    };
    
    if (isAdmin) {
      loadPermissions();
    }
  }, [isAdmin]);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const resetForm = () => {
    setFormData({
      employeeId: '',
      name: '',
      email: '',
      phone: '',
      position: '',
      department: '',
      salary: '',
      status: 'active',
      username: '',
      password: '',
      role: 'employee'
    });
    setEditingEmployee(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const employeeData = {
        ...formData,
        employeeId: formData.employeeId || `EMP${Date.now()}`,
        salary: parseFloat(formData.salary) || 0,
        joinDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      if (editingEmployee) {
        await updateEmployee({ ...editingEmployee, ...employeeData });
        showMessage('Employee updated successfully!', 'success');
      } else {
        await createEmployee(employeeData);
        showMessage('Employee created successfully!', 'success');
      }

      resetForm();
      setShowForm(false);
    } catch (error) {
      console.error('Error saving employee:', error);
      showMessage('Error saving employee. Please try again.', 'error');
    }
  };

  const handleEdit = (employee: any) => {
    setFormData({
      employeeId: employee.employeeId,
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      position: employee.position,
      department: employee.department,
      salary: employee.salary.toString(),
      status: employee.status,
      username: employee.username,
      password: employee.password,
      role: employee.role
    });
    setEditingEmployee(employee);
    setShowForm(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete employee "${name}"?`)) {
      try {
        await deleteEmployee(id);
        showMessage('Employee deleted successfully!', 'success');
      } catch (error) {
        console.error('Error deleting employee:', error);
        showMessage('Error deleting employee', 'error');
      }
    }
  };

  const handlePermissionsUpdate = async (employeeId: string, permissions: any) => {
    try {
      await db.updateEmployeePermissions(employeeId, permissions);
      setEmployeePermissions(prev => ({
        ...prev,
        [employeeId]: permissions
      }));
      showMessage('Employee permissions updated successfully!', 'success');
    } catch (error) {
      console.error('Error updating permissions:', error);
      showMessage('Error updating permissions', 'error');
    }
  };

  const openPermissionsModal = (employee: any) => {
    setSelectedEmployeeForPermissions(employee);
    setShowPermissionsModal(true);
  };

  // Filter employees
  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = !searchTerm ||
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.department.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = !filterStatus || employee.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  // Get today's attendance
  const todayAttendance = attendance.filter(att => isToday(new Date(att.date)));

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
      case 'half-day': return <Clock className="w-4 h-4 text-orange-500" />;
      case 'leave': return <Calendar className="w-4 h-4 text-blue-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
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
            <Users className="w-7 h-7 text-blue-600" />
            Employee Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage employees and track attendance • {employees.length} employees
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-300 hover:scale-105"
          >
            <Plus size={20} />
            Add Employee
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('employees')}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'employees'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Employees</span>
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'attendance'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Attendance</span>
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('permissions')}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'permissions'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Permissions</span>
              </button>
            )}
          </nav>
        </div>

        <div className="p-6">
          {/* Employees Tab */}
          {activeTab === 'employees' && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 hover-lift">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total Employees</p>
                      <p className="text-2xl font-bold text-blue-600">{employees.length}</p>
                    </div>
                    <Users className="w-8 h-8 text-blue-500" />
                  </div>
                </div>
                
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 hover-lift">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Active</p>
                      <p className="text-2xl font-bold text-green-600">
                        {employees.filter(e => e.status === 'active').length}
                      </p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 hover-lift">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Present Today</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {todayAttendance.filter(a => a.status === 'present').length}
                      </p>
                    </div>
                    <Clock className="w-8 h-8 text-purple-500" />
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 hover-lift">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Departments</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {new Set(employees.map(e => e.department)).size}
                      </p>
                    </div>
                    <Building className="w-8 h-8 text-orange-500" />
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search employees..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="terminated">Terminated</option>
                  </select>

                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Filter className="w-4 h-4 mr-2" />
                    Showing {filteredEmployees.length} of {employees.length} employees
                  </div>
                </div>
              </div>

              {/* Employees Table */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Employee
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Contact
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Position
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Salary
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Permissions
                        </th>
                        {isAdmin && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredEmployees.map((employee) => (
                        <tr key={employee.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                                <User className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900 dark:text-white">{employee.name}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">ID: {employee.employeeId}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              <p className="text-gray-900 dark:text-white flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {employee.email}
                              </p>
                              <p className="text-gray-600 dark:text-gray-400 flex items-center gap-1 mt-1">
                                <Phone className="w-3 h-3" />
                                {employee.phone || 'N/A'}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              <p className="font-medium text-gray-900 dark:text-white">{employee.position}</p>
                              <p className="text-gray-600 dark:text-gray-400">{employee.department}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-green-600 dark:text-green-400">
                            PKR {employee.salary.toLocaleString('en-PK')}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              employee.status === 'active' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                              employee.status === 'inactive' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' :
                              'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                            }`}>
                              {employee.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => openPermissionsModal(employee)}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium transition-colors"
                            >
                              Configure
                            </button>
                          </td>
                          {isAdmin && (
                            <td className="px-6 py-4 text-sm font-medium">
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleEdit(employee)}
                                  className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 transition-colors duration-200"
                                  title="Edit Employee"
                                >
                                  <Edit size={16} />
                                </button>
                                <button
                                  onClick={() => handleDelete(employee.id, employee.name)}
                                  className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors duration-200"
                                  title="Delete Employee"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredEmployees.length === 0 && (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No employees found</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      {employees.length === 0
                        ? "Add your first employee to get started"
                        : "Try adjusting your search or filter criteria"
                      }
                    </p>
                    {isAdmin && (
                      <button
                        onClick={() => setShowForm(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Plus size={20} />
                        Add Employee
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Attendance Tab */}
          {activeTab === 'attendance' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Employee Attendance Today ({todayAttendance.filter(a => a.status === 'present').length}/{employees.length})
                </h3>
              </div>

              {/* Attendance Table */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Employee
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
                          Hours Worked
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Notes
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {employees.map((employee) => {
                        const empAttendance = todayAttendance.find(att => att.employeeId === employee.id);
                        const workingHours = empAttendance?.checkIn && empAttendance?.checkOut 
                          ? ((new Date(empAttendance.checkOut).getTime() - new Date(empAttendance.checkIn).getTime()) / (1000 * 60 * 60)).toFixed(1)
                          : empAttendance?.checkIn && !empAttendance?.checkOut
                          ? 'Working...'
                          : '-';
                        
                        return (
                          <tr key={employee.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                                  <User className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900 dark:text-white">{employee.name}</p>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">{employee.position} • {employee.department}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {empAttendance ? (
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(empAttendance.status)}
                                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(empAttendance.status)}`}>
                                    {empAttendance.status.charAt(0).toUpperCase() + empAttendance.status.slice(1).replace('_', ' ')}
                                  </span>
                                </div>
                              ) : (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Not Marked
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                              {empAttendance?.checkIn ? format(new Date(empAttendance.checkIn), 'hh:mm a') : '-'}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                              {empAttendance?.checkOut ? format(new Date(empAttendance.checkOut), 'hh:mm a') : empAttendance?.checkIn ? 'Working...' : '-'}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                              {workingHours}h
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                              {empAttendance?.notes || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {employees.length === 0 && (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No employees added yet</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      Add your first employee to start tracking attendance
                    </p>
                    {isAdmin && (
                      <button
                        onClick={() => setShowForm(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Plus size={20} />
                        Add First Employee
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Permissions Tab */}
          {activeTab === 'permissions' && isAdmin && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Employee Permissions & Controls
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Control what employees can access and their working hours
                </p>
              </div>

              {/* Permissions Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {employees.filter(emp => emp.status === 'active').map((employee) => {
                  const permissions = employeePermissions[employee.id] || {
                    canViewClientCredentials: false,
                    requiresApprovalForCredentials: true,
                    canViewAllClients: true,
                    canCreateReceipts: true,
                    canViewReports: false,
                    workingHours: { start: '09:00', end: '17:00' },
                    lateThresholdMinutes: 15,
                    requiresReasonForLate: true
                  };
                  
                  return (
                    <div key={employee.id} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white">{employee.name}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{employee.position}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => openPermissionsModal(employee)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
                        >
                          Configure
                        </button>
                      </div>
                      
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Client Credentials</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            permissions.canViewClientCredentials 
                              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                              : permissions.requiresApprovalForCredentials
                              ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                              : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                          }`}>
                            {permissions.canViewClientCredentials ? 'Allowed' : 
                             permissions.requiresApprovalForCredentials ? 'Request Only' : 'Denied'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Working Hours</span>
                          <span className="text-gray-900 dark:text-white font-medium">
                            {permissions.workingHours?.start || '09:00'} - {permissions.workingHours?.end || '17:00'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Late Threshold</span>
                          <span className="text-gray-900 dark:text-white font-medium">
                            {permissions.lateThresholdMinutes || 15} minutes
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {employees.filter(emp => emp.status === 'active').length === 0 && (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-700 rounded-xl">
                  <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No active employees</h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Add active employees to configure their permissions
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Employee Form Modal */}
      {showForm && isAdmin && (
        <div className="form-modal">
          <div className="form-container animate-slideInRight">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
            </h2>
            
            <div className="max-h-[60vh] overflow-y-auto">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Employee ID
                    </label>
                    <input
                      type="text"
                      value={formData.employeeId}
                      onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                      placeholder="Auto-generated if empty"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter full name"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Enter email address"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="Enter phone number"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Position *
                    </label>
                    <input
                      type="text"
                      value={formData.position}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                      placeholder="e.g. Tax Consultant"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Department *
                    </label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      placeholder="e.g. Tax Services"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Monthly Salary
                    </label>
                    <input
                      type="text"
                      value={formData.salary}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^\d]/g, '');
                        setFormData({ ...formData, salary: value ? parseInt(value).toLocaleString() : '' });
                      }}
                      placeholder="Enter monthly salary"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="terminated">Terminated</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Username *
                    </label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="Login username"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Password *
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Login password"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
              </form>
            </div>

            <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingEmployee ? 'Update Employee' : 'Create Employee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Employee Permissions Modal */}
      {showPermissionsModal && selectedEmployeeForPermissions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Employee Permissions: {selectedEmployeeForPermissions.name}
              </h2>
              <button
                onClick={() => {
                  setShowPermissionsModal(false);
                  setSelectedEmployeeForPermissions(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X size={24} />
              </button>
            </div>

            <EmployeePermissionsForm
              employee={selectedEmployeeForPermissions}
              currentPermissions={employeePermissions[selectedEmployeeForPermissions.id]}
              onSave={(permissions) => {
                handlePermissionsUpdate(selectedEmployeeForPermissions.id, permissions);
                setShowPermissionsModal(false);
                setSelectedEmployeeForPermissions(null);
              }}
              onCancel={() => {
                setShowPermissionsModal(false);
                setSelectedEmployeeForPermissions(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Employee Permissions Form Component
const EmployeePermissionsForm: React.FC<{
  employee: any;
  currentPermissions: any;
  onSave: (permissions: any) => void;
  onCancel: () => void;
}> = ({ employee, currentPermissions, onSave, onCancel }) => {
  const [permissions, setPermissions] = useState({
    canViewClientCredentials: false,
    requiresApprovalForCredentials: true,
    canViewAllClients: true,
    canCreateReceipts: true,
    canEditReceipts: false,
    canDeleteReceipts: false,
    canViewReports: false,
    canViewExpenses: false,
    canCreateExpenses: false,
    workingHours: { start: '09:00', end: '17:00' },
    lateThresholdMinutes: 15,
    requiresReasonForLate: true,
    canViewOtherEmployees: false,
    canViewAttendanceReports: false,
    ...currentPermissions
  });

  const handleSave = () => {
    onSave(permissions);
  };

  const PermissionToggle: React.FC<{
    label: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    icon?: React.ElementType;
  }> = ({ label, description, checked, onChange, icon: Icon }) => (
    <div className="flex items-start justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
      <div className="flex items-start gap-3">
        {Icon && <Icon className="w-5 h-5 text-blue-600 mt-0.5" />}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-white">{label}</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
        </div>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
      </label>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Client Access Permissions */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Client Access Permissions
        </h3>
        <div className="space-y-4">
          <PermissionToggle
            label="View Client Credentials"
            description="Allow direct access to client passwords and sensitive information"
            checked={permissions.canViewClientCredentials}
            onChange={(checked) => setPermissions(prev => ({ ...prev, canViewClientCredentials: checked }))}
            icon={Eye}
          />
          
          <PermissionToggle
            label="Require Approval for Credentials"
            description="Employee must request approval before accessing client credentials"
            checked={permissions.requiresApprovalForCredentials}
            onChange={(checked) => setPermissions(prev => ({ ...prev, requiresApprovalForCredentials: checked }))}
            icon={Shield}
          />
          
          <PermissionToggle
            label="View All Clients"
            description="Access to view all client profiles and information"
            checked={permissions.canViewAllClients}
            onChange={(checked) => setPermissions(prev => ({ ...prev, canViewAllClients: checked }))}
            icon={Users}
          />
        </div>
      </div>

      {/* Receipt Permissions */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Receipt className="w-5 h-5" />
          Receipt Management
        </h3>
        <div className="space-y-4">
          <PermissionToggle
            label="Create Receipts"
            description="Allow creating new receipts for clients"
            checked={permissions.canCreateReceipts}
            onChange={(checked) => setPermissions(prev => ({ ...prev, canCreateReceipts: checked }))}
            icon={Plus}
          />
          
          <PermissionToggle
            label="Edit Receipts"
            description="Allow editing existing receipts"
            checked={permissions.canEditReceipts}
            onChange={(checked) => setPermissions(prev => ({ ...prev, canEditReceipts: checked }))}
            icon={Edit}
          />
          
          <PermissionToggle
            label="Delete Receipts"
            description="Allow deleting receipts (high-risk permission)"
            checked={permissions.canDeleteReceipts}
            onChange={(checked) => setPermissions(prev => ({ ...prev, canDeleteReceipts: checked }))}
            icon={Trash2}
          />
        </div>
      </div>

      {/* Working Hours & Attendance */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Working Hours & Attendance
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start Time
              </label>
              <input
                type="time"
                value={permissions.workingHours?.start || '09:00'}
                onChange={(e) => setPermissions(prev => ({
                  ...prev,
                  workingHours: { ...prev.workingHours, start: e.target.value }
                }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                End Time
              </label>
              <input
                type="time"
                value={permissions.workingHours?.end || '17:00'}
                onChange={(e) => setPermissions(prev => ({
                  ...prev,
                  workingHours: { ...prev.workingHours, end: e.target.value }
                }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Late Threshold (minutes)
            </label>
            <input
              type="number"
              value={permissions.lateThresholdMinutes || 15}
              onChange={(e) => setPermissions(prev => ({ ...prev, lateThresholdMinutes: parseInt(e.target.value) || 15 }))}
              min="1"
              max="60"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Employee will be marked as late if they check in after this many minutes
            </p>
          </div>
          
          <PermissionToggle
            label="Require Reason for Late Arrival"
            description="Employee must provide a reason when checking in late"
            checked={permissions.requiresReasonForLate}
            onChange={(checked) => setPermissions(prev => ({ ...prev, requiresReasonForLate: checked }))}
            icon={AlertCircle}
          />
        </div>
      </div>

      {/* System Access */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          System Access
        </h3>
        <div className="space-y-4">
          <PermissionToggle
            label="View Reports"
            description="Access to financial reports and analytics"
            checked={permissions.canViewReports}
            onChange={(checked) => setPermissions(prev => ({ ...prev, canViewReports: checked }))}
            icon={BarChart3}
          />
          
          <PermissionToggle
            label="View Expenses"
            description="Access to view company expenses"
            checked={permissions.canViewExpenses}
            onChange={(checked) => setPermissions(prev => ({ ...prev, canViewExpenses: checked }))}
            icon={Eye}
          />
          
          <PermissionToggle
            label="Create Expenses"
            description="Allow creating new expense entries"
            checked={permissions.canCreateExpenses}
            onChange={(checked) => setPermissions(prev => ({ ...prev, canCreateExpenses: checked }))}
            icon={Plus}
          />
          
          <PermissionToggle
            label="View Other Employees"
            description="Access to view other employee information"
            checked={permissions.canViewOtherEmployees}
            onChange={(checked) => setPermissions(prev => ({ ...prev, canViewOtherEmployees: checked }))}
            icon={Users}
          />
          
          <PermissionToggle
            label="View Attendance Reports"
            description="Access to attendance reports and analytics"
            checked={permissions.canViewAttendanceReports}
            onChange={(checked) => setPermissions(prev => ({ ...prev, canViewAttendanceReports: checked }))}
            icon={Calendar}
          />
        </div>
      </div>
      {/* Action Buttons */}
      <div className="flex gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onCancel}
          className="flex-1 px-6 py-3 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors font-medium"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Save Permissions
        </button>
      </div>
    </div>
  );
};

export default EmployeeManagement;