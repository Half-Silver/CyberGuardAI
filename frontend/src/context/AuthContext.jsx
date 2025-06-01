import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { NODE_API_URL } from '../api/chatService';

// Create the auth context
const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is authenticated on load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authData = localStorage.getItem('cyberguard_auth');
        
        if (!authData) {
          setLoading(false);
          return;
        }
        
        const { token, expires } = JSON.parse(authData);
        
        // Check if token is expired
        if (new Date(expires) < new Date()) {
          localStorage.removeItem('cyberguard_auth');
          setLoading(false);
          return;
        }
        
        // Validate token with the server
        const response = await axios.get(`${NODE_API_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        setUser({
          ...response.data,
          token
        });
      } catch (err) {
        console.error('Auth check error:', err);
        localStorage.removeItem('cyberguard_auth');
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  // Login function
  const login = async (email, password) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post(`${NODE_API_URL}/auth/login`, {
        email,
        password
      });
      
      const { token, expires, email: userEmail, fullname } = response.data;
      
      // Store auth data in localStorage
      localStorage.setItem('cyberguard_auth', JSON.stringify({
        token,
        expires,
        user: userEmail
      }));
      
      setUser({
        email: userEmail,
        fullname,
        token
      });
      
      return true;
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.detail || 'Login failed. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Signup function
  const signup = async (email, fullname, password) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post(`${NODE_API_URL}/auth/signup`, {
        email,
        fullname,
        password
      });
      
      const { token, expires } = response.data;
      
      // Store auth data in localStorage
      localStorage.setItem('cyberguard_auth', JSON.stringify({
        token,
        expires,
        user: email
      }));
      
      setUser({
        email,
        fullname,
        token
      });
      
      return true;
    } catch (err) {
      console.error('Signup error:', err);
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      setLoading(true);
      
      if (user?.token) {
        await axios.post(
          `${NODE_API_URL}/auth/logout`,
          {},
          {
            headers: {
              Authorization: `Bearer ${user.token}`
            }
          }
        );
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('cyberguard_auth');
      setUser(null);
      setLoading(false);
    }
  };

  // Get authentication token
  const getToken = () => {
    const authData = localStorage.getItem('cyberguard_auth');
    if (!authData) return null;
    
    const { token, expires } = JSON.parse(authData);
    
    // Check if token is expired
    if (new Date(expires) < new Date()) {
      localStorage.removeItem('cyberguard_auth');
      setUser(null);
      return null;
    }
    
    return token;
  };

  // Auth context value
  const value = {
    user,
    loading,
    error,
    login,
    signup,
    logout,
    getToken,
    isAuthenticated: !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
