import { useState, useEffect } from 'react';
import { db } from '../services/database';
import { firebaseSync } from '../services/firebaseSync';
import { Task } from '../types';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    try {
      const data = await db.getAllTasks();
      setTasks(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    
    // Initialize Firebase auth first
    const { initializeFirebaseAuth } = require('../firebase');
    initializeFirebaseAuth().catch(console.warn);
    
    // Setup realtime listener
    try {
      firebaseSync.setupRealtimeListener('tasks', (remoteData: Task[]) => {
        try {
          if (Array.isArray(remoteData)) {
            setTasks(prevTasks => {
              const taskMap = new Map<string, Task>();
              
              // Add existing tasks
              prevTasks.forEach(task => {
                if (task && task.id) {
                  taskMap.set(task.id, task);
                }
              });
              
              // Merge remote data (Firebase data takes precedence)
              remoteData.forEach(remoteTask => {
                if (remoteTask && remoteTask.id) {
                  try {
                    const processedTask = {
                      ...remoteTask,
                      createdAt: remoteTask.createdAt instanceof Date ? remoteTask.createdAt : 
                        (() => {
                          const date = new Date(remoteTask.createdAt);
                          return isNaN(date.getTime()) ? new Date() : date;
                        })(),
                      updatedAt: remoteTask.updatedAt instanceof Date ? remoteTask.updatedAt : 
                        (() => {
                          const date = new Date(remoteTask.updatedAt);
                          return isNaN(date.getTime()) ? new Date() : date;
                        })(),
                      dueDate: remoteTask.dueDate ? (() => {
                        const date = new Date(remoteTask.dueDate);
                        return isNaN(date.getTime()) ? undefined : date;
                      })() : undefined,
                      completedAt: remoteTask.completedAt ? (() => {
                        const date = new Date(remoteTask.completedAt);
                        return isNaN(date.getTime()) ? undefined : date;
                      })() : undefined
                    };
                    taskMap.set(remoteTask.id, processedTask);
                  } catch (dateError) {
                    console.warn('Error processing task dates:', dateError);
                    taskMap.set(remoteTask.id, remoteTask);
                  }
                }
              });
              
              return Array.from(taskMap.values()).sort((a, b) => 
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              );
            });
            console.log(`✅ Tasks updated from Firebase: ${remoteData.length} items`);
          } else {
            console.warn('⚠️ Invalid tasks data from Firebase:', remoteData);
          }
        } catch (error) {
          console.error('Error processing tasks realtime data:', error);
        }
      });
    } catch (error) {
      console.error('Failed to setup tasks realtime listener:', error);
    }

    return () => {
      try {
        firebaseSync.removeRealtimeListener('tasks');
      } catch (error) {
        console.warn('Error removing tasks listener:', error);
      }
    };
  }, []);

  const createTask = async (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newTask = await db.createTask(task);
      setTasks(prev => [newTask, ...prev]);
      return newTask;
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  };

  const updateTask = async (task: Task) => {
    try {
      await db.updateTask(task);
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await db.deleteTask(id);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  };

  const getTasksByEmployee = async (employeeId: string) => {
    try {
      return await db.getTasksByEmployee(employeeId);
    } catch (error) {
      console.error('Error fetching employee tasks:', error);
      return [];
    }
  };

  const getTasksByAssigner = async (assignerId: string) => {
    try {
      return await db.getTasksByAssigner(assignerId);
    } catch (error) {
      console.error('Error fetching assigned tasks:', error);
      return [];
    }
  };

  return { 
    tasks, 
    loading, 
    createTask, 
    updateTask, 
    deleteTask, 
    getTasksByEmployee, 
    getTasksByAssigner,
    refetch: fetchTasks 
  };
}