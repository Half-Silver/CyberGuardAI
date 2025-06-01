const db = require('../utils/database');

const authController = {
  /**
   * Register a new user
   */
  async signup(req, res) {
    try {
      const { email, fullname, password } = req.body;
      
      // Validate input
      if (!email || !fullname || !password) {
        return res.status(400).json({
          error: 'Bad Request',
          detail: 'Email, fullname, and password are required'
        });
      }
      
      // Create user
      const success = await db.createUser(email, fullname, password);
      
      if (!success) {
        return res.status(409).json({
          error: 'Conflict',
          detail: 'User with this email already exists'
        });
      }
      
      // Verify user to get details
      const user = await db.verifyUser(email, password);
      
      // Create session for the new user
      const session = await db.createSession(user.id);
      
      // Return user info and token
      res.status(201).json({
        message: 'User created successfully',
        token: session.token,
        user: {
          id: user.id,
          email: user.email,
          fullname: user.fullname
        }
      });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        detail: 'Error creating user'
      });
    }
  },
  
  /**
   * Login user
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;
      
      // Validate input
      if (!email || !password) {
        return res.status(400).json({
          error: 'Bad Request',
          detail: 'Email and password are required'
        });
      }
      
      // Verify user
      const user = await db.verifyUser(email, password);
      
      if (!user) {
        return res.status(401).json({
          error: 'Unauthorized',
          detail: 'Invalid email or password'
        });
      }
      
      // Create session
      const session = await db.createSession(user.id);
      
      // Return user info and token
      res.status(200).json({
        message: 'Login successful',
        token: session.token,
        user: {
          id: user.id,
          email: user.email,
          fullname: user.fullname
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        detail: 'Error logging in'
      });
    }
  },
  
  /**
   * Logout user
   */
  async logout(req, res) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(400).json({
          error: 'Bad Request',
          detail: 'No token provided'
        });
      }
      
      const token = authHeader.split(' ')[1];
      
      // Delete session
      await db.logout(token);
      
      res.status(200).json({
        message: 'Logout successful'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        detail: 'Error logging out'
      });
    }
  },
  
  /**
   * Get user profile
   */
  async profile(req, res) {
    try {
      // User data is already attached to request by auth middleware
      res.status(200).json({
        user: {
          id: req.user.id,
          email: req.user.email,
          fullname: req.user.fullname
        }
      });
    } catch (error) {
      console.error('Profile error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        detail: 'Error getting profile'
      });
    }
  }
};

module.exports = authController;
