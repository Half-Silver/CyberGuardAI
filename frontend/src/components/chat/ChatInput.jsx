import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { FiSend, FiWifi, FiWifiOff, FiPaperclip, FiMic, FiX } from 'react-icons/fi';
import FileUploader from './FileUploader';
import { useWebSocket } from '../../context/WebSocketContext';

// Memoize the component to prevent unnecessary re-renders
const ChatInput = memo(({ 
  onSendMessage, 
  onFileAnalysis, 
  disabled, 
  connectionStatus: propConnectionStatus, 
  selectedModel, 
  onRetryConnection 
}) => {
  const [message, setMessage] = useState('');
  const [showFileUploader, setShowFileUploader] = useState(false);
  const textareaRef = useRef(null);
  const lastRenderRef = useRef(Date.now());
  
  // Get WebSocket connection status with useCallback to prevent unnecessary updates
  const { connected: contextConnected } = useWebSocket();
  
  // Memoize the connection status to prevent unnecessary re-renders
  const isConnected = useCallback(() => {
    return contextConnected || propConnectionStatus === 'connected';
  }, [contextConnected, propConnectionStatus]);

  // Auto-resize textarea as content grows
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [message]);
  
  // Throttle debug logging
  useEffect(() => {
    const now = Date.now();
    if (now - lastRenderRef.current > 1000) { // Only log once per second
      console.log(`[Debug] ChatInput rendering - connected: ${isConnected()}`);
      lastRenderRef.current = now;
    }
  });

  const handleChange = useCallback((e) => {
    setMessage(e.target.value);
  }, []);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    
    // Throttle logging in production
    if (process.env.NODE_ENV !== 'production') {
      console.log('[ChatInput] Form submitted with message');
    }
    
    // Check if message is valid
    if (!message.trim()) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[ChatInput] Message not sent - empty message');
      }
      return;
    }
    
    // Check if we're in a state that should prevent sending
    if (disabled) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[ChatInput] Message not sent - component is disabled');
      }
      return;
    }
    
    // Call the parent's send message handler
    if (typeof onSendMessage === 'function') {
      const messageToSend = message.trim();
      onSendMessage(messageToSend);
      
      // Only clear the message if the send was successful
      setMessage('');
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.focus();
      }
    } else if (process.env.NODE_ENV !== 'production') {
      console.error('[ChatInput] onSendMessage is not a function');
    }
  }, [message, disabled, onSendMessage]);

  const handleKeyDown = useCallback((e) => {
    // Handle Enter key press (without Shift key)
    if (e.key === 'Enter' && !e.shiftKey) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[ChatInput] Enter key pressed, submitting form');
      }
      e.preventDefault();
      e.stopPropagation();
      
      // Create a synthetic submit event
      const submitEvent = new Event('submit', {
        bubbles: true,
        cancelable: true
      });
      
      // Find the form and submit it
      const form = e.target.closest('form');
      if (form) {
        form.dispatchEvent(submitEvent);
        if (!submitEvent.defaultPrevented) {
          handleSubmit(e);
        }
      } else {
        // Fallback to direct handleSubmit if form not found
        handleSubmit(e);
      }
    }
  }, [handleSubmit]);

  const handleToggleFileUploader = useCallback(() => {
    setShowFileUploader(prev => !prev);
  }, []);
  
  return (
    <div className="mx-auto max-w-4xl px-4 pb-6">
      {!isConnected() && (
        <div className="backdrop-blur-lg bg-red-900/30 border border-red-500/20 rounded-xl p-3 flex items-center justify-center mb-2 shadow-lg">
          <FiWifiOff className="text-red-400 mr-2" />
          <span className="text-sm text-red-200">Not connected to server. Please wait or refresh the page.</span>
          <button 
            onClick={onRetryConnection} 
            className="ml-3 text-xs bg-red-500/20 text-red-200 px-3 py-1.5 rounded-full hover:bg-red-500/30 transition-all duration-300 backdrop-blur-sm border border-red-500/30"
          >
            Retry Connection
          </button>
        </div>
      )}
      
      {isConnected() && (
        <div className="backdrop-blur-lg bg-green-900/20 border border-green-500/20 rounded-xl p-2 flex items-center justify-center mb-2 shadow-lg">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse mr-2"></div>
          <span className="text-xs text-green-300 font-medium">Connected to CyberGuard AI chat server</span>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="relative" disabled={disabled}>
        <div className="flex flex-col">
          {showFileUploader && (
            <div className="mb-3 backdrop-blur-xl bg-white/5 border border-white/10 p-4 rounded-2xl shadow-2xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-white">
                  <span className="bg-gradient-to-r from-cyber-blue to-cyber-purple bg-clip-text text-transparent">
                    File Analysis
                  </span>
                </h3>
                <button 
                  onClick={handleToggleFileUploader}
                  className="p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                >
                  <FiX size={16} />
                </button>
              </div>
              <FileUploader
                onAnalysisComplete={onFileAnalysis}
                selectedModel={selectedModel}
              />
            </div>
          )}
          
          <div className="relative">
            <div className="flex items-start rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-cyber-blue/10">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Send a message to CyberGuard AI..."
                className="flex-grow px-5 py-4 bg-transparent text-white resize-none min-h-[60px] max-h-[200px] focus:outline-none placeholder:text-white/40 text-sm"
                disabled={false}
                rows={1}
                style={{
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)'
                }}
              />
              
              <div className="flex items-center p-2 gap-1.5 pr-3">
                <button
                  type="button"
                  className={`p-2.5 rounded-xl transition-all ${
                    disabled 
                      ? 'text-white/30 cursor-not-allowed' 
                      : 'text-white/70 hover:bg-white/10 hover:text-white backdrop-blur-lg'
                  }`}
                  onClick={handleToggleFileUploader}
                  disabled={disabled}
                  title="Upload file for analysis"
                >
                  <FiPaperclip size={18} />
                </button>
                
                <button
                  type="button"
                  className={`p-2.5 rounded-xl transition-all ${
                    disabled 
                      ? 'text-white/30 cursor-not-allowed' 
                      : 'text-white/70 hover:bg-white/10 hover:text-white backdrop-blur-lg'
                  }`}
                  disabled={true}
                  title="Voice input (coming soon)"
                >
                  <FiMic size={18} />
                </button>
                
                <button
                  type="submit"
                  className={`p-3.5 rounded-xl transition-all ${
                    disabled || !message.trim()
                      ? 'bg-white/5 text-white/30 cursor-not-allowed'
                      : 'bg-gradient-to-r from-cyber-blue to-cyber-purple text-white shadow-lg hover:shadow-cyber-blue/40 hover:scale-105 transform transition-all duration-300'
                  }`}
                  disabled={disabled || !message.trim()}
                  title={disabled ? 'Please wait...' : !message.trim() ? 'Type a message' : 'Send message'}
                >
                  <FiSend size={18} />
                </button>
              </div>
            </div>
            
            <div className="absolute left-0 right-0 -bottom-4 h-4 pointer-events-none">
              <div className="mx-auto w-[15%] h-1 bg-gradient-to-r from-cyber-blue/50 to-cyber-purple/50 blur-md rounded-full"></div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
});

// Add display name for better debugging in React DevTools
ChatInput.displayName = 'ChatInput';

export default ChatInput;
