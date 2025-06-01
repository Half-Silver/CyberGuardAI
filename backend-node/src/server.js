const express = require('express');
const http = require('http');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const path = require('path');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const db = require('./utils/database');

// No environment loading here - config will handle it
const config = require('./config/config');

// Output OpenRouter API key status AFTER loading config
console.log('Using OpenRouter API key:', config.openRouterApiKey ? 'Key present (hidden)' : 'No key found');

// Import routes and controllers
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const adminRoutes = require('./routes/adminRoutes');
const chatController = require('./controllers/chatController');
const { verifySocketConnection } = require('./middleware/auth');

// Initialize express app
const app = express();
const server = http.createServer(app);

// Security headers middleware
app.use((req, res, next) => {
  // Remove the problematic Permissions-Policy header if it exists
  res.removeHeader('Permissions-Policy');
  
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // Set Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data:; " +
    "font-src 'self'; " +
    "connect-src 'self' ws: wss:;"
  );
  
  next();
});

// Initialize Socket.IO with CORS configuration
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL ? 
      process.env.FRONTEND_URL.split(',') : 
      ['http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  },
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 30000,
  maxHttpBufferSize: 1e8,
  cookie: false,
  serveClient: false,
  allowUpgrades: true,
  perMessageDeflate: {
    threshold: 1024,
    clientNoContextTakeover: false
  },
  // Enable connection state recovery
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true
  }
});

// Middleware
app.use(cors());
app.use(morgan('dev')); // Request logging
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Static files and admin panel
app.use('/static', express.static(path.join(__dirname, '../public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Root path redirect to admin UI
app.get('/', (req, res) => {
  res.redirect('/admin');
});

// Admin panel routes (Development UI)
app.get('/admin', (req, res) => {
  res.render('admin/index', { title: 'CyberGuard AI Admin' });
});

app.get('/admin/chat', (req, res) => {
  res.render('admin/chat', { title: 'CyberGuard AI Chat Tester' });
});

app.get('/admin/security', (req, res) => {
  res.render('admin/security', { title: 'CyberGuard AI Security Analyzer' });
});

app.get('/admin/settings', (req, res) => {
  res.render('admin/settings', { title: 'CyberGuard AI Settings' });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);

// Import report routes
const reportRoutes = require('./routes/reportRoutes');
app.use('/api/report', reportRoutes);

// Status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'operational',
    backend: 'node',
    version: '1.0.0'
  });
});

// Use the main Socket.IO instance directly instead of a namespace
// This matches our simplified frontend connection

// Socket middleware for authentication
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.query.token;
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    
    // Use the verifySocketConnection middleware
    await verifySocketConnection(socket, next);
  } catch (error) {
    console.error('Socket middleware error:', error);
    next(new Error('Authentication error'));
  }
});

