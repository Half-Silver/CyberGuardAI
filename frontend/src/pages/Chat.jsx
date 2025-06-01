import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import ChatHeader from '../components/layout/ChatHeader';
import ChatMessage from '../components/chat/ChatMessage';
import ChatInput from '../components/chat/ChatInput';
import Sidebar from '../components/layout/Sidebar';
import AnimatedMessage from '../components/chat/AnimatedMessage';
import {
  fetchChatHistory,
  createSession,
  getChatSessions,
  deleteSession
} from '../api/chatService';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { FiAlertTriangle, FiShield, FiCpu, FiInfo, FiUser, FiLoader, FiChevronDown, FiChevronUp } from 'react-icons/fi';

// Component to render code blocks with syntax highlighting
const CodeBlock = ({ node, inline, className, children, ...props }) => {
  const match = /language-(\w+)/.exec(className || '');
  return !inline && match ? (
    <SyntaxHighlighter
      style={atomDark}
      language={match[1]}
      PreTag="div"
      {...props}
    >
      {String(children).replace(/\n$/, '')}
    </SyntaxHighlighter>
  ) : (
    <code className={className} {...props}>
      {children}
    </code>
  );
};

const Chat = () => {
  const { sessionId } = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const { socket, connect, disconnect, connected } = useWebSocket();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  // Refs
  const debouncedMessageUpdate = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const latestMessageId = useRef(null); // Track the latest message ID for streaming

  // State
  const [sessions, setSessions] = useState([]);
  const [activeThreatLevel, setActiveThreatLevel] = useState(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingContent, setTypingContent] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState(process.env.REACT_APP_OPENROUTER_MODEL_NAME || 'nvidia/llama-3.1-nemotron-ultra-253b-v1:free');

  // Add global styles for animations and indicators
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      @keyframes bounce {
        0%, 80%, 100% { 
          transform: translateY(0);
        } 
        40% { 
          transform: translateY(-6px);
        }
      }
      
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      @keyframes streaming {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(400%); }
      }
      
      .animate-fade-in {
        animation: fadeIn 0.3s ease-out forwards;
      }
      
      .typing-indicator {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        height: 16px;
      }
      
      .typing-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background-color: currentColor;
        animation: bounce 1.4s infinite ease-in-out both;
      }
      
      .typing-dot:nth-child(1) { animation-delay: -0.32s; }
      .typing-dot:nth-child(2) { animation-delay: -0.16s; }
      
      .animate-streaming {
        position: absolute;
        height: 100%;
        width: 25%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
        animation: streaming 1.5s infinite linear;
      }
      
      /* Smooth scrolling for message container */
      .messages-container {
        scroll-behavior: smooth;
        overflow-anchor: none;
      }
      
      /* Custom scrollbar for WebKit browsers */
      .messages-container::-webkit-scrollbar {
        width: 6px;
      }
      
      .messages-container::-webkit-scrollbar-track {
        background: transparent;
      }
      
      .messages-container::-webkit-scrollbar-thumb {
        background-color: rgba(156, 163, 175, 0.5);
        border-radius: 3px;
      }
      
      .messages-container::-webkit-scrollbar-thumb:hover {
        background-color: rgba(156, 163, 175, 0.7);
      }
    `;
    document.head.appendChild(styleElement);
    return () => document.head.removeChild(styleElement);
  }, []);

  // Track processed chunks and pending updates
  const processedChunks = useRef(new Set());
  const pendingChunks = useRef({});
  const lastProcessedTime = useRef(0);
  const animationFrameId = useRef(null);
  const isProcessing = useRef(false);
  const animationIntervals = useRef({}); // Track animation intervals per message

  // Process pending chunks with requestAnimationFrame for smooth animation
  const processPendingChunks = useCallback(() => {
    if (isProcessing.current) return;
    
    const now = Date.now();
    const timeSinceLastProcess = now - lastProcessedTime.current;
    const minProcessDelay = 16; // ~60fps
    
    // If we're processing too fast, schedule next frame
    if (timeSinceLastProcess < minProcessDelay) {
      if (!animationFrameId.current) {
        animationFrameId.current = requestAnimationFrame(processPendingChunks);
      }
      return;
    }
    
    isProcessing.current = true;
    
    // Process each message with pending chunks
    Object.entries(pendingChunks.current).forEach(([messageId, chunks]) => {
      if (!chunks || chunks.length === 0) return;
      
      // Get the full content from all chunks
      const combinedContent = chunks.join('');
      
      // Update the message with the combined content
      setMessages(prevMessages => {
        const messageIndex = prevMessages.findIndex(m => m.id === messageId);
        if (messageIndex === -1) return prevMessages;
        
        const currentMessage = prevMessages[messageIndex];
        
        // Only update if content has changed
        if (currentMessage.content === combinedContent) return prevMessages;
        
        const updatedMessages = [...prevMessages];
        updatedMessages[messageIndex] = {
          ...currentMessage,
          content: combinedContent,
          isTyping: true,
          isStreaming: true,
          lastUpdated: Date.now()
        };
        
        return updatedMessages;
      });
      
      // Clear processed chunks for this message
      pendingChunks.current[messageId] = [];
    });
    
    lastProcessedTime.current = now;
    isProcessing.current = false;
    
    // Schedule next frame if there are still pending chunks
    const hasPendingChunks = Object.values(pendingChunks.current).some(chunks => chunks && chunks.length > 0);
    if (hasPendingChunks) {
      animationFrameId.current = requestAnimationFrame(processPendingChunks);
    } else {
      animationFrameId.current = null;
    }
  }, []);
  
  // Handle streaming chunks with buffering and deduplication
  const handleStreamingChunk = useCallback((data) => {
    if (!data?.messageId) return;
    
    const messageId = data.messageId;
    const chunk = data.chunk || '';
    const isDone = !!data.done;
    const isError = !!data.error;
    const chunkId = data.chunkId;
    
    // Skip if we've already processed this chunk
    if (chunkId && processedChunks.current.has(chunkId)) {
      return;
    }
    
    // Mark this chunk as processed
    if (chunkId) {
      processedChunks.current.add(chunkId);
    }
    
    // Initialize pending chunks for this message if needed
    if (!pendingChunks.current[messageId]) {
      pendingChunks.current[messageId] = [];
    }
    
    // Add chunk to buffer
    if (chunk) {
      pendingChunks.current[messageId].push(chunk);
    }
    
    // Schedule processing of chunks
    if (!animationFrameId.current) {
      animationFrameId.current = requestAnimationFrame(processPendingChunks);
    }
    
    // Handle message completion or error
    if (isDone || isError) {
      setMessages(prevMessages => {
        const messageIndex = prevMessages.findIndex(m => m.id === messageId);
        if (messageIndex === -1) return prevMessages;
        
        const updatedMessages = [...prevMessages];
        updatedMessages[messageIndex] = {
          ...updatedMessages[messageIndex],
          isTyping: false,
          isStreaming: false,
          error: isError ? 'Error processing response' : null,
          lastUpdated: Date.now()
        };
        
        return updatedMessages;
      });
      
      // Clean up
      if (chunkId) {
        processedChunks.current.delete(chunkId);
      }
      delete pendingChunks.current[messageId];
    }
  }, [processPendingChunks]);
  
  // ChatGPT-like typing animation
  const animateTyping = useCallback((messageId, fullText, onComplete) => {
    // Clear any existing animation for this message
    if (animationIntervals.current[messageId]) {
      cancelAnimationFrame(animationIntervals.current[messageId]);
    }

    let currentText = '';
    let currentIndex = 0;
    let lastRenderTime = 0;
    let isFirstRender = true;
    const typingSpeed = 15; // Milliseconds per character (lower = faster)
    const maxChunkSize = 3; // Maximum characters to add in one frame
    
    // Start with empty content
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, content: '', isTyping: true }
        : msg
    ));
    
    // Small delay before starting to type
    setTimeout(() => {
      const typeCharacter = (timestamp) => {
        if (!lastRenderTime) lastRenderTime = timestamp;
        const elapsed = timestamp - lastRenderTime;
        
        if (elapsed >= typingSpeed) {
          // Add characters in chunks for better performance
          const charsToAdd = Math.min(
            maxChunkSize,
            fullText.length - currentIndex
          );
          
          if (charsToAdd > 0) {
            currentText += fullText.substr(currentIndex, charsToAdd);
            currentIndex += charsToAdd;
            
            setMessages(prev => {
              const updatedMessages = prev.map(msg => {
                if (msg.id === messageId) {
                  return {
                    ...msg,
                    content: currentText,
                    isTyping: true,
                    lastUpdated: Date.now()
                  };
                }
                return msg;
              });
              
              // Smooth scrolling
              const container = document.querySelector('.messages-container');
              if (container) {
                const { scrollTop, scrollHeight, clientHeight } = container;
                const isNearBottom = scrollHeight - (scrollTop + clientHeight) < 100;
                if (isNearBottom) {
                  container.scrollTop = scrollHeight;
                }
              }
              
              return updatedMessages;
            });
            
            lastRenderTime = timestamp;
          } else {
            // Typing complete
            if (onComplete) onComplete();
            return;
          }
        }
        
        // Continue animation
        animationFrameId.current = requestAnimationFrame(typeCharacter);
      };
      
      // Start typing animation
      animationFrameId.current = requestAnimationFrame(typeCharacter);
      animationIntervals.current[messageId] = animationFrameId.current;
      
    }, isFirstRender ? 300 : 0); // Initial delay only on first render
    
    isFirstRender = false;
  }, []);

  // Clean up animation frame and intervals on unmount
  useEffect(() => {
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      // Clear all animation intervals
      Object.values(animationIntervals.current).forEach(interval => {
        clearInterval(interval);
      });
      animationIntervals.current = {};
    };
  }, []);

  // WebSocket connection management and event handling
  useEffect(() => {
    if (!socket || !user) return;

    // Connection status handler
    const handleConnect = () => {
      console.log('[Chat] WebSocket connected');
      // Clear any pending messages or states on new connection
      setMessages(prev => prev.map(msg => ({
        ...msg,
        isTyping: false,
        isStreaming: false
      })));
    };

    // Disconnection handler
    const handleDisconnect = (reason) => {
      console.log(`[Chat] WebSocket disconnected: ${reason}`);
      // Update any ongoing streaming messages
      setMessages(prev => prev.map(msg => ({
        ...msg,
        isTyping: false,
        isStreaming: false
      })));
    };

    // Error handler
    const handleError = (error) => {
      console.error('[Chat] WebSocket error:', error);
      // Update any ongoing streaming messages
      setMessages(prev => prev.map(msg => ({
        ...msg,
        isTyping: false,
        isStreaming: false,
        error: msg.isTyping || msg.isStreaming ? 'Connection error' : msg.error
      })));
    };

    // Typing status handler
    const handleTypingStatus = (data) => {
      // Handle typing status updates
      if (data && data.messageId) {
        setMessages(prev => {
          const messageIndex = prev.findIndex(m => m.id === data.messageId);
          if (messageIndex === -1) return prev;
          
          const updatedMessages = [...prev];
          updatedMessages[messageIndex] = {
            ...updatedMessages[messageIndex],
            isTyping: !!data.isTyping,
            lastUpdated: Date.now()
          };
          
          return updatedMessages;
        });
      }
    };

    // Set up event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleError);
    socket.on('error', handleError);
    socket.on('ai_response', handleStreamingChunk);
    socket.on('typing_status', handleTypingStatus);
    
    // Initial connection if not connected
    if (!socket.connected) {
      socket.connect();
    }
    
    // Cleanup function
    return () => {
      if (!socket) return;
      
      // Remove all event listeners
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleError);
      socket.off('error', handleError);
      socket.off('ai_response', handleStreamingChunk);
      socket.off('typing_status', handleTypingStatus);
      
      // Clean up any pending animations or timeouts
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      
      if (debouncedMessageUpdate.current) {
        clearTimeout(debouncedMessageUpdate.current);
        debouncedMessageUpdate.current = null;
      }
    };
  }, [socket, handleStreamingChunk]);

  // Message handling with optimized state updates
  useEffect(() => {
    if (!socket) return;

    // Track the latest message ID to handle out-of-order updates
    latestMessageId.current = null;

    const handleAIResponse = (data) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Chat] Received AI response:', data);
      }
      
      const messageId = data.messageId;
      const newContent = data.message || data.content || '';
      const isError = !!data.error;
      
      // If this is a streaming chunk, handle it separately
      if (data.chunk !== undefined) {
        handleStreamingChunk(data);
        return;
      }
      
      setMessages(prevMessages => {
        const messageIndex = prevMessages.findIndex(m => m.id === messageId);
        
        // If this is a new message, add it
        if (messageIndex === -1) {
          return [
            ...prevMessages,
            {
              id: messageId,
              sessionId: data.sessionId || 'temp',
              content: newContent,
              role: 'assistant',
              isTyping: !isError && !data.done,
              isStreaming: false, // Non-chunked messages are not streaming
              shouldAnimate: true,
              timestamp: new Date().toISOString(),
              lastUpdated: Date.now(),
              model: data.model,
              error: isError
            }
          ];
        }
        
        // Only update if there are actual changes
        const currentMessage = prevMessages[messageIndex];
        
        if (currentMessage.content === newContent && 
            currentMessage.isTyping === !isError && 
            currentMessage.error === isError) {
          return prevMessages; // No changes needed
        }
        
        const updatedMessages = [...prevMessages];
        updatedMessages[messageIndex] = {
          ...currentMessage,
          content: newContent,
          isTyping: !isError && !data.done,
          isStreaming: false, // Non-chunked messages are not streaming
          error: isError,
          lastUpdated: Date.now(),
          model: data.model || currentMessage.model
        };
        
        return updatedMessages;
      });
      
      // If this is the last chunk, clean up
      if (data.done || isError) {
        processedChunks.current.delete(messageId);
        delete pendingChunks.current[messageId];
      }
    };

    // Function to process streaming chunks with improved buffering and deduplication
    const processStreamingChunk = (data) => {
      const chunk = (data.chunk || data.content || '').trim();
      const isDone = data.done || false;
      const messageId = data.messageId;
      
      if (!messageId) return;
      
      // Update the latest message ID
      latestMessageId.current = messageId;
      
      // Generate a unique chunk ID for deduplication
      const chunkId = `${messageId}-${chunk.substring(0, 20)}-${chunk.length}`;
      
      // Skip if we've already processed this exact chunk
      if (processedChunks.current.has(chunkId)) {
        return;
      }
      
      // Mark this chunk as processed
      processedChunks.current.add(chunkId);
      
      // Clean the chunk of any malformed characters or excessive whitespace
      const cleanChunk = chunk
        .replace(/[\u200B-\u200F\uFEFF]/g, '') // Remove zero-width spaces
        .replace(/[^\x00-\x7F\s]/g, '') // Remove non-ASCII but keep spaces and newlines
        .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
        .trim();
      
      if (!cleanChunk) return;
      
      // Initialize pending chunks array for this message if it doesn't exist
      if (!pendingChunks.current[messageId]) {
        pendingChunks.current[messageId] = [];
      }
      
      // Add the cleaned chunk to pending
      pendingChunks.current[messageId].push(cleanChunk);
      
      // Start processing if not already in progress
      if (!animationFrameId.current) {
        animationFrameId.current = requestAnimationFrame(processPendingChunks);
      }
      
      // If this is the final chunk, update the message to mark it as complete
      if (isDone) {
        setMessages(prevMessages => {
          const messageIndex = prevMessages.findIndex(m => m.id === messageId);
          if (messageIndex === -1) return prevMessages;
          
          const currentMessage = prevMessages[messageIndex];
          
          // Only update if needed
          if (!currentMessage.isTyping && !currentMessage.isStreaming) {
            return prevMessages;
          }
          
          const updatedMessages = [...prevMessages];
          updatedMessages[messageIndex] = {
            ...currentMessage,
            isTyping: false,
            isStreaming: false,
            lastUpdated: Date.now()
          };
          
          return updatedMessages;
        });
        
        // Clean up
        processedChunks.current.delete(messageId);
        delete pendingChunks.current[messageId];
      }
    };

    const handleStreamingResponse = (data) => {
      try {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[Chat] Received streaming chunk:', data);
        }
        
        // Validate the message format
        if (!data || typeof data !== 'object') {
          console.warn('Received invalid message format:', data);
          return;
        }
        
        // Process the chunk
        processStreamingChunk(data);
        
        // Smooth scroll to bottom
        requestAnimationFrame(() => {
          const messagesContainer = document.querySelector('.messages-container');
          if (messagesContainer) {
            messagesContainer.scrollTo({
              top: messagesContainer.scrollHeight,
              behavior: 'smooth'
            });
          }
        });
      } catch (error) {
        console.error('Error processing streaming response:', error);
      }
    };

    const handleTypingStatus = (data) => {
      if (data.isTyping) {
        setIsTyping(true);
        setTypingContent(data.content || '');
      } else {
        setIsTyping(false);
        setTypingContent('');
      }
    };

    const errorHandler = (error) => {
      console.error('[Chat] WebSocket error:', error);
      setError(error);
      
      // If we get a connection error, try to reconnect
      if (error.message?.includes('connect') || error.message?.includes('timeout')) {
        console.log('[Chat] Attempting to reconnect WebSocket...');
        setTimeout(() => {
          if (socket && typeof socket.connect === 'function') {
            socket.connect();
          }
        }, 1000);
      }
    };

    socket.on('ai_response', handleAIResponse);
    socket.on('stream_chunk', handleStreamingResponse);
    socket.on('typing_status', handleTypingStatus);
    socket.on('error', errorHandler);
    socket.on('disconnect', (reason) => {
      console.log(`[Chat] WebSocket disconnected: ${reason}`);
      if (reason === 'io server disconnect') {
        // The server has forcefully disconnected the socket
        console.log('[Chat] Server disconnected, attempting to reconnect...');
        setTimeout(() => {
          if (socket && typeof socket.connect === 'function') {
            socket.connect();
          }
        }, 1000);
      }
    });

    // Clean up event listeners on unmount
    return () => {
      if (socket) {
        socket.off('ai_response', handleAIResponse);
        socket.off('stream_chunk', handleStreamingResponse);
        socket.off('typing_status', handleTypingStatus);
        socket.off('error', errorHandler);
        socket.off('disconnect');
      }
    };
  }, [socket]);

  // Load chat history when session changes
  useEffect(() => {
    if (!sessionId) return;
    
    const loadHistory = async () => {
      try {
        const history = await fetchChatHistory(sessionId);
        setMessages(history.messages || []);
      } catch (error) {
        console.error('Error loading chat history:', error);
      }
    };
    
    loadHistory();
  }, [sessionId]);

  // Load chat sessions
  const loadChatSessions = useCallback(async () => {
    if (!user) return;
    
    setIsLoadingSessions(true);
    try {
      const userSessions = await getChatSessions(user.id);
      setSessions(userSessions);
    } catch (error) {
      console.error('Error loading chat sessions:', error);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [user]);

  // Handle new chat
  const handleNewChat = async () => {
    if (!user) return;
    
    try {
      const newSession = await createSession(user.id, 'New Chat');
      setSessions(prev => [newSession, ...prev]);
      navigate(`/chat/${newSession.id}`);
    } catch (error) {
      console.error('Error creating new chat:', error);
    }
  };

  // Handle delete session
  const handleDeleteSession = async (id, e) => {
    e.stopPropagation();
    
    try {
      await deleteSession(id);
      setSessions(prev => prev.filter(session => session.id !== id));
      if (sessionId === id) {
        navigate('/chat');
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  // Toggle sidebar
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Handle model change
  const handleModelChange = (modelId) => {
    setSelectedModel(modelId);
  };
  
  // Handle file analysis
  const handleFileAnalysis = useCallback(async (file) => {
    try {
      // Create a message about the file upload
      const messageId = `file-${Date.now()}`;
      const fileMessage = {
        id: messageId,
        sessionId: sessionId || 'temp',
        content: `File uploaded: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`,
        role: 'system',
        timestamp: new Date().toISOString(),
        file: {
          name: file.name,
          size: file.size,
          type: file.type
        }
      };
      
      // Add the file message to the chat
      setMessages(prev => [...prev, fileMessage]);
      
      // Here you would typically upload the file to your server
      // For now, we'll just show a success message
      setTimeout(() => {
        const responseMessage = {
          id: `ai-${Date.now()}`,
          sessionId: sessionId || 'temp',
          content: `I've received your file: ${file.name}. File analysis is not yet implemented.`,
          role: 'assistant',
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, responseMessage]);
      }, 1000);
      
    } catch (error) {
      console.error('Error handling file upload:', error);
      
      // Show error message
      const errorMessage = {
        id: `error-${Date.now()}`,
        sessionId: sessionId || 'temp',
        content: 'Failed to process file. Please try again.',
        role: 'system',
        isError: true,
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    }
  }, [sessionId]);

  // Handle sending a message
  const handleSendMessage = useCallback(async (content) => {
    if (!content.trim()) return;
    
    const messageId = `msg-${Date.now()}`;
    const userMessage = {
      id: messageId,
      sessionId: sessionId || 'temp',
      content,
      role: 'user',
      timestamp: new Date().toISOString(),
      lastUpdated: Date.now()
    };
    
    // Add user message immediately
    setMessages(prev => [...prev, userMessage]);
    
    // Add temporary AI message
    const aiMessageId = `ai-${Date.now()}`;
    const aiMessage = {
      id: aiMessageId,
      sessionId: sessionId || 'temp',
      content: '',
      role: 'assistant',
      isTyping: true,
      isStreaming: true, // New flag to indicate streaming
      shouldAnimate: true,
      timestamp: new Date().toISOString(),
      lastUpdated: Date.now()
    };
    
    // Add AI message to the chat
    setMessages(prev => [...prev, aiMessage]);
    
    // Scroll to bottom
    const scrollToBottom = () => {
      const container = document.querySelector('.messages-container');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    };
    
    // Initial scroll
    setTimeout(scrollToBottom, 100);
    
    try {
      // Ensure socket is connected
      if (!socket || !socket.connected) {
        console.log('[Chat] WebSocket not connected, attempting to connect...');
        await connect(); // Wait for connection
      }

      // Double check connection status
      if (socket && socket.connected) {
        const messageData = {
          messageId: aiMessageId,
          content,
          sessionId: sessionId || `temp-${Date.now()}`,
          model: 'nvidia/llama-3.1-nemotron-ultra-253b-v1:free',
          timestamp: new Date().toISOString()
        };
        
        console.log('[Chat] Sending message via WebSocket:', messageData);
        
        // Set up message listener for streaming chunks
        const handleStreamingMessage = (chunk) => {
          console.log('[Chat] Received chunk:', chunk);
          
          // Only process if this is for our current message
          if (chunk.messageId === aiMessageId) {
            const newContent = chunk.content || '';
            
            setMessages(prev => {
              return prev.map(msg => {
                if (msg.id === aiMessageId) {
                  const fullContent = msg.content + newContent;
                  
                  // If this is the end of the stream
                  if (chunk.done) {
                    // Start typing animation for the final content
                    animateTyping(aiMessageId, fullContent, () => {
                      // Animation complete callback
                      setMessages(prev => prev.map(m => 
                        m.id === aiMessageId 
                          ? { ...m, isTyping: false, isStreaming: false }
                          : m
                      ));
                    });
                    
                    return {
                      ...msg,
                      content: fullContent,
                      isTyping: true,
                      isStreaming: true,
                      lastUpdated: Date.now()
                    };
                  }
                  
                  // For streaming chunks, update content with typing animation
                  if (!msg.isAnimating) {
                    // Only start new animation if not already animating
                    msg.isAnimating = true;
                    animateTyping(aiMessageId, fullContent);
                  }
                  
                  return {
                    ...msg,
                    content: fullContent,
                    isTyping: true,
                    isStreaming: true,
                    lastUpdated: Date.now()
                  };
                }
                return msg;
              });
            });
            
            // Smooth scrolling for each chunk
            requestAnimationFrame(scrollToBottom);
          }
        };
        
        // Listen for streaming chunks
        socket.on('stream_chunk', handleStreamingMessage);
        
        // Send the message with acknowledgement
        socket.emit('send_message', messageData, (response) => {
          console.log('[Chat] Message acknowledged by server:', response);
          
          // Remove the streaming listener when done
          socket.off('stream_chunk', handleStreamingMessage);
          
          if (response?.error) {
            console.error('[Chat] Error from server:', response.error);
            // Update UI to show error
            setMessages(prev => prev.map(msg => 
              msg.id === aiMessageId 
                ? { 
                    ...msg, 
                    error: true,
                    isTyping: false,
                    isStreaming: false,
                    content: 'Error: ' + (response.error.detail || response.error.message || 'Failed to process message'),
                    lastUpdated: Date.now()
                  } 
                : msg
            ));
          } else if (!response?.streaming) {
            // If not streaming, mark as done
            setMessages(prev => prev.map(msg => 
              msg.id === aiMessageId 
                ? { ...msg, isTyping: false, isStreaming: false, lastUpdated: Date.now() } 
                : msg
            ));
          }
        });
      } else {
        throw new Error('Failed to establish WebSocket connection');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Update AI message with error
      setMessages(prev => {
        const messageIndex = prev.findIndex(m => m.id === aiMessageId);
        if (messageIndex === -1) return prev;
        
        const updatedMessages = [...prev];
        updatedMessages[messageIndex] = {
          ...updatedMessages[messageIndex],
          content: 'Sorry, there was an error connecting to the server. Please try again.',
          isTyping: false,
          isStreaming: false,
          error: true
        };
        return updatedMessages;
      });
    }
    },
    [sessionId, socket, selectedModel, messages, connect]
  );

  // Render messages with proper typing indicators and streaming support
  const renderMessages = useMemo(() => {
    return messages.map((message, index) => {
      const isLastMessage = index === messages.length - 1;
      const isLastAssistantMessage = 
        message.role === 'assistant' && 
        isLastMessage;
      
      // Determine if we should show typing indicator or streaming indicator
      const showTyping = message.isTyping && isLastAssistantMessage;
      const isStreaming = message.isStreaming && isLastAssistantMessage;
      
      return (
        <ChatMessage
          key={`${message.id}-${message.lastUpdated || index}`}
          role={message.role}
          content={message.content}
          threatLevel={message.threatLevel}
          isTyping={showTyping}
          isStreaming={isStreaming}
          shouldAnimate={message.shouldAnimate}
          onAnimationComplete={() => {
            setMessages(prevMessages =>
              prevMessages.map(msg =>
                msg.id === message.id
                  ? { ...msg, shouldAnimate: false }
                  : msg
              )
            );
          }}
        />
      );
    });
  }, [messages]);

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-cyber-darker via-cyber-darker to-gray-900 text-white overflow-hidden relative">
      {/* Animated gradient background */}
      <div className="fixed inset-0 -z-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyber-blue/10 via-cyber-darker/90 to-cyber-darker">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxkZWZzPjxyYWRpYWxHcmFkaWVudCBpZD0iZ3JhZGllbnQiIGN4PSI1MCUiIGN5PSI1MCUiIHI9IjcwJSI+PHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6IzAwMDAwMDtzdG9wLW9wYWNpdHk6MC4xIi8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojMDAwMDAwO3N0b3Atb3BhY2l0eTowLjkiLz48L3JhZGlhbEdyYWRpZW50PjwvZGVmcz48cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyYWRpZW50KSIvPjwvc3ZnPg==')] opacity-30"></div>
        </div>
      </div>
      
      {/* Frosted glass overlay */}
      <div className="fixed inset-0 bg-gradient-to-br from-cyber-darker/90 via-cyber-darker/95 to-gray-900/95 backdrop-blur-3xl -z-10"></div>
      
      <ChatHeader 
        onToggleSidebar={toggleSidebar}
        selectedModel={selectedModel}
        onModelChange={handleModelChange}
      />
      
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        <Sidebar 
          isOpen={sidebarOpen}
          sessions={sessions}
          activeSessionId={sessionId}
          onNewChat={handleNewChat}
          onDeleteSession={handleDeleteSession}
          isLoading={isLoadingSessions}
        />
        
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Frosted glass overlay for messages */}
          <div className="absolute inset-0 bg-gradient-to-b from-cyber-darker/40 via-cyber-darker/60 to-gray-900/50 backdrop-blur-xl -z-10"></div>
          
          {/* Messages */}
          <div 
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 messages-container"
            style={{ scrollBehavior: 'smooth' }}
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <div className="w-full max-w-3xl mx-auto">
                  <div className="backdrop-blur-xl bg-white/5 dark:bg-black/20 p-8 rounded-3xl border border-white/10 shadow-2xl">
                    <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-cyber-blue to-cyber-purple bg-clip-text text-transparent">
                      Welcome to CyberGuard AI
                    </h2>
                    <p className="text-cyber-gray-200 mb-10 text-lg">
                      I'm your AI-powered cybersecurity assistant. Ask me anything about cybersecurity, 
                      threat analysis, or request a security assessment of a URL or file.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <button 
                        onClick={() => handleSendMessage('What are the latest cybersecurity threats?')}
                        className="backdrop-blur-lg bg-white/5 hover:bg-white/10 border border-white/10 p-5 rounded-xl text-left transition-all duration-300 hover:shadow-lg hover:shadow-cyber-blue/10"
                      >
                        <h3 className="font-medium text-lg mb-2 text-white">Latest Threats</h3>
                        <p className="text-sm text-cyber-gray-300">Get information about recent cybersecurity threats</p>
                      </button>
                      <button 
                        onClick={() => handleSendMessage('How can I secure my home network?')}
                        className="backdrop-blur-lg bg-white/5 hover:bg-white/10 border border-white/10 p-5 rounded-xl text-left transition-all duration-300 hover:shadow-lg hover:shadow-cyber-purple/10"
                      >
                        <h3 className="font-medium text-lg mb-2 text-white">Home Security</h3>
                        <p className="text-sm text-cyber-gray-300">Tips for securing your home network</p>
                      </button>
                      <button 
                        onClick={() => handleSendMessage('Explain what a zero-day vulnerability is')}
                        className="backdrop-blur-lg bg-white/5 hover:bg-white/10 border border-white/10 p-5 rounded-xl text-left transition-all duration-300 hover:shadow-lg hover:shadow-cyber-teal/10"
                      >
                        <h3 className="font-medium text-lg mb-2 text-white">Zero-Day Exploits</h3>
                        <p className="text-sm text-cyber-gray-300">Learn about zero-day vulnerabilities</p>
                      </button>
                      <button 
                        onClick={() => handleSendMessage('What is multi-factor authentication?')}
                        className="backdrop-blur-lg bg-white/5 hover:bg-white/10 border border-white/10 p-5 rounded-xl text-left transition-all duration-300 hover:shadow-lg hover:shadow-cyber-pink/10"
                      >
                        <h3 className="font-medium text-lg mb-2 text-white">MFA Guide</h3>
                        <p className="text-sm text-cyber-gray-300">Understanding multi-factor authentication</p>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              renderMessages
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Chat Input */}
          <div className="border-t border-cyber-gray-800 bg-cyber-darker p-4">
            <ChatInput 
              onSendMessage={handleSendMessage}
              onFileUpload={handleFileAnalysis}
              isConnected={connected}
            />
          </div>
          
          {/* Connection Status */}
          {!connected && (
            <div className="absolute bottom-20 left-0 right-0 text-center">
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-red-900/50 text-red-200 text-sm">
                <span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span>
                Disconnected. Reconnecting...
              </div>
            </div>
          )}
          
          {/* Footer Note */}
          <div className="text-xs text-cyber-gray-500 mt-2 text-center pb-2">
            CyberGuard AI may produce inaccurate information. Verify critical information.
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
