// src/hooks/useAttendance.ts
import { useState, useEffect } from 'react';
import { db } from '../services/database';
import { firebaseSync } from '../services/firebaseSync';
import { Attendance } from '../types';
import { initializeFirebaseAuth } from '../firebase';

export function useAttendance() {
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    try {
      const data = await db.getAllAttendance();
      setAttendance(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
    
    // Initialize Firebase auth first
    initializeFirebaseAuth().catch(console.warn);
    
    // Setup realtime listener
    try {
      firebaseSync.setupRealtimeListener('attendance', (remoteData: Attendance[]) => {
        try {
          if (Array.isArray(remoteData)) {
            setAttendance(prevAttendance => {
              const attendanceMap = new Map<string, Attendance>();
              
              // Add existing attendance
              prevAttendance.forEach(record => {
                if (record && record.id) {
                  attendanceMap.set(record.id, record);
                }
              });
              
              // Merge remote data (Firebase data takes precedence)
              remoteData.forEach(remoteRecord => {
                if (remoteRecord && remoteRecord.id) {
                  try {
                    const processedRecord = {
                      ...remoteRecord,
                      date: remoteRecord.date instanceof Date ? remoteRecord.date : 
                        (() => {
                          const date = new Date(remoteRecord.date);
                          return isNaN(date.getTime()) ? new Date() : date;
                        })(),
                      checkIn: remoteRecord.checkIn ? (() => {
                        const date = new Date(remoteRecord.checkIn);
                        return isNaN(date.getTime()) ? undefined : date;
                      })() : undefined,
                      checkOut: remoteRecord.checkOut ? (() => {
                        const date = new Date(remoteRecord.checkOut);
                        return isNaN(date.getTime()) ? undefined : date;
                      })() : undefined,
                      createdAt: remoteRecord.createdAt instanceof Date ? remoteRecord.createdAt : 
                        (() => {
                          const date = new Date(remoteRecord.createdAt);
                          return isNaN(date.getTime()) ? new Date() : date;
                        })()
                    };
                    attendanceMap.set(remoteRecord.id, processedRecord);
                  } catch (dateError) {
                    console.warn('Error processing attendance dates:', dateError);
                    attendanceMap.set(remoteRecord.id, remoteRecord);
                  }
                }
              });
              
              return Array.from(attendanceMap.values()).sort((a, b) => 
                new Date(b.date).getTime() - new Date(a.date).getTime()
              );
            });
            console.log(`✅ Attendance updated from Firebase: ${remoteData.length} items`);
          } else {
            console.warn('⚠️ Invalid attendance data from Firebase:', remoteData);
          }
        } catch (error) {
          console.error('Error processing attendance realtime data:', error);
        }
      });
    } catch (error) {
      console.error('Failed to setup attendance realtime listener:', error);
    }

    return () => {
      try {
        firebaseSync.removeRealtimeListener('attendance');
      } catch (error) {
        console.warn('Error removing attendance listener:', error);
      }
    };
  }, []);
  const markAttendance = async (record: Omit<Attendance, 'id'>) => {
    try {
      const created = await db.markAttendance(record);
      setAttendance(prev => [created, ...prev]);
      return created;
    } catch (error) {
      console.error('Error marking attendance:', error);
      throw error;
    }
  };

  const getEmployeeAttendance = async (empId: string) =>
    {
      try {
        return await db.getAttendanceByEmployee(empId);
      } catch (error) {
        console.error('Error fetching employee attendance:', error);
        return [];
      }
    };

  const updateAttendance = async (record: Attendance) => {
    try {
      await db.updateAttendance(record);
      setAttendance(prev => prev.map(a => a.id === record.id ? record : a));
    } catch (error) {
      console.error('Error updating attendance:', error);
      throw error;
    }
  };

  return {
    attendance,
    loading,
    markAttendance,
    getEmployeeAttendance,
    updateAttendance,
    refetch: fetch,
  };
}