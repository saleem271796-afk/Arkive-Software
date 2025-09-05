import { User } from '../types';
import { db } from './database';
import { firebaseSync } from './firebaseSync';
import { auth as firebaseAuth } from '../firebase';
import { signInAnonymously, signOut } from 'firebase/auth';

class AuthService {
  private currentUser: User | null = null;
  private sessionStartTime: Date | null = null;
  private readonly MAX_ADMIN_ACCOUNTS = 2;
  private sessionCheckInterval: NodeJS.Timeout | null = null;

  async init(): Promise<void> {
    try {
      console.log('🔐 Initializing authentication service...');
      let isConnected = false;
      
      // Check Firebase connection and sync users
      try {
        isConnected = await firebaseSync.checkConnection();
        if (isConnected) {
          try {
            console.log('🔄 Syncing users from Firebase...');
            const firebaseUsers = await firebaseSync.getStoreFromFirebase('users');
            
            // Only clear and sync if we have Firebase users
            if (firebaseUsers.length > 0) {
              await db.clearStore('users');
              
              for (const user of firebaseUsers) {
                await db.createUserDirect({
                  id: user.id,
                  username: user.username,
                  password: user.password,
                  role: user.role,
                  createdAt: user.createdAt || new Date(),
                  lastLogin: user.lastLogin
                });
              }
              console.log(`✅ ${firebaseUsers.length} users synced from Firebase`);
            }
          } catch (syncError) {
            console.warn('⚠️ Firebase sync failed, using local data:', syncError);
          }
        }
      } catch (connectionError) {
        console.warn('⚠️ Firebase connection check failed:', connectionError);
      }

      // Create default admin if no users exist
      const allUsers = await db.getAllUsers();
      if (allUsers.length === 0) {
        console.log('👤 Creating default admin user...');
        try {
          const defaultAdmin = await db.createUserDirect({
            username: 'admin',
            password: 'admin123',
            role: 'admin',
            createdAt: new Date(),
          });

          // Sync to Firebase if connected
          if (isConnected) {
            await firebaseSync.addToSyncQueue({
              type: 'create',
              store: 'users',
              data: defaultAdmin
            });
          }
          console.log('✅ Default admin user created');
        } catch (createError) {
          console.warn('⚠️ Failed to create default admin user:', createError);
        }
      } else {
        // Ensure default admin exists even if other users are present
        const adminUser = allUsers.find(u => u.username === 'admin');
        if (!adminUser) {
          console.log('👤 Creating missing default admin user...');
          try {
            const defaultAdmin = await db.createUserDirect({
              username: 'admin',
              password: 'admin123',
              role: 'admin',
              createdAt: new Date(),
            });
            
            // Sync to Firebase if connected
            if (isConnected) {
              await firebaseSync.addToSyncQueue({
                type: 'create',
                store: 'users',
                data: defaultAdmin
              });
            }
            console.log('✅ Default admin user created');
          } catch (syncError) {
            console.warn('⚠️ Failed to create default admin user:', syncError);
          }
        }
      }

      // Check for stored session
      const storedUser = localStorage.getItem('currentUser');
      const sessionStart = localStorage.getItem('sessionStartTime');
      
      if (storedUser && sessionStart) {
        try {
          this.currentUser = JSON.parse(storedUser);
          this.sessionStartTime = new Date(sessionStart);
          
          // Check session timeout (30 minutes)
          const sessionDuration = Date.now() - new Date(sessionStart).getTime();
          const maxSessionTime = 30 * 60 * 1000; // 30 minutes
          
          if (sessionDuration > maxSessionTime) {
            console.log('⏰ Session expired, logging out');
            await this.logout();
          } else {
            console.log('✅ Session restored for user:', this.currentUser?.username);
            this.startSessionMonitoring();
          }
        } catch (error) {
          console.error('❌ Error restoring session:', error);
          await this.logout();
        }
      }
    } catch (error) {
      console.error('❌ Error during authentication initialization:', error);
    }
  }

