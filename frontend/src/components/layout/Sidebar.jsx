import { useState, useRef, useEffect } from 'react';
import { FiPlusCircle, FiMessageCircle, FiChevronLeft, FiChevronRight, FiTrash2, FiShield, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import axios from 'axios';

const Sidebar = ({ 
  isOpen,
  sessions = [],
  currentSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  isLoading = false
}) => {
  const [hoveringSessionId, setHoveringSessionId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editedTitle, setEditedTitle] = useState('');
  const editInputRef = useRef(null);
  
  // Handle session deletion with confirmation
  const handleDeleteClick = async (sessionId, e) => {
    if (e) e.stopPropagation();
    
    // Confirm before deleting
    if (window.confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
      try {
        setIsDeleting(true);
        setDeletingId(sessionId);
        await onDeleteSession(sessionId, e);
      } finally {
        setIsDeleting(false);
        setDeletingId(null);
      }
    }
  };

  // Format date to relative time
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return 'Today';
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Handle click outside the edit input
  useEffect(() => {
    function handleClickOutside(event) {
      if (editInputRef.current && !editInputRef.current.contains(event.target)) {
        setEditingSessionId(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle edit start
  const handleEditStart = (e, session) => {
    e.stopPropagation();
    setEditedTitle(session.title || 'New Chat');
    setEditingSessionId(session.id);
    
    // Focus the input field after a small delay to ensure it's rendered
    setTimeout(() => {
      if (editInputRef.current) {
        editInputRef.current.focus();
        // Select all text in the input
        editInputRef.current.select();
      }
    }, 10);
  };

  // Handle title save
  const handleTitleSave = async (e, session) => {
    e.stopPropagation();
    const sessionId = session.id;
    const newTitle = editedTitle.trim();
    
    if (!newTitle || newTitle === session.title) {
      setEditingSessionId(null);
      return;
    }
    
    // Store the original title in case we need to revert
    const originalTitle = session.title;
    
    try {
      // Optimistic UI update - immediately show the new title
      const updatedSessions = sessions.map(s => 
        s.id === sessionId ? { ...s, title: newTitle } : s
      );
      
      // Update local state
      setSessions(updatedSessions);
      setEditingSessionId(null);
      
      // Call API to update the title
      const response = await axios.patch(`/api/chat/session/${sessionId}/title`, {
        title: newTitle
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      // If the update was successful, refresh the sessions list
      if (response.data && response.data.success) {
        try {
          const { data } = await axios.get('/api/chat/sessions', {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          
          if (data && data.sessions) {
            // Update the sessions with the server's version of the truth
            setSessions(data.sessions);
            
            // Notify parent component with the updated sessions
            if (onSelectSession) {
              onSelectSession(sessionId, data.sessions);
            }
            return; // Success, exit the function
          }
        } catch (refreshError) {
          console.error('Error refreshing sessions:', refreshError);
          // Continue with the optimistic update in this case
        }
      } else {
        // If the server didn't return success, throw an error to trigger the catch block
        throw new Error('Failed to update session title on the server');
      }
      
      // If we get here, the API call was successful but we couldn't refresh the full list
      // Notify parent with our optimistic update
      if (onSelectSession) {
        onSelectSession(sessionId, updatedSessions);
      }
      
    } catch (error) {
      console.error('Error updating session title:', error);
      
      // Revert to original title on error
      const revertedSessions = sessions.map(s => 
        s.id === sessionId ? { ...s, title: originalTitle } : s
      );
      setSessions(revertedSessions);
      
      // Show error to user with more details
      const errorMessage = error.response?.data?.detail || 
                         error.message || 
                         'Failed to update session title. Please try again.';
      
      alert(`Error: ${errorMessage}`);
      
      // If we have a 401 or 403, the user might need to log in again
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        // You might want to trigger a logout or redirect to login here
        console.warn('Authentication error - user may need to log in again');
      }
    }
  };

  // Handle cancel edit
  const handleCancelEdit = (e) => {
    e.stopPropagation();
    setEditingSessionId(null);
  };

  // Truncate long chat titles
  const truncateTitle = (title, maxLength = 25) => {
    if (!title) return 'New Chat';
    return title.length > maxLength ? `${title.substring(0, maxLength)}...` : title;
  };
  
  // If sidebar is closed, show only toggle button
  if (!isOpen) {
    return (
      <div className="w-12 flex flex-col items-center py-4 bg-white/5 backdrop-blur-xl border-r border-white/10">
        <div className="h-8 w-8 mb-6 flex items-center justify-center bg-gradient-to-br from-cyber-blue/30 to-cyber-purple/30 rounded-lg p-1.5">
          <FiShield className="text-white" size={18} />
        </div>
        
        <button
          className="p-2 rounded-xl hover:bg-white/10 transition-all duration-300 group"
          onClick={() => onNewChat()}
          title="New Chat"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-cyber-blue to-cyber-purple rounded-lg blur opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <div className="relative flex items-center justify-center w-8 h-8 bg-white/5 backdrop-blur-lg rounded-lg border border-white/10 group-hover:border-transparent transition-all duration-300">
              <FiPlusCircle className="text-white/80 group-hover:text-white transition-colors" size={18} />
            </div>
          </div>
        </button>
      </div>
    );
  }
  
  return (
    <div className="w-64 flex flex-col h-full bg-white/5 backdrop-blur-xl border-r border-white/10 overflow-hidden transition-all duration-300">
      <div className="p-3 border-b border-white/10">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 p-2.5 bg-gradient-to-r from-cyber-blue to-cyber-purple rounded-xl hover:shadow-lg hover:shadow-cyber-blue/20 transition-all duration-300 group"
        >
          <div className="bg-white/20 p-1 rounded-lg group-hover:scale-110 transition-transform">
            <FiPlusCircle className="text-white" size={16} />
          </div>
          <span className="text-white font-medium">New Chat</span>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto py-3 px-2">
        {sessions && sessions.length > 0 ? (
          <div className="space-y-2 px-1">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-transparent border-t-cyber-blue border-r-cyber-blue"></div>
                <p className="mt-3 text-sm text-white/60">Loading conversations...</p>
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                <div className="bg-white/5 p-4 rounded-2xl mb-3 border border-white/10">
                  <FiMessageCircle className="text-3xl text-white/40 mx-auto" />
                </div>
                <p className="text-sm text-white/70">No conversations yet</p>
                <p className="text-xs text-white/40 mt-1">Start a new chat to begin</p>
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className={`relative group rounded-xl cursor-pointer transition-all duration-300 overflow-hidden ${
                    currentSessionId === session.id
                      ? 'bg-white/10 border border-white/10 shadow-lg shadow-cyber-blue/10'
                      : 'bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-white/70 hover:text-white'
                  }`}
                  onClick={() => onSelectSession(session.id)}
                  onMouseEnter={() => setHoveringSessionId(session.id)}
                  onMouseLeave={() => setHoveringSessionId(null)}
                >
                  <div className="flex items-start p-3">
                    <div className="mt-0.5 mr-3 flex-shrink-0">
                      <div className={`p-1.5 rounded-lg ${
                        currentSessionId === session.id 
                          ? 'bg-gradient-to-br from-cyber-blue/30 to-cyber-purple/30' 
                          : 'bg-white/5 group-hover:bg-white/10'
                      }`}>
                        <FiMessageCircle className={`text-sm ${
                          currentSessionId === session.id ? 'text-cyber-blue' : 'text-white/60 group-hover:text-white'
                        }`} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      {editingSessionId === session.id ? (
                        <div className="relative" ref={editInputRef}>
                          <input
                            type="text"
                            value={editedTitle}
                            onChange={(e) => setEditedTitle(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-white/10 text-white text-sm p-2 rounded-lg border border-cyber-blue/50 focus:border-cyber-blue focus:ring-1 focus:ring-cyber-blue/50 outline-none backdrop-blur-sm"
                            autoFocus
                          />
                          <div className="absolute right-0 top-0 flex space-x-1.5 mt-1.5">
                            <button
                              onClick={(e) => handleTitleSave(e, session)}
                              className="text-green-400 hover:text-green-300 p-1 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                              disabled={!editedTitle.trim()}
                            >
                              <FiCheck size={14} />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="text-red-400 hover:text-red-300 p-1 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                            >
                              <FiX size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="font-medium text-sm text-white/90 truncate">
                          {truncateTitle(session.title || 'New Chat')}
                        </div>
                      )}
                      <div className="text-xs text-white/50 mt-0.5">
                        {formatDate(session.createdAt || session.updatedAt)}
                      </div>
                    </div>
                      
                    <div className="flex items-center space-x-1">
                      {(hoveringSessionId === session.id || currentSessionId === session.id) && (
                        <div className="flex items-center space-x-1 bg-white/5 backdrop-blur-sm rounded-lg p-0.5">
                          <button
                            onClick={(e) => handleEditStart(e, session)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                            title="Rename chat"
                          >
                            <FiEdit2 size={14} />
                          </button>
                          <button
                            onClick={(e) => handleDeleteClick(session.id, e)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete chat"
                            disabled={isDeleting}
                          >
                            {deletingId === session.id ? (
                              <svg className="animate-spin h-3.5 w-3.5 text-red-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : (
                              <FiTrash2 size={14} />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center">
            <div className="bg-white/5 p-5 rounded-2xl mb-4 border border-white/10">
              <FiMessageCircle className="text-3xl text-white/40 mx-auto" />
            </div>
            <p className="text-sm text-white/70">No chat history yet</p>
            <p className="text-xs text-white/40 mt-1">Start a new conversation to see it here</p>
          </div>
        )}
      </div>
      
      <div className="p-3 border-t border-white/10 text-xs text-white/60 flex items-center justify-between bg-white/5 backdrop-blur-lg">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-gradient-to-br from-cyber-blue to-cyber-purple rounded-full mr-2"></div>
          <span>CyberGuard AI v1.0</span>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
