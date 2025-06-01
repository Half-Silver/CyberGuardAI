import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const useWebSocket = (url) => {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const { getToken, logout } = useAuth();
  const socketRef = useRef(null);

  // Connect to WebSocket
  const connect = useCallback(() => {
    try {
      const token = getToken();
      if (!token) {
        setError('Authentication required');
        return;
      }

      // Append token to URL
      const fullUrl = `${url}?token=${encodeURIComponent(token)}`;
      console.log('Connecting to WebSocket:', fullUrl);
      
      // Create WebSocket connection
      const socket = new WebSocket(fullUrl);
      socketRef.current = socket;

      // Connection opened
      socket.addEventListener('open', () => {
        console.log('WebSocket connection established');
        setIsConnected(true);
        setError(null);
      });

      // Listen for messages
      socket.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Message from server:', data);
          
          if (data.type === 'error' && 
              (data.message?.includes('Authentication') || 
               data.message?.includes('token'))) {
            // Authentication error
            setError(data.message);
            logout();
            return;
          }
          
          // Add message to state
          setMessages(prev => [...prev, data]);
        } catch (err) {
          console.error('Error parsing message:', err);
        }
      });

      // Connection error
      socket.addEventListener('error', (event) => {
        console.error('WebSocket error:', event);
        setError('Connection error');
        setIsConnected(false);
      });

      // Connection closed
      socket.addEventListener('close', (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        setIsConnected(false);
        
        if (event.code === 1008) {
          // Policy violation - likely authentication issue
          setError('Authentication failed');
          logout();
        } else if (!event.wasClean) {
          setError('Connection lost');
        }
      });

      return () => {
        // Clean up on unmount
        if (socket.readyState === WebSocket.OPEN) {
          socket.close();
        }
      };
    } catch (err) {
      console.error('Error setting up WebSocket:', err);
      setError('Failed to connect');
      return () => {};
    }
  }, [url, getToken, logout]);

  // Connect on mount and reconnect when auth token changes
  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);

  // Send message through WebSocket
  const sendMessage = useCallback((message) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setError('Not connected');
      return false;
    }

    try {
      socketRef.current.send(JSON.stringify(message));
      return true;
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
      return false;
    }
  }, []);

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    isConnected,
    messages,
    error,
    sendMessage,
    clearMessages,
    connect
  };
};

export default useWebSocket;
