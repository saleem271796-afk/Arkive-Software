import { User, Client, Receipt, Expense, Activity, Notification, Document, Employee, Attendance, EmployeePermissions } from '../types';
import { firebaseSync } from './firebaseSync';

class DatabaseService {
  private dbName = 'arkive-database';
  private dbVersion = 15;
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private syncEnabled = true;

  constructor() {
    this.initPromise = this.init();
    
    // Enable auto-sync when online
    window.addEventListener('online', () => {
      if (this.syncEnabled) {
        this.performAutoSync();
      }
    });
  }

  private async performAutoSync(): Promise<void> {
    try {
      // Ensure Firebase auth is initialized
      const { initializeFirebaseAuth } = await import('../firebase');
      await initializeFirebaseAuth();
      
      const isConnected = await firebaseSync.checkConnection();
      if (isConnected) {
        await firebaseSync.performFullSync();
      }
    } catch (error) {
      console.warn('Auto-sync failed:', error);
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      try {
        await this.initPromise;
      } catch (error) {
        console.error('Database initialization failed:', error);
        // Retry initialization
        this.initPromise = this.init();
        await this.initPromise;
      }
    }
  }

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      
      request.onupgradeneeded = (event) => {
        const db = request.result;

        try {
          const storeNames = ['users', 'clients', 'receipts', 'expenses', 'activities', 'notifications', 'documents', 'employees', 'attendance', 'tasks', 'clientAccessRequests', 'clientTasks', 'employeePermissions'];

          storeNames.forEach((store) => {
            if (!db.objectStoreNames.contains(store)) {
              switch (store) {
                case 'users':
                  const userStore = db.createObjectStore('users', { keyPath: 'id' });
                  userStore.createIndex('username', 'username', { unique: true });
                  break;
                case 'clients':
                  const clientStore = db.createObjectStore('clients', { keyPath: 'id' });
                  clientStore.createIndex('cnic', 'cnic', { unique: true });
                  clientStore.createIndex('name', 'name');
                  break;
                case 'receipts':
                  const receiptStore = db.createObjectStore('receipts', { keyPath: 'id' });
                  receiptStore.createIndex('clientCnic', 'clientCnic');
                  receiptStore.createIndex('date', 'date');
                  receiptStore.createIndex('createdAt', 'createdAt');
                  break;
                case 'expenses':
                  const expenseStore = db.createObjectStore('expenses', { keyPath: 'id' });
                  expenseStore.createIndex('date', 'date');
                  expenseStore.createIndex('category', 'category');
                  break;
                case 'activities':
                  const activityStore = db.createObjectStore('activities', { keyPath: 'id' });
                  activityStore.createIndex('userId', 'userId');
                  activityStore.createIndex('timestamp', 'timestamp');
                  break;
                case 'notifications':
                  const notificationStore = db.createObjectStore('notifications', { keyPath: 'id' });
                  notificationStore.createIndex('createdAt', 'createdAt');
                  notificationStore.createIndex('read', 'read');
                  break;
                case 'documents':
                  const documentStore = db.createObjectStore('documents', { keyPath: 'id' });
                  documentStore.createIndex('clientCnic', 'clientCnic');
                  documentStore.createIndex('fileType', 'fileType');
                  break;
                case 'employees':
                  const employeeStore = db.createObjectStore('employees', { keyPath: 'id' });
                  employeeStore.createIndex('employeeId', 'employeeId', { unique: true });
                  employeeStore.createIndex('status', 'status');
                  break;
                case 'attendance':
                  const attendanceStore = db.createObjectStore('attendance', { keyPath: 'id' });
                  attendanceStore.createIndex('employeeId', 'employeeId');
                  attendanceStore.createIndex('date', 'date');
                  break;
                case 'tasks':
                  const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
                  taskStore.createIndex('assignedTo', 'assignedTo');
                  taskStore.createIndex('assignedBy', 'assignedBy');
                  taskStore.createIndex('status', 'status');
                  taskStore.createIndex('priority', 'priority');
                  break;
                case 'clientAccessRequests':
                  const accessRequestStore = db.createObjectStore('clientAccessRequests', { keyPath: 'id' });
                  accessRequestStore.createIndex('employeeId', 'employeeId');
                  accessRequestStore.createIndex('clientId', 'clientId');
                  accessRequestStore.createIndex('status', 'status');
                  accessRequestStore.createIndex('requestedAt', 'requestedAt');
                  break;
                case 'clientTasks':
                  const clientTaskStore = db.createObjectStore('clientTasks', { keyPath: 'id' });
                  clientTaskStore.createIndex('clientId', 'clientId');
                  clientTaskStore.createIndex('assignedTo', 'assignedTo');
                  clientTaskStore.createIndex('status', 'status');
                  clientTaskStore.createIndex('priority', 'priority');
                  clientTaskStore.createIndex('deadline', 'deadline');
                  break;
                case 'employeePermissions':
                  const permissionsStore = db.createObjectStore('employeePermissions', { keyPath: 'id' });
                  permissionsStore.createIndex('employeeId', 'employeeId', { unique: true });
                  break;
              }
            }
          });
        } catch (error) {
          console.error("Error during database upgrade:", error);
          reject(error);
        }
      };

