import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { auth } from '../services/auth';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  register: (username: string, password: string, role?: 'admin' | 'employee') => Promise<User>;
  logout: () => Promise<void>;
  sessionDuration: number;
  sessionStartTime: Date | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionDuration, setSessionDuration] = useState(0);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await auth.init();
        const currentUser = auth.getCurrentUser();
        setUser(currentUser);
        
        // Update session duration every minute
        const interval = setInterval(() => {
          setSessionDuration(auth.getSessionDuration());
        }, 60000);

        return () => clearInterval(interval);
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string): Promise<User> => {
    try {
      const loggedInUser = await auth.login(username, password);
      setUser(loggedInUser);
      setSessionDuration(0);
      return loggedInUser;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (username: string, password: string, role: 'admin' | 'employee' = 'admin'): Promise<User> => {
    try {
      const newUser = await auth.register(username, password, role);
      return newUser;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await auth.logout();
      setUser(null);
      setSessionDuration(0);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: auth.isAuthenticated(),
    isAdmin: auth.isAdmin(),
    loading,
    login,
    register,
    logout,
    sessionDuration,
    sessionStartTime: auth.getSessionStartTime(),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};