import { useState, useEffect } from 'react';
import { db } from '../services/database';
import { firebaseSync } from '../services/firebaseSync';
import { Client, Receipt, Expense, Activity, Notification, Document, ClientAccessRequest } from '../types';
import { useEmployees } from './useEmployees';
import { useAttendance } from './useAttendance';
import { useTasks } from './useTasks';
import { initializeFirebaseAuth } from '../firebase';

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClients = async () => {
    try {
      const data = await db.getAllClients();
      setClients(data);
    } catch (error) {
      console.error('Error fetching clients:', error);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
    
    // Initialize Firebase auth first
    initializeFirebaseAuth().catch(console.warn);
    
    // Setup realtime listener with error handling
    try {
      firebaseSync.setupRealtimeListener('clients', (remoteData: Client[]) => {
        try {
          if (Array.isArray(remoteData)) {
            setClients(prevClients => {
              const clientMap = new Map<string, Client>();
              
              // Add existing clients
              prevClients.forEach(client => {
                if (client && client.id) {
                  clientMap.set(client.id, client);
                }
              });
              
              // Merge remote data (Firebase data takes precedence)
              remoteData.forEach(remoteClient => {
                if (remoteClient && remoteClient.id) {
                  try {
                    const processedClient = {
                      ...remoteClient,
                      createdAt: remoteClient.createdAt instanceof Date ? remoteClient.createdAt : 
                        (() => {
                          const date = new Date(remoteClient.createdAt);
                          return isNaN(date.getTime()) ? new Date() : date;
                        })(),
                      updatedAt: remoteClient.updatedAt instanceof Date ? remoteClient.updatedAt : 
                        (() => {
                          const date = new Date(remoteClient.updatedAt);
                          return isNaN(date.getTime()) ? new Date() : date;
                        })(),
                      lastModified: remoteClient.lastModified instanceof Date ? remoteClient.lastModified : 
                        (() => {
                          const date = new Date(remoteClient.lastModified || remoteClient.updatedAt);
                          return isNaN(date.getTime()) ? new Date() : date;
                        })()
                    };
                    clientMap.set(remoteClient.id, processedClient);
                  } catch (dateError) {
                    console.warn('Error processing client dates:', dateError);
                    clientMap.set(remoteClient.id, remoteClient);
                  }
                }
              });
              
              return Array.from(clientMap.values()).sort((a, b) => 
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
              );
            });
            console.log(`✅ Clients updated from Firebase: ${remoteData.length} items`);
          } else {
            console.warn('⚠️ Invalid clients data from Firebase:', remoteData);
          }
        } catch (error) {
          console.error('Error processing clients realtime data:', error);
        }
      });
    } catch (error) {
      console.error('Failed to setup clients realtime listener:', error);
    }

    return () => {
      try {
        firebaseSync.removeRealtimeListener('clients');
      } catch (error) {
        console.warn('Error removing clients listener:', error);
      }
    };
  }, []);

  const createClient = async (client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newClient = await db.createClient(client);
      setClients(prev => [newClient, ...prev]);
      return newClient;
    } catch (error) {
      console.error('Error creating client:', error);
      throw error;
    }
  };

  const updateClient = async (client: Client) => {
    try {
      await db.updateClient(client);
      setClients(prev => prev.map(c => c.id === client.id ? client : c));
    } catch (error) {
      console.error('Error updating client:', error);
      throw error;
    }
  };

  const deleteClient = async (id: string) => {
    try {
      await db.deleteClient(id);
      setClients(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Error deleting client:', error);
      throw error;
    }
  };

  return { clients, loading, createClient, updateClient, deleteClient, refetch: fetchClients };
}

