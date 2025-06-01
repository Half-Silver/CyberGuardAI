import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';

// WebSocket server URL - connect to Node.js backend
const WS_SERVER_URL = process.env.REACT_APP_WS_URL || (window.location.protocol === 'https:' 
  ? `wss://${window.location.host}` 
  : `ws://${window.location.hostname}:8002`);

// Constants
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds
const MAX_RECONNECT_ATTEMPTS = 10;
const JITTER_FACTOR = 0.3; // 30% jitter

// Create context
const WebSocketContext = createContext(null);

// Hook to use the WebSocket context
export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider = ({ children }) => {
  // State
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [rateLimitInfo, setRateLimitInfo] = useState({
    isRateLimited: false,
    retryAfter: null,
    retryAt: null
  });
  
  // Refs
  const socketRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const isMounted = useRef(true);
  const reconnectTimeoutRef = useRef(null);
  const lastConnectTime = useRef(0);
  const eventListeners = useRef(new Map());
  const connectRef = useRef();

  // Get auth token from localStorage
  const getAuthToken = useCallback(() => {
    try {
      if (typeof window === 'undefined') return null;
      const authData = localStorage.getItem('cyberguard_auth');
      if (!authData) return null;
      
      const { token } = JSON.parse(authData);
      return token || null;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }, []);

  // Clean up socket connection and event listeners
  const cleanup = useCallback(({ keepState = false } = {}) => {
    if (socketRef.current) {
      // Remove all event listeners
      eventListeners.current.forEach((handler, event) => {
        socketRef.current.off(event, handler);
      });
      eventListeners.current.clear();

      // Disconnect the socket
      if (socketRef.current.connected) {
        socketRef.current.disconnect();
      }

      // Clear the socket reference
      socketRef.current = null;
    }

    // Clear any pending reconnection timeouts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Reset state if not keeping it
    if (!keepState) {
      setSocket(null);
      setConnected(false);
      setConnectionStatus('disconnected');
    }
  }, []);

  // Calculate delay with exponential backoff and jitter
  const calculateReconnectDelay = useCallback((attempt) => {
    const baseDelay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, attempt - 1),
      MAX_RECONNECT_DELAY
    );
    
    // Add jitter to prevent thundering herd problem
    const jitter = baseDelay * JITTER_FACTOR * (Math.random() * 2 - 1);
    return Math.min(Math.max(INITIAL_RECONNECT_DELAY, baseDelay + jitter), MAX_RECONNECT_DELAY);
  }, []);

  // Handle rate limiting
  const handleRateLimit = useCallback((retryAfter) => {
    if (!isMounted.current) return;
    
    const retryAt = new Date(Date.now() + (retryAfter * 1000));
    setRateLimitInfo({
      isRateLimited: true,
      retryAfter,
      retryAt
    });

    // Auto-clear rate limit after the delay
    const timeoutId = setTimeout(() => {
      if (isMounted.current) {
        setRateLimitInfo({
          isRateLimited: false,
          retryAfter: null,
          retryAt: null
        });
      }
    }, retryAfter * 1000);

    return () => clearTimeout(timeoutId);
  }, []);

  // Safe event listener management
  const addEventListener = useCallback((event, handler) => {
    if (!socketRef.current) return;
    
    // Remove existing listener if any
    if (eventListeners.current.has(event)) {
      socketRef.current.off(event, eventListeners.current.get(event));
    }
    
    // Add new listener
    eventListeners.current.set(event, handler);
    socketRef.current.on(event, handler);
  }, []);

  // Handle reconnection logic with exponential backoff and jitter
  const handleReconnect = useCallback(() => {
    if (!isMounted.current) return;
    
    // Clear any existing timeout to prevent multiple reconnection attempts
    if (reconnectTimeoutRef.current) {
      console.log('[WebSocket] Clearing existing reconnection attempt');
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Check max attempts
    if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
      const errorMsg = `Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached`;
      console.error(`[WebSocket] ${errorMsg}`);
      setError(new Error(errorMsg));
      setConnectionStatus('error');
      return;
    }
    
    const attempt = reconnectAttempts.current + 1;
    const delay = calculateReconnectDelay(attempt);
    
    console.log(`[WebSocket] Will attempt to reconnect in ${Math.round(delay)}ms (attempt ${attempt}/${MAX_RECONNECT_ATTEMPTS})`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (!isMounted.current) return;
      
      console.log(`[WebSocket] Attempting to reconnect (attempt ${attempt}/${MAX_RECONNECT_ATTEMPTS})`);
      
      // Only try to connect if we have a valid token
      const token = getAuthToken();
      if (!token) {
        console.warn('[WebSocket] No auth token available for reconnection');
        setError(new Error('No authentication token available'));
        return;
      }
      
      // Check rate limiting before attempting to reconnect
      if (rateLimitInfo.isRateLimited) {
        const retryAfter = rateLimitInfo.retryAfter || 5;
        console.log(`[WebSocket] Rate limited, will retry after ${retryAfter}s`);
        
        // Schedule next attempt after rate limit resets
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttempts.current = 0; // Reset attempts after rate limit
          handleReconnect();
        }, retryAfter * 1000);
        
        return;
      }
      
      // Increment attempts only when actually attempting to reconnect
      reconnectAttempts.current = attempt;
      
      // Trigger a new connection attempt
      if (connectRef.current) {
        connectRef.current();
      }
    }, delay);
    
    // Return cleanup function to clear the timeout if needed
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [calculateReconnectDelay, getAuthToken, rateLimitInfo]);

  // Initialize WebSocket connection
  const connect = useCallback(() => {
    if (!isMounted.current) return;
    
    // Don't try to connect if we're already connected or connecting
    if (socketRef.current?.connected || socketRef.current?.connecting) {
      console.log('[WebSocket] Already connected or connecting, skipping new connection attempt');
      return;
    }
    
    const token = getAuthToken();
    if (!token) {
      const error = new Error('No authentication token found');
      console.warn('[WebSocket]', error.message);
      setError(error);
      setConnectionStatus('error');
      return;
    }
    
    // Clean up any existing connection
    cleanup({ keepState: true });
    
    // Reset connection state
    setConnectionStatus('connecting');
    setError(null);
    
    const options = {
      path: '/socket.io/',
      autoConnect: false, // We'll handle the connection manually
      forceNew: true,
      reconnection: false, // We handle reconnection manually
      transports: ['websocket'], // Start with WebSocket only
      timeout: 10000, // 10 second connection timeout
      query: { token },
      reconnectionAttempts: 0, // Disable built-in reconnection
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5
    };
    
    try {
      console.log('[WebSocket] Creating new connection with options:', {
        ...options,
        query: { token: '***' } // Don't log the actual token
      });
      
      const newSocket = io(WS_SERVER_URL, options);
      socketRef.current = newSocket;
      setSocket(newSocket);
      
      // Set up event handlers
      const onConnect = () => {
        if (!isMounted.current) return;
        
        console.log('[WebSocket] Connected successfully');
        lastConnectTime.current = Date.now();
        
        // Reset reconnection attempts on successful connection
        reconnectAttempts.current = 0;
        
        // Clear any pending reconnection timeouts
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        
        // Update state
        setConnected(true);
        setConnectionStatus('connected');
        setError(null);
        
        // Notify any listeners that we're connected
        newSocket.emit('authenticate', { token: getAuthToken() });
      };

      const onDisconnect = (reason) => {
        if (!isMounted.current) return;
        
        console.log(`[WebSocket] Disconnected: ${reason}`);
        setConnected(false);
        setConnectionStatus('disconnected');
        
        // Only attempt to reconnect if this wasn't an explicit disconnection
        if (reason !== 'io client disconnect' && reason !== 'io server disconnect') {
          console.log(`[WebSocket] Will attempt to reconnect (reason: ${reason})`);
          handleReconnect();
        }
      };

      const onConnectError = (error) => {
        if (!isMounted.current) return;
        
        console.error('[WebSocket] Connection error:', error);
        setError(error);
        setConnectionStatus('error');
        
        // For certain errors, we might want to clean up and try again
        if (error.message.includes('xhr poll error') || 
            error.message.includes('timeout') || 
            error.message.includes('websocket error') ||
            error.message.includes('connection error')) {
          console.log('[WebSocket] Encountered recoverable error, will attempt to reconnect');
          handleReconnect();
        }
      };
      
      const onError = (error) => {
        if (!isMounted.current) return;
        
        console.error('[WebSocket] Socket error:', error);
        setError(error);
        
        // Handle rate limiting
        if (error.code === 429) {
          const retryAfter = error.retryAfter || 5;
          console.warn(`[WebSocket] Rate limited. Retry after ${retryAfter} seconds`);
          handleRateLimit(retryAfter);
        }
      };
      
      // Set up event listeners using our safe wrapper
      addEventListener('connect', onConnect);
      addEventListener('disconnect', onDisconnect);
      addEventListener('connect_error', onConnectError);
      addEventListener('error', onError);
      
      // Handle rate limiting from server
      addEventListener('rate_limit', (data) => {
        if (!isMounted.current) return;
        
        const { remaining, limit, reset } = data;
        const retryAfter = Math.ceil((reset * 1000 - Date.now()) / 1000);
        
        console.log(`[WebSocket] Rate limit update: ${remaining}/${limit} requests remaining, resets in ${retryAfter}s`);
        
        if (remaining <= 0) {
          console.warn(`[WebSocket] Rate limit reached. Retry after ${retryAfter} seconds`);
          handleRateLimit(retryAfter);
        }
      });
      
      // Handle session events
      addEventListener('session', (sessionData) => {
        if (isMounted.current) {
          console.log('[WebSocket] Session updated:', sessionData);
        }
      });
      
      // Start connection
      console.log('[WebSocket] Attempting to connect...');
      newSocket.connect();
      
    } catch (error) {
      const errorMsg = error?.message || 'Failed to connect to WebSocket server';
      console.error('[WebSocket] Connection error:', errorMsg, error);
      
      const connectionError = error instanceof Error ? error : new Error(errorMsg);
      setError(connectionError);
      setConnectionStatus('error');
      
      // Only attempt to reconnect if this was an unexpected disconnect
      if (isMounted.current && !error?.message?.includes('Invalid token')) {
        console.log('[WebSocket] Scheduling reconnection attempt...');
        handleReconnect();
      } else if (error?.message?.includes('Invalid token')) {
        console.error('[WebSocket] Authentication error, not reconnecting:', errorMsg);
      }
    }
  }, [addEventListener, cleanup, getAuthToken, handleRateLimit, handleReconnect]);

  // Disconnect function
  const disconnect = useCallback((reason = 'User requested disconnect') => {
    if (socketRef.current) {
      console.log(`[WebSocket] Disconnecting: ${reason}`);
      
      // Clear any pending reconnection attempts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Only update status if we're actually connected
      if (socketRef.current.connected) {
        setConnectionStatus('disconnecting');
      }
      
      // Reset reconnection attempts
      reconnectAttempts.current = 0;
      
      // Clear rate limiting state
      if (rateLimitInfo.isRateLimited) {
        setRateLimitInfo({
          isRateLimited: false,
          retryAfter: null,
          retryAt: null
        });
      }
      
      socketRef.current.disconnect();
    }
  }, [rateLimitInfo]);

  // Enhanced emit function with rate limiting and error handling
  const emit = useCallback((event, data, callback) => {
    if (!socketRef.current?.connected) {
      const error = new Error('Not connected to WebSocket server');
      console.error('[WebSocket]', error.message);
      if (typeof callback === 'function') {
        callback(error);
      }
      return Promise.reject(error);
    }

    // Check rate limiting
    if (rateLimitInfo.isRateLimited) {
      const error = new Error(`Rate limited. Try again in ${rateLimitInfo.retryAfter} seconds`);
      error.code = 429;
      error.retryAfter = rateLimitInfo.retryAfter;
      console.warn('[WebSocket]', error.message);
      if (typeof callback === 'function') {
        callback(error);
      }
      return Promise.reject(error);
    }

    return new Promise((resolve, reject) => {
      try {
        socketRef.current.emit(event, data, (response) => {
          if (!isMounted.current) return;
          
          if (response?.error) {
            const error = new Error(response.error.message || 'Request failed');
            error.code = response.error.code;
            console.error(`[WebSocket] Error in ${event}:`, error);
            
            // Handle rate limiting from server response
            if (error.code === 429) {
              const retryAfter = response.error.retryAfter || 5;
              console.warn(`[WebSocket] Server rate limited. Retry after ${retryAfter} seconds`);
              handleRateLimit(retryAfter);
            }
            
            if (typeof callback === 'function') {
              callback(null, response);
            }
            reject(error);
          } else {
            if (typeof callback === 'function') {
              callback(null, response);
            }
            resolve(response);
          }
        });
      } catch (error) {
        console.error(`[WebSocket] Error emitting ${event}:`, error);
        if (typeof callback === 'function') {
          callback(error);
        }
        reject(error);
      }
    });
  }, [handleRateLimit, rateLimitInfo]);

  // Set up event listeners and initial connection
  useEffect(() => {
    // Set mounted flag
    isMounted.current = true;
    
    // Set up the connect function ref
    connectRef.current = connect;
    
    // Only attempt to connect if we have a token
    const token = getAuthToken();
    if (token && isMounted.current) {
      console.log('[WebSocket] Initial connection attempt');
      connect();
    } else {
      console.log('[WebSocket] No auth token available for initial connection');
    }
    
    // Cleanup on unmount
    return () => {
      console.log('[WebSocket] Cleaning up WebSocket provider');
      isMounted.current = false;
      
      // Clear any pending timeouts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Clean up socket connection
      cleanup();
    };
  }, [connect, cleanup, getAuthToken]);
  
  // Effect to handle token changes
  useEffect(() => {
    if (!isMounted.current) return;
    
    const token = getAuthToken();
    if (!token) {
      console.warn('[WebSocket] No auth token available for WebSocket connection');
      setError(new Error('No authentication token available'));
      return;
    }
    
    if (socketRef.current) {
      console.log('[WebSocket] Updating WebSocket connection with new token');
      
      // Update query with new token
      socketRef.current.io.opts.query = { token };
      
      // If disconnected, try to reconnect with new token
      if (socketRef.current.disconnected) {
        console.log('[WebSocket] Reconnecting with new token...');
        socketRef.current.connect();
      }
    }
  }, [getAuthToken]);

  // Return the context value
  const value = useMemo(() => ({
    socket,
    connected,
    error,
    connectionStatus,
    rateLimitInfo,
    connect,
    disconnect,
    emit,
    addEventListener,
    isConnected: connected,
    isConnecting: connectionStatus === 'connecting',
    isDisconnected: connectionStatus === 'disconnected',
    isError: connectionStatus === 'error'
  }), [
    socket,
    connected,
    error,
    connectionStatus,
    rateLimitInfo,
    connect,
    disconnect,
    emit,
    addEventListener
  ]);

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketContext;
