import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI, dashboardAPI, LoginResponse } from '@/lib/api';
import { jwtDecode } from 'jwt-decode';

interface User {
  id: string;
  username: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  instagramConnected: boolean;
  googleAnalyticsConnected: boolean;
  login: (email: string, password: string) => Promise<void>;
  googleLogin: (token: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateConnectionStatus: (instagramConnected: boolean, googleAnalyticsConnected: boolean) => void;
  refreshConnectionStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [instagramConnected, setInstagramConnected] = useState(false);
  const [googleAnalyticsConnected, setGoogleAnalyticsConnected] = useState(false);

  // Function to fetch and update connection status from server
  const fetchConnectionStatus = async (): Promise<{ instagramConnected: boolean; googleAnalyticsConnected: boolean }> => {
    try {
      console.log('Fetching connection status from server...');
      const connectionStatus = await dashboardAPI.getConnectionStatus();
      console.log('Connection status from server:', connectionStatus);
      return connectionStatus;
    } catch (error) {
      console.error('Error fetching connection status from server:', error);
      // Return fallback values
      return { instagramConnected: false, googleAnalyticsConnected: false };
    }
  };

  // Function to update localStorage with connection status
  const updateLocalStorageWithConnectionStatus = (instagramConnected: boolean, googleAnalyticsConnected: boolean) => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        const updatedUser = {
          ...parsedUser,
          instagramConnected,
          googleAnalyticsConnected
        };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        console.log('Updated localStorage with connection status:', { instagramConnected, googleAnalyticsConnected });
      } catch (error) {
        console.error('Error updating localStorage with connection status:', error);
      }
    }
  };

  useEffect(() => {
    // Check if user is logged in on app start
    const checkAuthStatus = async () => {
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          const parsedUser = JSON.parse(userData);
          if (parsedUser.token) {
            // Verify token is not expired
            const decoded = jwtDecode(parsedUser.token);
            const currentTime = Date.now() / 1000;
            
            if (decoded.exp && decoded.exp > currentTime) {
              setUser(parsedUser.RegisteredUser);
              setIsLoggedIn(true);
              
              // Set initial connection status from localStorage
              setInstagramConnected(parsedUser.instagramConnected || false);
              setGoogleAnalyticsConnected(parsedUser.googleAnalyticsConnected || false);
              
              // Fetch current connection status from server and update if different
              try {
                const serverConnectionStatus = await fetchConnectionStatus();
                
                // Only update if server data is different from localStorage
                if (serverConnectionStatus.instagramConnected !== (parsedUser.instagramConnected || false) ||
                    serverConnectionStatus.googleAnalyticsConnected !== (parsedUser.googleAnalyticsConnected || false)) {
                  
                  console.log('Connection status differs from localStorage, updating...');
                  setInstagramConnected(serverConnectionStatus.instagramConnected);
                  setGoogleAnalyticsConnected(serverConnectionStatus.googleAnalyticsConnected);
                  updateLocalStorageWithConnectionStatus(
                    serverConnectionStatus.instagramConnected,
                    serverConnectionStatus.googleAnalyticsConnected
                  );
                }
              } catch (error) {
                console.error('Error fetching connection status from server:', error);
                // Keep using localStorage data as fallback
              }
            } else {
              // Token expired, clear storage
              console.log('Token expired, clearing localStorage');
              localStorage.removeItem('user');
            }
          }
        } catch (error) {
          console.error('Error parsing user data:', error);
          localStorage.removeItem('user');
        }
      }
      setIsLoading(false);
    };

    checkAuthStatus();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await authAPI.login(email, password);
      localStorage.setItem('user', JSON.stringify(response));
      setUser(response.RegisteredUser);
      setIsLoggedIn(true);
      
      // Fetch connection status from server after login
      const connectionStatus = await fetchConnectionStatus();
      setInstagramConnected(connectionStatus.instagramConnected);
      setGoogleAnalyticsConnected(connectionStatus.googleAnalyticsConnected);
      updateLocalStorageWithConnectionStatus(connectionStatus.instagramConnected, connectionStatus.googleAnalyticsConnected);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const googleLogin = async (token: string) => {
    try {
      const response = await authAPI.googleLogin(token);
      localStorage.setItem('user', JSON.stringify(response));
      setUser(response.RegisteredUser);
      setIsLoggedIn(true);
      
      // Fetch connection status from server after login
      const connectionStatus = await fetchConnectionStatus();
      setInstagramConnected(connectionStatus.instagramConnected);
      setGoogleAnalyticsConnected(connectionStatus.googleAnalyticsConnected);
      updateLocalStorageWithConnectionStatus(connectionStatus.instagramConnected, connectionStatus.googleAnalyticsConnected);
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  };

  const register = async (username: string, email: string, password: string) => {
    try {
      await authAPI.register(username, email, password);
      // Note: Registration might not automatically log in the user
      // depending on your backend implementation
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('user');
    setUser(null);
    setIsLoggedIn(false);
    setInstagramConnected(false);
    setGoogleAnalyticsConnected(false);
  };

  const updateConnectionStatus = (instagramConnected: boolean, googleAnalyticsConnected: boolean) => {
    setInstagramConnected(instagramConnected);
    setGoogleAnalyticsConnected(googleAnalyticsConnected);
    updateLocalStorageWithConnectionStatus(instagramConnected, googleAnalyticsConnected);
  };

  const refreshConnectionStatus = async () => {
    if (isLoggedIn) {
      const connectionStatus = await fetchConnectionStatus();
      setInstagramConnected(connectionStatus.instagramConnected);
      setGoogleAnalyticsConnected(connectionStatus.googleAnalyticsConnected);
      updateLocalStorageWithConnectionStatus(connectionStatus.instagramConnected, connectionStatus.googleAnalyticsConnected);
    }
  };

  const value: AuthContextType = {
    user,
    isLoggedIn,
    isLoading,
    instagramConnected,
    googleAnalyticsConnected,
    login,
    googleLogin,
    register,
    logout,
    updateConnectionStatus,
    refreshConnectionStatus,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