export function useReceipts() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReceipts = async () => {
    try {
      const data = await db.getAllReceipts();
      setReceipts(data);
    } catch (error) {
      console.error('Error fetching receipts:', error);
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
    
    // Initialize Firebase auth first
    initializeFirebaseAuth().catch(console.warn);
    
    // Setup realtime listener
    firebaseSync.setupRealtimeListener('receipts', (remoteData: Receipt[]) => {
      if (Array.isArray(remoteData)) { // Ensure it's an array
        setReceipts(prevReceipts => {
          // Create a map to merge data properly
          const receiptMap = new Map<string, Receipt>();
          
          // Add existing receipts
          prevReceipts.forEach(receipt => {
            if (receipt && receipt.id) {
              receiptMap.set(receipt.id, receipt);
            }
          });
          
          // Merge remote data (Firebase data takes precedence)
          remoteData.forEach(remoteReceipt => {
            if (remoteReceipt && remoteReceipt.id) {
              // Convert date strings to Date objects
              const processedReceipt = {
                ...remoteReceipt,
                date: remoteReceipt.date instanceof Date ? remoteReceipt.date : 
                  (() => {
                    const date = new Date(remoteReceipt.date);
                    return isNaN(date.getTime()) ? new Date() : date;
                  })(),
                createdAt: remoteReceipt.createdAt instanceof Date ? remoteReceipt.createdAt : 
                  (() => {
                    const date = new Date(remoteReceipt.createdAt);
                    return isNaN(date.getTime()) ? new Date() : date;
                  })(),
                lastModified: remoteReceipt.lastModified instanceof Date ? remoteReceipt.lastModified : 
                  (() => {
                    const date = new Date(remoteReceipt.lastModified || remoteReceipt.createdAt);
                    return isNaN(date.getTime()) ? new Date() : date;
                  })()
              };
              receiptMap.set(remoteReceipt.id, processedReceipt);
            }
          });
          
          return Array.from(receiptMap.values()).sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });
        console.log(`✅ Receipts updated from Firebase: ${remoteData.length} items`);
      } else {
        console.warn('⚠️ Invalid receipts data from Firebase:', remoteData);
      }
    });

    return () => {
      firebaseSync.removeRealtimeListener('receipts');
    };
  }, []);

  const createReceipt = async (receipt: Omit<Receipt, 'id' | 'createdAt'>) => {
    try {
      const newReceipt = await db.createReceipt(receipt);
      setReceipts(prev => [newReceipt, ...prev]);
      return newReceipt;
    } catch (error) {
      console.error('Error creating receipt:', error);
      throw error;
    }
  };

  const getReceiptsByClient = async (clientCnic: string) => {
    try {
      return await db.getReceiptsByClient(clientCnic);
    } catch (error) {
      console.error('Error fetching client receipts:', error);
      return [];
    }
  };

  const deleteReceipt = async (id: string) => {
    try {
      await db.deleteReceipt(id);
      setReceipts(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      console.error('Error deleting receipt:', error);
      throw error;
    }
  };

  return { receipts, loading, createReceipt, getReceiptsByClient, deleteReceipt, refetch: fetchReceipts };
}

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExpenses = async () => {
    try {
      const data = await db.getAllExpenses();
      setExpenses(data);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
    
    // Initialize Firebase auth first
    initializeFirebaseAuth().catch(console.warn);
    
    // Setup realtime listener
    firebaseSync.setupRealtimeListener('expenses', (remoteData: Expense[]) => {
      if (remoteData.length >= 0) { // Allow empty arrays
        setExpenses(prevExpenses => {
          const expenseMap = new Map(prevExpenses.map(e => [e.id, e]));
          
          // Merge remote data (Firebase takes precedence)
          remoteData.forEach(remoteExpense => {
            expenseMap.set(remoteExpense.id, remoteExpense);
          });
          
          return Array.from(expenseMap.values()).sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });
        console.log(`✅ Expenses updated from Firebase: ${remoteData.length} items`);
      }
    });

    return () => {
      firebaseSync.removeRealtimeListener('expenses');
    };
  }, []);

  const createExpense = async (expense: Omit<Expense, 'id' | 'createdAt'>) => {
    try {
      const newExpense = await db.createExpense(expense);
      setExpenses(prev => [newExpense, ...prev]);
      return newExpense;
    } catch (error) {
      console.error('Error creating expense:', error);
      throw error;
    }
  };

  return { expenses, loading, createExpense, refetch: fetchExpenses };
}