  async login(username: string, password: string): Promise<User> {
    try {
      // Input validation
      if (!username || !password) {
        throw new Error('Username and password are required');
      }
      
      if (username.length < 3) {
        throw new Error('Username must be at least 3 characters long');
      }
      
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      const user = await db.getUserByUsername(username);
      
      if (!user || user.password !== password) {
        // Log failed login attempt
        await db.createActivity({
          userId: 'system',
          action: 'failed_login',
          details: `Failed login attempt for username: ${username} from device: ${firebaseSync['deviceId']}`,
          timestamp: new Date(),
        });
        throw new Error('Invalid username or password');
      }

      // Update last login
      user.lastLogin = new Date();
      await db.updateUser(user);

      this.currentUser = user;
      this.sessionStartTime = new Date();
      
      localStorage.setItem('currentUser', JSON.stringify(user));
      localStorage.setItem('sessionStartTime', this.sessionStartTime.toISOString());

      // Log successful login
      await db.createActivity({
        userId: user.id,
        action: 'login',
        details: `User ${username} logged in successfully from device: ${firebaseSync['deviceId']}. Session started at ${this.sessionStartTime.toLocaleString()}`,
        timestamp: new Date(),
      });

      // Start session monitoring
      this.startSessionMonitoring();

      // Sign in to Firebase anonymously for database access
      try {
        await signInAnonymously(firebaseAuth);
        console.log('✅ Firebase anonymous authentication successful');
      } catch (firebaseError) {
        console.warn('⚠️ Firebase anonymous sign-in failed:', firebaseError);
      }

      // Perform full sync and setup realtime listeners
      const isConnected = await firebaseSync.checkConnection();
      if (isConnected) {
        await firebaseSync.performFullSync();
        this.setupRealtimeListeners();
      }

      console.log('✅ Login successful for user:', username);
      return user;
    } catch (error) {
      console.error('❌ Login error:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    if (this.currentUser && this.sessionStartTime) {
      const sessionDuration = Date.now() - this.sessionStartTime.getTime();
      const durationMinutes = Math.round(sessionDuration / (1000 * 60));
      
      try {
        await db.createActivity({
          userId: this.currentUser.id,
          action: 'logout',
          details: `User ${this.currentUser.username} logged out from device: ${firebaseSync['deviceId']}. Session duration: ${durationMinutes} minutes`,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error('❌ Error logging logout activity:', error);
      }
    }

    // Stop session monitoring
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
    }

    // Remove realtime listeners
    firebaseSync.removeRealtimeListener();

    // Sign out from Firebase
    try {
      await signOut(firebaseAuth);
      console.log('✅ Firebase sign-out successful');
    } catch (firebaseError) {
      console.warn('⚠️ Firebase sign-out failed:', firebaseError);
    }

    this.currentUser = null;
    this.sessionStartTime = null;
    localStorage.removeItem('currentUser');
    localStorage.removeItem('sessionStartTime');
    
    console.log('✅ User logged out');
  }

  async register(username: string, password: string, role: 'admin' | 'employee' = 'admin'): Promise<User> {
    try {
      // Input validation
      if (!username || !password) {
        throw new Error('Username and password are required');
      }
      
      if (username.length < 3) {
        throw new Error('Username must be at least 3 characters long');
      }
      
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }
      
      // Sanitize username
      const sanitizedUsername = username.trim().toLowerCase();
      
      // Check if user already exists
      const existingUser = await db.getUserByUsername(sanitizedUsername);
      if (existingUser) {
        throw new Error('Username already exists');
      }

      // Check admin limit
      const users = await db.getAllUsers();
      const adminCount = users.filter(u => u.role === 'admin').length;
      
      if (role === 'admin' && adminCount >= this.MAX_ADMIN_ACCOUNTS) {
        throw new Error(`Maximum number of admin accounts (${this.MAX_ADMIN_ACCOUNTS}) reached`);
      }

      // Allow employee creation by admins or during initial setup
      if (users.length > 0 && (!this.currentUser || this.currentUser.role !== 'admin')) {
        throw new Error('Only administrators can create new accounts');
      }

      const user = await db.createUser({
        username: sanitizedUsername,
        password,
        role,
        createdAt: new Date(),
      });

      // Log activity
      const actorId = this.currentUser?.id || 'system';
      const actorName = this.currentUser?.username || 'system';
      
      await db.createActivity({
        userId: actorId,
        action: 'create_user',
        details: `${actorName} created ${role} account for ${sanitizedUsername} from device: ${firebaseSync['deviceId']}`,
        timestamp: new Date(),
      });

      console.log('✅ User registered successfully:', sanitizedUsername);
      return user;
    } catch (error) {
      console.error('❌ Registration error:', error);
      throw error;
    }
  }

  private setupRealtimeListeners(): void {
    const stores = ['users', 'clients', 'receipts', 'expenses', 'notifications', 'documents', 'employees', 'attendance'];
    
    stores.forEach(store => {
      firebaseSync.setupRealtimeListener(store, (data) => {
        console.log(`📡 Realtime update received for ${store}: ${data.length} items`);
        // The individual hooks will handle the data updates
      });
    });
  }

  private startSessionMonitoring(): void {
    // Clear any existing interval
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
    }

    // Check session every minute
    this.sessionCheckInterval = setInterval(() => {
      if (this.sessionStartTime) {
        const sessionDuration = Date.now() - this.sessionStartTime.getTime();
        const maxSessionTime = 30 * 60 * 1000; // 30 minutes
        
        if (sessionDuration > maxSessionTime) {
          console.log('⏰ Session timeout, logging out');
          this.logout();
          window.location.reload();
        }
      }
    }, 60000);
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  isEmployee(): boolean {
    return this.currentUser?.role === 'employee';
  }

  isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }

  getSessionDuration(): number {
    if (!this.sessionStartTime) return 0;
    return Math.round((Date.now() - this.sessionStartTime.getTime()) / (1000 * 60));
  }

  getSessionStartTime(): Date | null {
    return this.sessionStartTime;
  }

  async getAllUsers(): Promise<User[]> {
    if (!this.isAdmin()) {
      throw new Error('Only administrators can view all users');
    }
    return db.getAllUsers();
  }
}

export const auth = new AuthService();