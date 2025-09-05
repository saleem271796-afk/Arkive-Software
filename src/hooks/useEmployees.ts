// src/hooks/useEmployees.ts
import { useState, useEffect } from 'react';
import { db } from '../services/database';
import { firebaseSync } from '../services/firebaseSync';
import { Employee } from '../types';
import { initializeFirebaseAuth } from '../firebase';

export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEmployees = async () => {
    try {
      const data = await db.getAllEmployees();
      setEmployees(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
    
    // Initialize Firebase auth first
    initializeFirebaseAuth().catch(console.warn);
    
    // Setup realtime listener
    try {
      firebaseSync.setupRealtimeListener('employees', (remoteData: Employee[]) => {
        try {
          if (Array.isArray(remoteData)) {
            setEmployees(prevEmployees => {
              const employeeMap = new Map<string, Employee>();
              
              // Add existing employees
              prevEmployees.forEach(employee => {
                if (employee && employee.id) {
                  employeeMap.set(employee.id, employee);
                }
              });
              
              // Merge remote data (Firebase data takes precedence)
              remoteData.forEach(remoteEmployee => {
                if (remoteEmployee && remoteEmployee.id) {
                  try {
                    const processedEmployee = {
                      ...remoteEmployee,
                      createdAt: remoteEmployee.createdAt instanceof Date ? remoteEmployee.createdAt : 
                        (() => {
                          const date = new Date(remoteEmployee.createdAt);
                          return isNaN(date.getTime()) ? new Date() : date;
                        })(),
                      updatedAt: remoteEmployee.updatedAt instanceof Date ? remoteEmployee.updatedAt : 
                        (() => {
                          const date = new Date(remoteEmployee.updatedAt);
                          return isNaN(date.getTime()) ? new Date() : date;
                        })(),
                      joinDate: remoteEmployee.joinDate instanceof Date ? remoteEmployee.joinDate : 
                        (() => {
                          const date = new Date(remoteEmployee.joinDate);
                          return isNaN(date.getTime()) ? new Date() : date;
                        })()
                    };
                    employeeMap.set(remoteEmployee.id, processedEmployee);
                  } catch (dateError) {
                    console.warn('Error processing employee dates:', dateError);
                    employeeMap.set(remoteEmployee.id, remoteEmployee);
                  }
                }
              });
              
              return Array.from(employeeMap.values()).sort((a, b) => 
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
              );
            });
            console.log(`✅ Employees updated from Firebase: ${remoteData.length} items`);
          } else {
            console.warn('⚠️ Invalid employees data from Firebase:', remoteData);
          }
        } catch (error) {
          console.error('Error processing employees realtime data:', error);
        }
      });
    } catch (error) {
      console.error('Failed to setup employees realtime listener:', error);
    }

    return () => {
      try {
        firebaseSync.removeRealtimeListener('employees');
      } catch (error) {
        console.warn('Error removing employees listener:', error);
      }
    };
  }, []);
  const createEmployee = async (e: Omit<Employee, 'id'>) => {
    try {
      const created = await db.createEmployee(e);
      setEmployees(prev => [created, ...prev]);
      return created;
    } catch (error) {
      console.error('Error creating employee:', error);
      throw error;
    }
  };

  const updateEmployee = async (e: Employee) => {
    try {
      await db.updateEmployee(e);
      setEmployees(prev => prev.map(p => p.id === e.id ? e : p));
    } catch (error) {
      console.error('Error updating employee:', error);
      throw error;
    }
  };

  const deleteEmployee = async (id: string) => {
    try {
      await db.deleteEmployee(id);
      setEmployees(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting employee:', error);
      throw error;
    }
  };

  return { employees, loading, createEmployee, updateEmployee, deleteEmployee, refetch: fetchEmployees };
}