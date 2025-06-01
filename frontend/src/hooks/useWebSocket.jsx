import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Custom hook for WebSocket connections with authentication
 * @param {string} url - The WebSocket URL to connect to
 * @returns {Object} WebSocket state and methods
 */
const useWebSocket = (url) => {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const { getToken } = useAuth();
  
  // Use a ref to maintain WebSocket instance across renders
  const webSocketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 2000;
  
  // Cleanup function to close WebSocket connection
  const closeConnection = useCallback(() => {
    if (webSocketRef.current) {
      webSocketRef.current.close();
      webSocketRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);
  
  // Connect to WebSocket server with authentication
  const connectWebSocket = useCallback(() => {
    closeConnection();
    
    // Get authentication token
    const token = getToken();
    if (!token) {
      setError('Not authenticated - please log in again');
      return;
    }
    
    try {
      console.log(`Attempting to connect to WebSocket at: ${url}`);
      
      // Add authentication token to URL as query parameter
      const urlWithAuth = `${url}?token=${token}`;
      const ws = new WebSocket(urlWithAuth);
      
      // Set a connection timeout
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.error('WebSocket connection timeout');
          ws.close();
          setError('Connection timeout - server might be unavailable');
        }
      }, 5000); // 5 second timeout
      
      ws.onopen = () => {
        console.log('WebSocket connected successfully');
        clearTimeout(connectionTimeout);
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
      };
      
      ws.onmessage = (event) => {
        try {
          console.log('WebSocket message received:', event.data);
          const data = JSON.parse(event.data);
          setMessages((prevMessages) => [...prevMessages, data]);
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };
      
      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        clearTimeout(connectionTimeout);
        setError('Connection error - please check if the server is running');
      };
      
      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        clearTimeout(connectionTimeout);
        setIsConnected(false);
        
        // Common close codes and their meanings
        const closeReasons = {
          1000: 'Normal closure',
          1001: 'Going away',
          1002: 'Protocol error',
          1003: 'Unsupported data',
          1008: 'Policy violation',
          1011: 'Server error',
        };
        
        const reason = closeReasons[event.code] || event.reason || 'Unknown reason';
        console.log(`WebSocket closed: ${reason} (${event.code})`);
        
        // Attempt to reconnect if not closed cleanly
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`Reconnecting... Attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}`);
            connectWebSocket();
          }, RECONNECT_DELAY * reconnectAttemptsRef.current); // Exponential backoff
        } else {
          setError(`Connection lost - refresh the page to try again (${reason})`);
        }
      };
      
      webSocketRef.current = ws;
    } catch (err) {
      console.error('Error creating WebSocket connection:', err);
      setError(`Connection failed: ${err.message}`);
    }
  }, [url, getToken, closeConnection]);
  
  // Initialize WebSocket connection
  useEffect(() => {
    connectWebSocket();
    
    // Cleanup on unmount
    return closeConnection;
  }, [connectWebSocket, closeConnection]);
  
  // Send message via WebSocket
  const sendMessage = useCallback((message) => {
    if (!webSocketRef.current || webSocketRef.current.readyState !== WebSocket.OPEN) {
      // Try to reconnect if disconnected
      setError('WebSocket not connected. Attempting to reconnect...');
      connectWebSocket();
      return false;
    }
    
    try {
      webSocketRef.current.send(JSON.stringify(message));
      return true;
    } catch (err) {
      console.error('Error sending message:', err);
      setError(`Failed to send message: ${err.message}`);
      return false;
    }
  }, [connectWebSocket]);
  
  return {
    isConnected,
    messages,
    error,
    sendMessage,
    clearMessages: () => setMessages([]),
    reconnect: connectWebSocket
  };
};

export default useWebSocket;
