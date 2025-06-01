import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';

// WebSocket server URL - connect to Node.js backend
const WS_SERVER_URL = window.location.protocol === 'https:' 
  ? `wss://${window.location.host}` 
  : `ws://${window.location.hostname}:8002`;

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
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  
  const socketRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;
  const isMounted = useRef(true);
  const reconnectTimeoutRef = useRef(null);

  // Get auth token from localStorage
  const getAuthToken = useCallback(() => {
    try {
      if (typeof window === 'undefined') return null;
      
      const authData = localStorage.getItem('cyberguard_auth');
      if (!authData) return null;
      
      const parsed = JSON.parse(authData);
      return parsed?.token || null;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('[WebSocket] Starting cleanup');
    
    // Clear any pending reconnection attempts
    if (reconnectTimeoutRef.current) {
      console.log('[WebSocket] Clearing reconnect timeout');
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const currentSocket = socketRef.current;
    if (currentSocket) {
      console.log('[WebSocket] Cleaning up socket connection');
      
      // Remove all event listeners to prevent memory leaks
      currentSocket.off('connect');
      currentSocket.off('disconnect');
      currentSocket.off('connect_error');
      currentSocket.off('error');
      currentSocket.off('session');
      
      // Only disconnect if socket is connected
      if (currentSocket.connected) {
        console.log('[WebSocket] Disconnecting socket');
        currentSocket.disconnect();
      }
      
      socketRef.current = null;
      setSocket(null);
      setConnected(false);
      setConnectionStatus('disconnected');
      console.log('[WebSocket] Cleanup completed');
    } else {
      console.log('[WebSocket] No active socket to clean up');
    }
  }, []);

  // Create a ref to store the latest connect function
  const connectRef = useRef();
  
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
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      const errorMsg = `Max reconnection attempts (${maxReconnectAttempts}) reached`;
      console.error(`[WebSocket] ${errorMsg}`);
      setError(new Error(errorMsg));
      setConnectionStatus('disconnected');
      return;
    }
    
    // Calculate delay with exponential backoff and jitter
    const baseDelay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
    const jitter = Math.random() * 1000; // Add up to 1s of jitter
    const delay = Math.floor(baseDelay + jitter);
    const attempt = reconnectAttempts.current + 1;
    
    console.log(`[WebSocket] Will attempt to reconnect in ${delay}ms (attempt ${attempt}/${maxReconnectAttempts})`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (!isMounted.current) return;
      
      console.log(`[WebSocket] Attempting to reconnect (attempt ${attempt}/${maxReconnectAttempts})`);
      
      // Only try to connect if we have a valid token
      const token = getAuthToken();
      if (!token) {
        console.warn('[WebSocket] No auth token available for reconnection');
        setError(new Error('No authentication token available'));
        return;
      }
      
      // Increment attempts only when actually attempting to reconnect
      reconnectAttempts.current = attempt;
      
      // Trigger a new connection attempt using the ref
      if (connectRef.current) {
        connectRef.current();
      } else {
        console.error('[WebSocket] Connect ref is not available');
        setError(new Error('Connection handler not available'));
      }
    }, delay);
    
    // Return cleanup function to clear the timeout if needed
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [getAuthToken]);

  // Initialize WebSocket connection
  const connect = useCallback(() => {
    if (!isMounted.current) return;
    
    // Don't try to connect if we're already connected or connecting
    if (socketRef.current?.connected || socketRef.current?.connecting) {
      console.log('[WebSocket] Already connected or connecting, skipping new connection attempt');
      return;
    }
    
    // Clean up any existing connection
    cleanup();
    
    const token = getAuthToken();
    if (!token) {
      console.warn('[WebSocket] No auth token found, cannot connect');
      setError(new Error('No authentication token found'));
      return;
    }
    
    const options = {
      path: '/socket.io/',
      autoConnect: false, // We'll connect manually
      forceNew: true,
      reconnection: false, // We'll handle reconnection manually
      transports: ['websocket'],
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
      setConnectionStatus('connecting');
      
      // Set up event handlers
      const onConnect = () => {
        if (!isMounted.current) return;
        
        console.log('[WebSocket] Connected successfully');
        
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
      
      // Set up event listeners
      newSocket.on('connect', onConnect);
      newSocket.on('disconnect', onDisconnect);
      newSocket.on('connect_error', onConnectError);
      newSocket.on('error', (error) => {
        if (!isMounted.current) return;
        console.error('[WebSocket] Socket error:', error);
        setError(error);
      });
      
      // Handle session events
      newSocket.on('session', (sessionData) => {
        if (isMounted.current) {
          console.log('[WebSocket] Session updated:', sessionData);
        }
      });
      
      // Start connection
      console.log('[WebSocket] Attempting to connect...');
      newSocket.connect();
      
      // Store cleanup function
      return () => {
        if (newSocket) {
          console.log('[WebSocket] Cleaning up socket event listeners');
          newSocket.off('connect', onConnect);
          newSocket.off('disconnect', onDisconnect);
          newSocket.off('connect_error', onConnectError);
          newSocket.off('error');
          newSocket.off('session');
        }
      };
    } catch (error) {
      console.error('[WebSocket] Error creating connection:', error);
      setError(error instanceof Error ? error : new Error(String(error)));
      setConnectionStatus('error');
      
      // Attempt to reconnect on error
      if (isMounted.current) {
        handleReconnect();
      }
      
      return null;
    }
  }, [cleanup, getAuthToken, handleReconnect]);
  
  // Update the connect ref whenever the connect function changes
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);
  

  
  // Disconnect function
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('[WebSocket] Disconnecting...');
      socketRef.current.disconnect();
    }
  }, []);
  
  // Effect to handle component mount/unmount
  useEffect(() => {
    // Set mounted flag
    isMounted.current = true;
    
    // Initial connection
    console.log('[WebSocket] Component mounting, connecting...');
    connect();
    
    // Cleanup function
    return () => {
      console.log('[WebSocket] Component unmounting');
      isMounted.current = false;
      
      // Clear any pending reconnection attempts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Clean up socket connection
      cleanup();
    };
  }, [connect, cleanup]);

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
    connect,
    disconnect,
  }), [socket, connected, error, connectionStatus, connect, disconnect]);
  
  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketContext;