// Socket connection handling
// Handle WebSocket connections
io.on('connection', (socket) => {
  console.log(`[WebSocket] New connection: ${socket.id}`);
  console.log('[WebSocket] Handshake query:', socket.handshake.query);
  
  // Function to authenticate with a token
  const authenticateWithToken = async (token, callback) => {
    const ack = (response = {}) => {
      const logLevel = response.success ? 'info' : 'error';
      console[logLevel]('[WebSocket] Authentication response:', response);
      if (typeof callback === 'function') {
        callback(response);
      }
      return response.success;
    };
    
    console.log('[WebSocket] Raw token received:', {
      type: typeof token,
      isNull: token === null,
      isUndefined: token === undefined,
      stringValue: typeof token === 'string' ? token.substring(0, 20) + '...' : 'N/A',
      hasBearer: typeof token === 'string' ? token.includes('Bearer') : false
    });
    
    if (!token) {
      const error = { success: false, error: 'No token provided' };
      console.log('[WebSocket]', error.error);
      return ack(error);
    }
    
    // Handle different token formats
    try {
      // If token is an object, try to extract the token from it
      if (typeof token === 'object' && token !== null) {
        console.log('[WebSocket] Token is an object, extracting token property');
        token = token.token || (token.data && token.data.token) || null;
        
        if (!token) {
          const error = { success: false, error: 'No token found in authentication data' };
          console.log('[WebSocket]', error.error);
          return ack(error);
        }
      }
      
      // Ensure token is a string
      if (typeof token !== 'string') {
        const error = { success: false, error: 'Token must be a string' };
        console.log('[WebSocket]', error.error);
        return ack(error);
      }
      
      // Handle Bearer token format
      if (token.startsWith('Bearer ')) {
        token = token.substring(7).trim();
        console.log('[WebSocket] Extracted token after Bearer prefix');
      }
      
      if (!token.trim()) {
        const error = { success: false, error: 'Token is empty after processing' };
        console.log('[WebSocket]', error.error);
        return ack(error);
      }
      
      console.log('[WebSocket] Token format is valid, length:', token.length);
      
      // Verify the token using the database
      const userData = await db.verifySession(token);
      
      if (!userData) {
        console.log('[WebSocket] Authentication failed: Invalid or expired token');
        return ack({ success: false, error: 'Invalid or expired token' });
      }
      
      // Attach user info to socket for future reference
      socket.user = {
        id: userData.id,
        email: userData.email || 'unknown',
        fullname: userData.fullname || userData.email || 'Unknown User',
        role: 'user' // Default role
      };
      
      console.log(`[WebSocket] Authentication successful for user ${socket.user.email} (${socket.user.id})`);
      
      // Send connected event
      socket.emit('connected', {
        message: 'Successfully connected to WebSocket server',
        timestamp: new Date().toISOString(),
        user: socket.user
      });
      
      ack({ 
        success: true, 
        user: socket.user,
        message: 'Authentication successful'
      });
      
      return true;
      
    } catch (error) {
      console.error('[WebSocket] Authentication error:', error);
      return ack({ 
        success: false, 
        error: 'Authentication failed',
        details: error.message
      });
    }
  };
  
  // Handle authentication via event
  socket.on('authenticate', async (data, callback) => {
    console.log('[WebSocket] Authentication attempt via event:', data ? 'data provided' : 'no data');
    console.log('[WebSocket] Raw authentication data:', JSON.stringify(data, null, 2));
    
    if (!data) {
      console.log('[WebSocket] No authentication data provided');
      if (callback) callback({ success: false, error: 'No authentication data provided' });
      return;
    }
    
    // Handle different data formats
    let token = data.token || (data.data && data.data.token) || null;
    
    if (!token) {
      console.log('[WebSocket] No token found in authentication data');
      if (callback) callback({ success: false, error: 'No token provided in authentication data' });
      return;
    }
    
    console.log('[WebSocket] Extracted token for authentication');
    await authenticateWithToken(token, callback);
  });
  
  // Try to authenticate with token from handshake query if available
  const handshakeToken = socket.handshake.query?.token;
  if (handshakeToken) {
    console.log('[WebSocket] Attempting authentication with handshake token');
    authenticateWithToken(handshakeToken);
  } else {
    console.log('[WebSocket] No authentication token in handshake');
  }

  // Handle incoming chat messages with acknowledgment
  socket.on('send_message', async (data, callback) => {
    console.log('[WebSocket] Received send_message event:', JSON.stringify(data, null, 2));
    console.log('[WebSocket] Socket user:', socket.user);
    
    // Acknowledge receipt immediately
    const ack = (response = {}) => {
      if (typeof callback === 'function') {
        console.log('[WebSocket] Sending acknowledgment:', response.success ? 'success' : 'error', response);
        callback(response);
      } else {
        console.error('[WebSocket] No callback function provided for acknowledgment');
      }
    };
    
    // Send immediate acknowledgment
    ack({ success: true, message: 'Message received, processing...' });
    
    try {
      const { messageId, content: message, sessionId, model } = data;
      
      if (!sessionId || !message) {
        const errorMsg = 'Missing required data in message';
        console.error(errorMsg, { sessionId, messageLength: message?.length });
        const errorResponse = {
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Invalid message format',
            detail: 'Session ID and message content are required'
          }
        };
        ack(errorResponse);
        return;
      }
      
      console.log(`[WebSocket] Processing message ID ${messageId} for session ${sessionId} with model ${model || 'default'}`);
      
      // Process message through chat controller
      const result = await chatController.handleWebSocketMessage(
        socket.user,
        sessionId,
        message,
        model || 'nvidia/llama-3.1-nemotron-ultra-253b-v1:free',
        socket,
        messageId
      );
      
      // If we have a direct response (non-streaming), send it
      if (result && result.response && !result.isScam) {
        socket.emit('ai_response', {
          sessionId,
          messageId: messageId || `msg-${Date.now()}`,
          message: result.response,
          model: model || 'nvidia/llama-3.1-nemotron-ultra-253b-v1:free'
        });
      }
      
      // Send final acknowledgment
      ack({ 
        success: true, 
        message: 'Message processing complete',
        messageId: messageId || `msg-${Date.now()}`
      });
      
    } catch (error) {
      console.error('[WebSocket] Error processing message:', error);
      const errorResponse = {
        success: false,
        error: {
          code: 'PROCESSING_ERROR',
          message: 'Error processing message',
          detail: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
      };
      ack(errorResponse);
      
      // Also emit to the client's error channel
      socket.emit('error', errorResponse.error);
    }
  });
  
  // Debug event to show all registered events
  socket.onAny((event, ...args) => {
    console.log(`Socket received event: ${event}`);
  });
  
  // Send an initial connection confirmation
  socket.emit('connected', {
    message: 'Successfully connected to WebSocket server',
    timestamp: new Date().toISOString(),
    user: {
      id: socket.user.id,
      email: socket.user.email
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`WebSocket client disconnected: ${socket.id}`);
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    detail: err.message
  });
});

// Start server
const PORT = config.port || 8000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`CyberGuard AI Node.js backend running on http://localhost:${PORT}`);
  console.log(`Development UI available at http://localhost:${PORT}/admin`);
});

module.exports = { app, server, io };
