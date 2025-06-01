import axios from 'axios';

// Export the base URLs for different backends
export const API_BASE_URL = 'http://localhost:8001/api'; // Python backend for AI/chatbot
export const NODE_API_URL = 'http://localhost:8002/api'; // Node.js backend for sessions/auth

// Get auth token from localStorage
const getToken = () => {
  const authData = localStorage.getItem('cyberguard_auth');
  if (!authData) return null;
  
  try {
    const { token } = JSON.parse(authData);
    return token;
  } catch (error) {
    console.error('Error parsing auth data:', error);
    return null;
  }
};

// Get headers with auth token
const getAuthHeaders = () => {
  const token = getToken();
  return {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
};

// Fetch session chat history
export const fetchChatHistory = async (sessionId) => {
  try {
    const response = await axios.get(`${NODE_API_URL}/chat/session/${sessionId}`, getAuthHeaders());
    return response.data;
  } catch (error) {
    console.error('Error fetching chat history:', error);
    throw error;
  }
};

// Create a new chat session
export const createSession = async () => {
  try {
    const response = await axios.post(`${NODE_API_URL}/chat/session`, {}, getAuthHeaders());
    return response.data;
  } catch (error) {
    console.error('Error creating chat session:', error);
    throw error;
  }
};

// Get all chat sessions for the user
export const getChatSessions = async () => {
  try {
    const response = await axios.get(`${NODE_API_URL}/chat/sessions`, getAuthHeaders());
    return response.data;
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    throw error;
  }
};

// Delete a chat session
export const deleteSession = async (sessionId) => {
  try {
    const response = await axios.delete(`${NODE_API_URL}/chat/session/${sessionId}`, getAuthHeaders());
    return response.data;
  } catch (error) {
    console.error('Error deleting chat session:', error);
    throw error;
  }
};

// Chat API calls
const chatService = {
  // Get chat history from server
  getHistory: async () => {
    try {
      const token = getToken();
      if (!token) throw new Error('Not authenticated');
      
      const response = await axios.get(`${NODE_API_URL}/chat/history`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching chat history:', error);
      throw error;
    }
  },
  
  // Send a message via REST API (fallback if WebSocket fails)
  sendMessage: async (message, model) => {
    try {
      const token = getToken();
      if (!token) throw new Error('Not authenticated');
      
      const response = await axios.post(
        `${API_BASE_URL}/chat`, 
        { message, model },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  },
  
  // Get available models
  getModels: async () => {
    try {
      const token = getToken();
      if (!token) throw new Error('Not authenticated');
      
      const response = await axios.get(`${NODE_API_URL}/chat/models`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching models:', error);
      throw error;
    }
  }
};

export default chatService;