      request.onsuccess = () => {
        this.db = request.result;

        this.db.onversionchange = () => {
          this.db?.close();
          alert("A new version of the app is available. Please refresh.");
        };

        // Delay auto-sync to ensure everything is initialized
        setTimeout(() => {
          this.performAutoSync().catch(console.warn);
        }, 1000);
        resolve();
      };
    });
  }

  private async getObjectStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    await this.ensureInitialized();
    if (!this.db) throw new Error('Database failed to initialize');
    return this.db.transaction([storeName], mode).objectStore(storeName);
  }

  // Helper method to create user without sync (for internal use)
  async createUserDirect(user: Omit<User, 'id'>): Promise<User> {
    const store = await this.getObjectStore('users', 'readwrite');
    const newUser: User = { 
      ...user, 
      id: user.id || crypto.randomUUID(), 
      createdAt: user.createdAt || new Date(), 
      lastModified: new Date() 
    };
    
    return new Promise((resolve, reject) => {
      const req = store.add(newUser);
      req.onsuccess = () => resolve(newUser);
      req.onerror = () => reject(req.error);
    });
  }

  // ------------------ USERS ------------------
  async deleteUser(id: string): Promise<void> {
    const store = await this.getObjectStore('users', 'readwrite');
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'delete', 
        store: 'users', 
        data: { id } 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deleteClient(id: string): Promise<void> {
    const store = await this.getObjectStore('clients', 'readwrite');
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'delete', 
        store: 'clients', 
        data: { id } 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async createUser(user: Omit<User, 'id'>): Promise<User> {
    const store = await this.getObjectStore('users', 'readwrite');
    const newUser: User = { 
      ...user, 
      id: crypto.randomUUID(), 
      createdAt: new Date(), 
      lastModified: new Date() 
    };
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'create', 
        store: 'users', 
        data: newUser 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.add(newUser);
      req.onsuccess = () => resolve(newUser);
      req.onerror = () => reject(req.error);
    });
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const store = await this.getObjectStore('users');
    const index = store.index('username');
    return new Promise((resolve, reject) => {
      const req = index.get(username);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllUsers(): Promise<User[]> {
    const store = await this.getObjectStore('users');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result.map(item => this.deserializeDates(item)));
      req.onerror = () => reject(req.error);
    });
  }

  async updateUser(user: User): Promise<void> {
    const store = await this.getObjectStore('users', 'readwrite');
    const updated = { ...user, lastModified: new Date() };
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'update', 
        store: 'users', 
        data: updated 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.put(updated);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ------------------ CLIENTS ------------------
  async createClient(client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Promise<Client> {
    const store = await this.getObjectStore('clients', 'readwrite');
    const newClient: Client = { 
      ...client, 
      id: crypto.randomUUID(), 
      createdAt: new Date(), 
      updatedAt: new Date(), 
      lastModified: new Date() 
    };
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'create', 
        store: 'clients', 
        data: newClient 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.add(newClient);
      req.onsuccess = () => resolve(newClient);
      req.onerror = () => reject(req.error);
    });
  }

  async getClientByCnic(cnic: string): Promise<Client | null> {
    const store = await this.getObjectStore('clients');
    const index = store.index('cnic');
    return new Promise((resolve, reject) => {
      const req = index.get(cnic);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllClients(): Promise<Client[]> {
    const store = await this.getObjectStore('clients');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result.map(item => this.deserializeDates(item)));
      req.onerror = () => reject(req.error);
    });
  }

  async updateClient(client: Client): Promise<void> {
    const store = await this.getObjectStore('clients', 'readwrite');
    const updated = { ...client, updatedAt: new Date(), lastModified: new Date() };
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'update', 
        store: 'clients', 
        data: updated 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.put(updated);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ------------------ RECEIPTS ------------------
  async createReceipt(receipt: Omit<Receipt, 'id' | 'createdAt'>): Promise<Receipt> {
    const store = await this.getObjectStore('receipts', 'readwrite');
    const newReceipt: Receipt = { 
      ...receipt, 
      id: crypto.randomUUID(), 
      createdAt: new Date(), 
      lastModified: new Date() 
    };
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'create', 
        store: 'receipts', 
        data: newReceipt 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.add(newReceipt);
      req.onsuccess = () => resolve(newReceipt);
      req.onerror = () => reject(req.error);
    });
  }

  async getReceiptsByClient(clientCnic: string): Promise<Receipt[]> {
    const store = await this.getObjectStore('receipts');
    const index = store.index('clientCnic');
    return new Promise((resolve, reject) => {
      const req = index.getAll(clientCnic);
      req.onsuccess = () => resolve(req.result.map(item => this.deserializeDates(item)));
      req.onerror = () => reject(req.error);
    });
  }

  async getAllReceipts(): Promise<Receipt[]> {
    const store = await this.getObjectStore('receipts');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result.map(item => this.deserializeDates(item)));
      req.onerror = () => reject(req.error);
    });
  }

  async updateReceipt(receipt: Receipt): Promise<void> {
    const store = await this.getObjectStore('receipts', 'readwrite');
    const updated = { ...receipt, lastModified: new Date() };
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'update', 
        store: 'receipts', 
        data: updated 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.put(updated);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deleteReceipt(id: string): Promise<void> {
    const store = await this.getObjectStore('receipts', 'readwrite');
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'delete', 
        store: 'receipts', 
        data: { id } 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ------------------ EXPENSES ------------------
  async createExpense(expense: Omit<Expense, 'id' | 'createdAt'>): Promise<Expense> {
    const store = await this.getObjectStore('expenses', 'readwrite');
    const newExpense: Expense = { 
      ...expense, 
      id: crypto.randomUUID(), 
      createdAt: new Date(), 
      lastModified: new Date() 
    };
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'create', 
        store: 'expenses', 
        data: newExpense 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.add(newExpense);
      req.onsuccess = () => resolve(newExpense);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllExpenses(): Promise<Expense[]> {
    const store = await this.getObjectStore('expenses');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result.map(item => this.deserializeDates(item)));
      req.onerror = () => reject(req.error);
    });
  }

  async updateExpense(expense: Expense): Promise<void> {
    const store = await this.getObjectStore('expenses', 'readwrite');
    const updated = { ...expense, lastModified: new Date() };
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'update', 
        store: 'expenses', 
        data: updated 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.put(updated);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deleteExpense(id: string): Promise<void> {
    const store = await this.getObjectStore('expenses', 'readwrite');
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'delete', 
        store: 'expenses', 
        data: { id } 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ------------------ ACTIVITIES ------------------
  async createActivity(activity: Omit<Activity, 'id'>): Promise<Activity> {
    const store = await this.getObjectStore('activities', 'readwrite');
    const newActivity: Activity = { ...activity, id: crypto.randomUUID() };
    
    // Don't sync activities to Firebase to avoid clutter
    return new Promise((resolve, reject) => {
      const req = store.add(newActivity);
      req.onsuccess = () => resolve(newActivity);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllActivities(): Promise<Activity[]> {
    const store = await this.getObjectStore('activities');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result.map(item => this.deserializeDates(item)));
      req.onerror = () => reject(req.error);
    });
  }

  // ------------------ NOTIFICATIONS ------------------
  async createNotification(notification: Omit<Notification, 'id'>): Promise<Notification> {
    const store = await this.getObjectStore('notifications', 'readwrite');
    const newNotification: Notification = { ...notification, id: crypto.randomUUID() };
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'create', 
        store: 'notifications', 
        data: newNotification 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.add(newNotification);
      req.onsuccess = () => resolve(newNotification);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllNotifications(): Promise<Notification[]> {
    const store = await this.getObjectStore('notifications');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result.map(item => this.deserializeDates(item)));
      req.onerror = () => reject(req.error);
    });
  }

  async markNotificationAsRead(id: string): Promise<void> {
    const store = await this.getObjectStore('notifications', 'readwrite');
    return new Promise((resolve, reject) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const notification = getReq.result;
        if (notification) {
          notification.read = true;
          notification.lastModified = new Date();
          
          if (this.syncEnabled) {
            firebaseSync.addToSyncQueue({ 
              type: 'update', 
              store: 'notifications', 
              data: notification 
            }).catch(console.warn);
          }
          
          const putReq = store.put(notification);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => reject(putReq.error);
        } else {
          resolve();
        }
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  async markAllNotificationsAsRead(): Promise<void> {
    const store = await this.getObjectStore('notifications', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const notifications = req.result;
        let completed = 0;
        
        if (notifications.length === 0) {
          resolve();
          return;
        }
        
        notifications.forEach(notification => {
          if (!notification.read) {
            notification.read = true;
            notification.lastModified = new Date();
            
            if (this.syncEnabled) {
              firebaseSync.addToSyncQueue({ 
                type: 'update', 
                store: 'notifications', 
                data: notification 
              }).catch(console.warn);
            }
            
            const putReq = store.put(notification);
            putReq.onsuccess = () => {
              completed++;
              if (completed === notifications.length) resolve();
            };
            putReq.onerror = () => reject(putReq.error);
          } else {
            completed++;
            if (completed === notifications.length) resolve();
          }
        });
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deleteNotification(id: string): Promise<void> {
    const store = await this.getObjectStore('notifications', 'readwrite');
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'delete', 
        store: 'notifications', 
        data: { id } 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ------------------ DOCUMENTS ------------------
  async createDocument(doc: Omit<Document, 'id' | 'uploadedAt' | 'accessLog'>): Promise<Document> {
    const store = await this.getObjectStore('documents', 'readwrite');
    const newDoc: Document = { 
      ...doc, 
      id: crypto.randomUUID(), 
      uploadedAt: new Date(), 
      lastModified: new Date(), 
      accessLog: [{ userId: doc.uploadedBy, timestamp: new Date(), action: 'upload' }] 
    };
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'create', 
        store: 'documents', 
        data: newDoc 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.add(newDoc);
      req.onsuccess = () => resolve(newDoc);
      req.onerror = () => reject(req.error);
    });
  }

  async getDocumentsByClient(clientCnic: string): Promise<Document[]> {
    const store = await this.getObjectStore('documents');
    const index = store.index('clientCnic');
    return new Promise((resolve, reject) => {
      const req = index.getAll(clientCnic);
      req.onsuccess = () => resolve(req.result.map(item => this.deserializeDates(item)));
      req.onerror = () => reject(req.error);
    });
  }

  async getAllDocuments(): Promise<Document[]> {
    const store = await this.getObjectStore('documents');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result.map(item => this.deserializeDates(item)));
      req.onerror = () => reject(req.error);
    });
  }

  async updateDocument(doc: Document): Promise<void> {
    const store = await this.getObjectStore('documents', 'readwrite');
    const updated = { ...doc, lastModified: new Date() };
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'update', 
        store: 'documents', 
        data: updated 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.put(updated);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deleteDocument(id: string): Promise<void> {
    const store = await this.getObjectStore('documents', 'readwrite');
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'delete', 
        store: 'documents', 
        data: { id } 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async logDocumentAccess(documentId: string, userId: string, action: 'view' | 'download'): Promise<void> {
    const store = await this.getObjectStore('documents', 'readwrite');
    return new Promise((resolve, reject) => {
      const getReq = store.get(documentId);
      getReq.onsuccess = () => {
        const doc = getReq.result;
        if (doc) {
          doc.lastAccessed = new Date();
          doc.lastModified = new Date();
          doc.accessLog.push({ userId, timestamp: new Date(), action });
          
          if (this.syncEnabled) {
            firebaseSync.addToSyncQueue({ 
              type: 'update', 
              store: 'documents', 
              data: doc 
            }).catch(console.warn);
          }
          
          const putReq = store.put(doc);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => reject(putReq.error);
        } else {
          resolve();
        }
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  // ------------------ EMPLOYEES ------------------
  async createEmployee(e: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>): Promise<Employee> {
    const store = await this.getObjectStore('employees', 'readwrite');
    const newEmp: Employee = { 
      ...e, 
      id: crypto.randomUUID(), 
      createdAt: new Date(), 
      updatedAt: new Date(), 
      lastModified: new Date() 
    };
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'create', 
        store: 'employees', 
        data: newEmp 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.add(newEmp);
      req.onsuccess = () => resolve(newEmp);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllEmployees(): Promise<Employee[]> {
    const store = await this.getObjectStore('employees');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result.map(item => this.deserializeDates(item)));
      req.onerror = () => reject(req.error);
    });
  }

  async updateEmployee(e: Employee): Promise<void> {
    const store = await this.getObjectStore('employees', 'readwrite');
    const updated = { ...e, updatedAt: new Date(), lastModified: new Date() };
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'update', 
        store: 'employees', 
        data: updated 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.put(updated);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deleteEmployee(id: string): Promise<void> {
    const store = await this.getObjectStore('employees', 'readwrite');
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'delete', 
        store: 'employees', 
        data: { id } 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getEmployeeById(id: string): Promise<Employee | null> {
    const store = await this.getObjectStore('employees');
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  // ------------------ ATTENDANCE ------------------
  async getAllAttendance(): Promise<Attendance[]> {
    const store = await this.getObjectStore('attendance');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result.map(item => this.deserializeDates(item)));
      req.onerror = () => reject(req.error);
    });
  }

  async markAttendance(r: Omit<Attendance, 'id'>): Promise<Attendance> {
    const store = await this.getObjectStore('attendance', 'readwrite');
    const newRec: Attendance = { 
      ...r, 
      id: crypto.randomUUID(), 
      createdAt: new Date(),
      lastModified: new Date() 
    };
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'create', 
        store: 'attendance', 
        data: newRec 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.add(newRec);
      req.onsuccess = () => resolve(newRec);
      req.onerror = () => reject(req.error);
    });
  }

  async getAttendanceByEmployee(employeeId: string): Promise<Attendance[]> {
    const store = await this.getObjectStore('attendance');
    const idx = store.index('employeeId');
    return new Promise((resolve, reject) => {
      const req = idx.getAll(employeeId);
      req.onsuccess = () => resolve(req.result.map(item => this.deserializeDates(item)));
      req.onerror = () => reject(req.error);
    });
  }

  async updateAttendance(r: Attendance): Promise<void> {
    const store = await this.getObjectStore('attendance', 'readwrite');
    const updated = { ...r, lastModified: new Date() };
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'update', 
        store: 'attendance', 
        data: updated 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.put(updated);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deleteAttendance(id: string): Promise<void> {
    const store = await this.getObjectStore('attendance', 'readwrite');
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'delete', 
        store: 'attendance', 
        data: { id } 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ------------------ TASKS ------------------
  async createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    const store = await this.getObjectStore('tasks', 'readwrite');
    const newTask: Task = { 
      ...task, 
      id: crypto.randomUUID(), 
      createdAt: new Date(), 
      updatedAt: new Date(), 
      lastModified: new Date() 
    };
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'create', 
        store: 'tasks', 
        data: newTask 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.add(newTask);
      req.onsuccess = () => resolve(newTask);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllTasks(): Promise<Task[]> {
    const store = await this.getObjectStore('tasks');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result.map(item => this.deserializeDates(item)));
      req.onerror = () => reject(req.error);
    });
  }

  async getTasksByEmployee(employeeId: string): Promise<Task[]> {
    const store = await this.getObjectStore('tasks');
    const index = store.index('assignedTo');
    return new Promise((resolve, reject) => {
      const req = index.getAll(employeeId);
      req.onsuccess = () => resolve(req.result.map(item => this.deserializeDates(item)));
      req.onerror = () => reject(req.error);
    });
  }

  async getTasksByAssigner(assignerId: string): Promise<Task[]> {
    const store = await this.getObjectStore('tasks');
    const index = store.index('assignedBy');
    return new Promise((resolve, reject) => {
      const req = index.getAll(assignerId);
      req.onsuccess = () => resolve(req.result.map(item => this.deserializeDates(item)));
      req.onerror = () => reject(req.error);
    });
  }

  async updateTask(task: Task): Promise<void> {
    const store = await this.getObjectStore('tasks', 'readwrite');
    const updated = { ...task, updatedAt: new Date(), lastModified: new Date() };
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'update', 
        store: 'tasks', 
        data: updated 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.put(updated);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deleteTask(id: string): Promise<void> {
    const store = await this.getObjectStore('tasks', 'readwrite');
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'delete', 
        store: 'tasks', 
        data: { id } 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ------------------ CLIENT ACCESS REQUESTS ------------------
  async createClientAccessRequest(request: Omit<ClientAccessRequest, 'id' | 'requestedAt'>): Promise<ClientAccessRequest> {
    const store = await this.getObjectStore('clientAccessRequests', 'readwrite');
    const newRequest: ClientAccessRequest = { 
      ...request, 
      id: crypto.randomUUID(), 
      requestedAt: new Date(), 
      lastModified: new Date() 
    };
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'create', 
        store: 'clientAccessRequests', 
        data: newRequest 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.add(newRequest);
      req.onsuccess = () => resolve(newRequest);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllClientAccessRequests(): Promise<ClientAccessRequest[]> {
    const store = await this.getObjectStore('clientAccessRequests');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result.map(item => this.deserializeDates(item)));
      req.onerror = () => reject(req.error);
    });
  }

  async getClientAccessRequestsByEmployee(employeeId: string): Promise<ClientAccessRequest[]> {
    const store = await this.getObjectStore('clientAccessRequests');
    const index = store.index('employeeId');
    return new Promise((resolve, reject) => {
      const req = index.getAll(employeeId);
      req.onsuccess = () => resolve(req.result.map(item => this.deserializeDates(item)));
      req.onerror = () => reject(req.error);
    });
  }

  async updateClientAccessRequest(request: ClientAccessRequest): Promise<void> {
    const store = await this.getObjectStore('clientAccessRequests', 'readwrite');
    const updated = { ...request, lastModified: new Date() };
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'update', 
        store: 'clientAccessRequests', 
        data: updated 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.put(updated);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deleteClientAccessRequest(id: string): Promise<void> {
    const store = await this.getObjectStore('clientAccessRequests', 'readwrite');
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'delete', 
        store: 'clientAccessRequests', 
        data: { id } 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ------------------ CLIENT TASKS ------------------
  async createClientTask(task: Omit<ClientTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<ClientTask> {
    const store = await this.getObjectStore('clientTasks', 'readwrite');
    const newTask: ClientTask = { 
      ...task, 
      id: crypto.randomUUID(), 
      createdAt: new Date(), 
      updatedAt: new Date(), 
      lastModified: new Date() 
    };
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'create', 
        store: 'clientTasks', 
        data: newTask 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.add(newTask);
      req.onsuccess = () => resolve(newTask);
      req.onerror = () => reject(req.error);
    });
  }

  async getTasksByClient(clientId: string): Promise<ClientTask[]> {
    const store = await this.getObjectStore('clientTasks');
    const index = store.index('clientId');
    return new Promise((resolve, reject) => {
      const req = index.getAll(clientId);
      req.onsuccess = () => resolve(req.result.map(item => this.deserializeDates(item)));
      req.onerror = () => reject(req.error);
    });
  }

  async getAllClientTasks(): Promise<ClientTask[]> {
    const store = await this.getObjectStore('clientTasks');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result.map(item => this.deserializeDates(item)));
      req.onerror = () => reject(req.error);
    });
  }

  async updateClientTask(task: ClientTask): Promise<void> {
    const store = await this.getObjectStore('clientTasks', 'readwrite');
    const updated = { ...task, updatedAt: new Date(), lastModified: new Date() };
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'update', 
        store: 'clientTasks', 
        data: updated 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.put(updated);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deleteClientTask(id: string): Promise<void> {
    const store = await this.getObjectStore('clientTasks', 'readwrite');
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'delete', 
        store: 'clientTasks', 
        data: { id } 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ------------------ EMPLOYEE PERMISSIONS ------------------
  async createEmployeePermissions(permissions: Omit<EmployeePermissions, 'id' | 'createdAt' | 'updatedAt'>): Promise<EmployeePermissions> {
    const store = await this.getObjectStore('employeePermissions', 'readwrite');
    const newPermissions: EmployeePermissions = { 
      ...permissions, 
      id: crypto.randomUUID(), 
      createdAt: new Date(), 
      updatedAt: new Date(), 
      lastModified: new Date() 
    };
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'create', 
        store: 'employeePermissions', 
        data: newPermissions 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.add(newPermissions);
      req.onsuccess = () => resolve(newPermissions);
      req.onerror = () => reject(req.error);
    });
  }

  async getEmployeePermissions(employeeId: string): Promise<EmployeePermissions | null> {
    const store = await this.getObjectStore('employeePermissions');
    const index = store.index('employeeId');
    return new Promise((resolve, reject) => {
      const req = index.get(employeeId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllEmployeePermissions(): Promise<EmployeePermissions[]> {
    const store = await this.getObjectStore('employeePermissions');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result.map(item => this.deserializeDates(item)));
      req.onerror = () => reject(req.error);
    });
  }

  async updateEmployeePermissions(employeeId: string, permissions: Partial<EmployeePermissions>): Promise<void> {
    // First try to get existing permissions
    let existingPermissions = await this.getEmployeePermissions(employeeId);
    
    if (!existingPermissions) {
      // Create new permissions if they don't exist
      const defaultPermissions = {
        employeeId,
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
        ...permissions
      };
      
      await this.createEmployeePermissions(defaultPermissions);
      return;
    }

    // Update existing permissions
    const store = await this.getObjectStore('employeePermissions', 'readwrite');
    const updated = { 
      ...existingPermissions, 
      ...permissions, 
      updatedAt: new Date(), 
      lastModified: new Date() 
    };
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'update', 
        store: 'employeePermissions', 
        data: updated 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.put(updated);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deleteEmployeePermissions(employeeId: string): Promise<void> {
    const permissions = await this.getEmployeePermissions(employeeId);
    if (!permissions) return;

    const store = await this.getObjectStore('employeePermissions', 'readwrite');
    
    if (this.syncEnabled) {
      firebaseSync.addToSyncQueue({ 
        type: 'delete', 
        store: 'employeePermissions', 
        data: { id: permissions.id } 
      }).catch(console.warn);
    }
    
    return new Promise((resolve, reject) => {
      const req = store.delete(permissions.id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ------------------ UTILITY METHODS ------------------
  async clearStore(storeName: string): Promise<void> {
    const store = await this.getObjectStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async clearAllData(): Promise<void> {
    const stores = ['users', 'clients', 'receipts', 'expenses', 'activities', 'notifications', 'documents', 'employees', 'attendance', 'tasks', 'clientAccessRequests', 'clientTasks', 'employeePermissions'];
    
    for (const storeName of stores) {
      await this.clearStore(storeName);
    }
    
    // Clear sync queue
    this.syncQueue = [];
    this.saveSyncQueue();
    
    // Clear Firebase
    await firebaseSync.wipeAllData();
    
    console.log('✅ All local and Firebase data cleared');
  }

  async exportData(): Promise<string> {
    const [users, clients, receipts, expenses, activities, notifications, documents, employees, attendance, tasks, clientAccessRequests, clientTasks, employeePermissions] = await Promise.all([
      this.getAllUsers(),
      this.getAllClients(),
      this.getAllReceipts(),
      this.getAllExpenses(),
      this.getAllActivities(),
      this.getAllNotifications(),
      this.getAllDocuments().catch(() => []),
      this.getAllEmployees().catch(() => []),
      this.getAllAttendance().catch(() => []),
      this.getAllTasks().catch(() => []),
      this.getAllClientAccessRequests().catch(() => []),
      this.getAllClientTasks().catch(() => []),
      this.getAllEmployeePermissions().catch(() => []),
    ]);

    return JSON.stringify({
      users,
      clients,
      receipts,
      expenses,
      activities,
      notifications,
      documents,
      employees,
      attendance,
      tasks,
      clientAccessRequests,
      clientTasks,
      employeePermissions,
      exportDate: new Date().toISOString(),
      version: this.dbVersion,
      appName: 'Arkive',
      deviceId: firebaseSync['deviceId'],
    }, null, 2);
  }

  async importData(json: string): Promise<void> {
    const data = JSON.parse(json);
    const stores = ['users', 'clients', 'receipts', 'expenses', 'activities', 'notifications', 'documents', 'employees', 'attendance', 'tasks', 'clientAccessRequests', 'clientTasks', 'employeePermissions'];
    
    // Clear all stores
    for (const storeName of stores) {
      await this.clearStore(storeName);
    }

    // Import data
    const importStore = async (storeName: string, items: any[]) => {
      if (!items || !Array.isArray(items)) return;
      
      const store = await this.getObjectStore(storeName, 'readwrite');
      for (const item of items) {
        try {
          // Convert date strings back to Date objects
          const processedItem = this.deserializeDates(item);
          await new Promise<void>((resolve, reject) => {
            const req = store.add(processedItem);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          });
        } catch (error) {
          console.warn(`Failed to import item to ${storeName}:`, error);
        }
      }
    };

    await Promise.all([
      importStore('users', data.users || []),
      importStore('clients', data.clients || []),
      importStore('receipts', data.receipts || []),
      importStore('expenses', data.expenses || []),
      importStore('activities', data.activities || []),
      importStore('notifications', data.notifications || []),
      importStore('documents', data.documents || []),
      importStore('clientAccessRequests', data.clientAccessRequests || []),
      importStore('employees', data.employees || []),
      importStore('attendance', data.attendance || []),
      importStore('tasks', data.tasks || []),
      importStore('clientTasks', data.clientTasks || []),
      importStore('employeePermissions', data.employeePermissions || []),
    ]);
  }

  private deserializeDates(item: any): any {
    const deserialized = { ...item };
    
    const dateFields = ['date', 'createdAt', 'updatedAt', 'lastLogin', 'uploadedAt', 'joinDate', 'timestamp', 'lastModified', 'lastAccessed', 'checkIn', 'checkOut'];
    
    dateFields.forEach(field => {
      if (deserialized[field] && typeof deserialized[field] === 'string') {
        try {
          deserialized[field] = new Date(deserialized[field]);
          // Check if the date is invalid and set to null if so
          if (isNaN(deserialized[field].getTime())) {
            deserialized[field] = null;
          }
        } catch (error) {
          console.warn(`Failed to parse date field ${field}:`, error);
          deserialized[field] = null;
        }
      }
      // Handle cases where the field is already a Date but invalid
      else if (deserialized[field] instanceof Date && isNaN(deserialized[field].getTime())) {
        deserialized[field] = null;
      }
    });

    // Handle nested date objects in accessLog
    if (deserialized.accessLog && Array.isArray(deserialized.accessLog)) {
      deserialized.accessLog = deserialized.accessLog.map((log: any) => ({
        ...log,
        timestamp: log.timestamp ? (() => {
          const date = new Date(log.timestamp);
          return isNaN(date.getTime()) ? new Date() : date;
        })() : new Date()
      }));
    }

    return deserialized;
  }

  async getSyncStatus() {
    return firebaseSync.getSyncStatus();
  }

  // Auto-create client when receipt is added
  async autoCreateClientFromReceipt(clientName: string, clientCnic: string): Promise<Client> {
    // Check if client already exists
    const existingClient = await this.getClientByCnic(clientCnic);
    if (existingClient) {
      return existingClient;
    }

    // Create new client
    const newClient = await this.createClient({
      name: clientName,
      cnic: clientCnic,
      password: `client_${clientCnic.slice(-4)}`, // Default password using last 4 digits
      type: 'Other',
      phone: '',
      email: '',
      notes: 'Auto-created from receipt entry'
      documentsReceived: []
    });

    // Log the auto-creation
    await this.createActivity({
      userId: 'system',
      action: 'auto_create_client',
      details: `Auto-created client: ${clientName} (${clientCnic}) from receipt entry`,
      timestamp: new Date(),
    });
    console.log(`✅ Auto-created client: ${clientName} (${clientCnic})`);
    return newClient;
  }

  // Get employee by employee ID
  async getEmployeeByEmployeeId(employeeId: string): Promise<Employee | null> {
    const store = await this.getObjectStore('employees');
    const index = store.index('employeeId');
    return new Promise((resolve, reject) => {
      const req = index.get(employeeId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }
}

export const db = new DatabaseService();