const jwt = require('jsonwebtoken');
const config = require('../config/config');
const db = require('../utils/database');

/**
 * Middleware to verify JWT token from Authorization header
 */
const verifyToken = async (req, res, next) => {
  try {
    // Get the token from authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        detail: 'No token provided' 
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify the token with database
    const userData = await db.verifySession(token);
    
    if (!userData) {
      return res.status(401).json({ 
        error: 'Unauthorized', 
        detail: 'Invalid or expired token' 
      });
    }
    
    // Attach user data to request
    req.user = userData;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      detail: 'Authentication error' 
    });
  }
};

/**
 * Middleware to verify WebSocket connection token
 * In development mode, this allows connections without strict authentication
 */
const verifySocketConnection = async (socket, next) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  // Default development user
  const devUser = {
    id: 'dev-user-id',
    email: 'dev@example.com',
    fullname: 'Development User'
  };

  try {
    console.log('WebSocket connection attempt:', {
      query: socket.handshake.query,
      headers: {
        ...socket.handshake.headers,
        // Don't log the full auth header for security
        authorization: socket.handshake.headers.authorization ? 'Bearer [token]' : 'Not provided'
      }
    });

    // Get token from multiple possible locations
    let token = null;
    
    // 1. Check query parameters first (preferred for WebSocket)
    if (socket.handshake.query?.token) {
      token = socket.handshake.query.token;
      console.log('Extracted token from query parameters');
    } 
    // 2. Check Authorization header as fallback
    else {
      const authHeader = socket.handshake.headers.authorization;
      if (authHeader) {
        // Handle both 'Bearer token' and just 'token' formats
        token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
        console.log('Extracted token from Authorization header');
      } else {
        console.log('No token found in query parameters or headers');
      }
    }
    
    // Log token details for debugging (without exposing full token)
    if (token) {
      console.log('Token details:', {
        length: token.length,
        startsWith: token.substring(0, 4) + '...',
        endsWith: '...' + token.substring(token.length - 4)
      });
    }

    // In development, allow connection with or without token
    if (isDevelopment) {
      console.log('Development mode: Allowing connection with or without token');
      
      // Set default dev user
      socket.user = devUser;
      
      // If we have a token, try to verify it but don't fail if it's invalid
      if (token) {
        try {
          // Clean up the token (remove 'Bearer ' prefix if present)
          const cleanToken = token.startsWith('Bearer ') ? token.substring(7) : token;
          const tokenPrefix = cleanToken ? `${cleanToken.substring(0, 8)}...` : 'empty';
          console.log('Attempting to verify token:', tokenPrefix);
          
          const userData = await db.verifySession(cleanToken);
          if (userData) {
            console.log('Token verified successfully for user:', userData.email);
            socket.user = userData;
            return next();
          } else {
            console.log('Token verification failed, using default dev user');
            return next();
          }
        } catch (verifyError) {
          console.error('Token verification error:', verifyError);
          // Continue with default dev user
          return next();
        }
      }
      
      return next();
    }
    
    // In production, require a valid token
    if (!token) {
      const errorMsg = 'No token provided in WebSocket handshake';
      console.error(errorMsg);
      return next(new Error(`Authentication error: ${errorMsg}`));
    }
    
    // Clean up token (remove 'Bearer ' prefix if present)
    const cleanToken = token.startsWith('Bearer ') ? token.substring(7) : token;
    console.log('Verifying session with token:', cleanToken.substring(0, 8) + '...');
    
    // Verify the token with database
    try {
      console.log('Calling verifySession with token:', cleanToken ? `${cleanToken.substring(0, 8)}...` : 'empty');
      const userData = await db.verifySession(cleanToken);
      
      if (!userData) {
        console.error('Invalid or expired token');
        return next(new Error('Authentication error: Invalid or expired token'));
      }
      
      console.log('Successfully authenticated user:', userData.email);
      socket.user = userData;
      return next();
    } catch (dbError) {
      console.error('WebSocket auth error:', dbError);
      if (isDevelopment) {
        console.log('Development mode: Database error but allowing connection');
        // Provide a default test user for development
        socket.user = {
          id: 'dev-user-id',
          email: 'devikakb96@gmail.com',
          fullname: 'Development User'
        };
        return next();
      }
      throw dbError;
    }
  } catch (error) {
    console.error('WebSocket auth error:', error);
    next(new Error('Authentication error'));
  }
};

module.exports = {
  verifyToken,
  verifySocketConnection
};