export function useActivities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = async () => {
    try {
      const data = await db.getAllActivities();
      setActivities(data.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  return { activities, loading, refetch: fetchActivities };
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const data = await db.getAllNotifications();
      setNotifications(data.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    
    // Initialize Firebase auth first
    initializeFirebaseAuth().catch(console.warn);
    
    // Setup realtime listener
    firebaseSync.setupRealtimeListener('notifications', (remoteData: Notification[]) => {
      if (remoteData.length >= 0) { // Allow empty arrays
        setNotifications(prevNotifications => {
          const notificationMap = new Map(prevNotifications.map(n => [n.id, n]));
          
          // Merge remote data (Firebase takes precedence)
          remoteData.forEach(remoteNotification => {
            notificationMap.set(remoteNotification.id, remoteNotification);
          });
          
          return Array.from(notificationMap.values()).sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        });
        console.log(`✅ Notifications updated from Firebase: ${remoteData.length} items`);
      }
    });

    return () => {
      firebaseSync.removeRealtimeListener('notifications');
    };
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await db.markNotificationAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await db.markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  };

  return { notifications, loading, markAsRead, markAllAsRead, refetch: fetchNotifications };
}

export function useDocuments() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = async () => {
    try {
      const data = await db.getAllDocuments();
      setDocuments(data.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()));
    } catch (error) {
      console.error('Error fetching documents:', error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    
    // Initialize Firebase auth first
    initializeFirebaseAuth().catch(console.warn);
    
    // Setup realtime listener
    firebaseSync.setupRealtimeListener('documents', (remoteData: Document[]) => {
      if (remoteData.length >= 0) { // Allow empty arrays
        setDocuments(prevDocuments => {
          const documentMap = new Map(prevDocuments.map(d => [d.id, d]));
          
          // Merge remote data (Firebase takes precedence)
          remoteData.forEach(remoteDocument => {
            documentMap.set(remoteDocument.id, remoteDocument);
          });
          
          return Array.from(documentMap.values()).sort((a, b) => 
            new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
          );
        });
        console.log(`✅ Documents updated from Firebase: ${remoteData.length} items`);
      }
    });

    return () => {
      firebaseSync.removeRealtimeListener('documents');
    };
  }, []);

  const createDocument = async (document: Omit<Document, 'id' | 'uploadedAt' | 'accessLog'>) => {
    try {
      const newDocument = await db.createDocument(document);
      setDocuments(prev => [newDocument, ...prev]);
      return newDocument;
    } catch (error) {
      console.error('Error creating document:', error);
      throw error;
    }
  };

  const getDocumentsByClient = async (clientCnic: string) => {
    try {
      return await db.getDocumentsByClient(clientCnic);
    } catch (error) {
      console.error('Error fetching client documents:', error);
      return [];
    }
  };

  const deleteDocument = async (id: string) => {
    try {
      await db.deleteDocument(id);
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  };

  const logAccess = async (documentId: string, userId: string, action: 'view' | 'download') => {
    try {
      await db.logDocumentAccess(documentId, userId, action);
      fetchDocuments(); // Refresh to show updated access log
    } catch (error) {
      console.error('Error logging document access:', error);
    }
  };

  return { 
    documents, 
    loading, 
    createDocument, 
    getDocumentsByClient, 
    deleteDocument, 
    logAccess, 
    refetch: fetchDocuments 
  };
}

export function useClientAccessRequests() {
  const [requests, setRequests] = useState<ClientAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    try {
      const data = await db.getAllClientAccessRequests();
      setRequests(data.sort((a, b) => {
        const aTime = a.requestedAt instanceof Date ? a.requestedAt.getTime() : 0;
        const bTime = b.requestedAt instanceof Date ? b.requestedAt.getTime() : 0;
        return bTime - aTime;
      }));
    } catch (error) {
      console.error('Error fetching client access requests:', error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    
    // Initialize Firebase auth first
    initializeFirebaseAuth().catch(console.warn);
    
    // Setup realtime listener
    firebaseSync.setupRealtimeListener('clientAccessRequests', (remoteData: ClientAccessRequest[]) => {
      if (remoteData.length >= 0) { // Allow empty arrays
        setRequests(prevRequests => {
          const requestMap = new Map(prevRequests.map(r => [r.id, r]));
          
          // Merge remote data (Firebase takes precedence)
          remoteData.forEach(remoteRequest => {
            requestMap.set(remoteRequest.id, remoteRequest);
          });
          
          return Array.from(requestMap.values()).sort((a, b) => 
            {
              const aTime = a.requestedAt instanceof Date ? a.requestedAt.getTime() : 0;
              const bTime = b.requestedAt instanceof Date ? b.requestedAt.getTime() : 0;
              return bTime - aTime;
            }
          );
        });
        console.log(`✅ Client access requests updated from Firebase: ${remoteData.length} items`);
      }
    });

    return () => {
      firebaseSync.removeRealtimeListener('clientAccessRequests');
    };
  }, []);

  const createRequest = async (request: Omit<ClientAccessRequest, 'id' | 'requestedAt'>) => {
    try {
      const newRequest = await db.createClientAccessRequest(request);
      setRequests(prev => [newRequest, ...prev]);
      return newRequest;
    } catch (error) {
      console.error('Error creating client access request:', error);
      throw error;
    }
  };

  const updateRequest = async (request: ClientAccessRequest) => {
    try {
      await db.updateClientAccessRequest(request);
      setRequests(prev => prev.map(r => r.id === request.id ? request : r));
    } catch (error) {
      console.error('Error updating client access request:', error);
      throw error;
    }
  };

  const deleteRequest = async (id: string) => {
    try {
      await db.deleteClientAccessRequest(id);
      setRequests(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      console.error('Error deleting client access request:', error);
      throw error;
    }
  };

  const getRequestsByEmployee = async (employeeId: string) => {
    try {
      return await db.getClientAccessRequestsByEmployee(employeeId);
    } catch (error) {
      console.error('Error fetching employee access requests:', error);
      return [];
    }
  };

  return { 
    requests, 
    loading, 
    createRequest, 
    updateRequest, 
    deleteRequest, 
    getRequestsByEmployee, 
    refetch: fetchRequests 
  };
}

export function useDatabase() {
  const clients = useClients();
  const receipts = useReceipts();
  const expenses = useExpenses();
  const notifications = useNotifications();
  const documents = useDocuments();
  const employees = useEmployees();
  const attendanceHook = useAttendance();
  const tasks = useTasks();
  const clientAccessRequests = useClientAccessRequests();

  return {
    // Clients
    clients: clients.clients,
    clientsLoading: clients.loading,
    createClient: clients.createClient,
    updateClient: clients.updateClient,
    refetchClients: clients.refetch,

    // Receipts
    receipts: receipts.receipts,
    receiptsLoading: receipts.loading,
    createReceipt: receipts.createReceipt,
    getReceiptsByClient: receipts.getReceiptsByClient,
    deleteReceipt: receipts.deleteReceipt,
    refetchReceipts: receipts.refetch,

    // Expenses
    expenses: expenses.expenses,
    expensesLoading: expenses.loading,
    createExpense: expenses.createExpense,

    // Notifications
    notifications: notifications.notifications,
    notificationsLoading: notifications.loading,
    markNotificationAsRead: notifications.markAsRead,
    markAllNotificationsAsRead: notifications.markAllAsRead,
    refetchNotifications: notifications.refetch,

    // Documents
    documents: documents.documents,
    documentsLoading: documents.loading,
    createDocument: documents.createDocument,
    getDocumentsByClient: documents.getDocumentsByClient,
    deleteDocument: documents.deleteDocument,
    logDocumentAccess: documents.logAccess,
    refetchDocuments: documents.refetch,

    // Client Access Requests
    clientAccessRequests: clientAccessRequests.requests,
    clientAccessRequestsLoading: clientAccessRequests.loading,
    createClientAccessRequest: clientAccessRequests.createRequest,
    updateClientAccessRequest: clientAccessRequests.updateRequest,
    deleteClientAccessRequest: clientAccessRequests.deleteRequest,
    getClientAccessRequestsByEmployee: clientAccessRequests.getRequestsByEmployee,
    refetchClientAccessRequests: clientAccessRequests.refetch,

    // Employees
    employees: employees.employees,
    employeesLoading: employees.loading,
    createEmployee: employees.createEmployee,
    updateEmployee: employees.updateEmployee,
    deleteEmployee: employees.deleteEmployee,
    refetchEmployees: employees.refetch,

    // Attendance
    attendance: attendanceHook.attendance,
    attendanceLoading: attendanceHook.loading,
    markAttendance: attendanceHook.markAttendance,
    getEmployeeAttendance: attendanceHook.getEmployeeAttendance,
    updateAttendance: attendanceHook.updateAttendance,
    refetchAttendance: attendanceHook.refetch,

    // Tasks
    tasks: tasks.tasks,
    tasksLoading: tasks.loading,
    createTask: tasks.createTask,
    updateTask: tasks.updateTask,
    deleteTask: tasks.deleteTask,
    getTasksByEmployee: tasks.getTasksByEmployee,
    getTasksByAssigner: tasks.getTasksByAssigner,
    refetchTasks: tasks.refetch,

    // Client Access Requests
    clientAccessRequests: clientAccessRequests.requests,
    clientAccessRequestsLoading: clientAccessRequests.loading,
    createClientAccessRequest: clientAccessRequests.createRequest,
    updateClientAccessRequest: clientAccessRequests.updateRequest,
    deleteClientAccessRequest: clientAccessRequests.deleteRequest,
    getClientAccessRequestsByEmployee: clientAccessRequests.getRequestsByEmployee,
    refetchClientAccessRequests: clientAccessRequests.refetch,
  };
}