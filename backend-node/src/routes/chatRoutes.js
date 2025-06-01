const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/auth');
const { fileUploadMiddleware } = require('../middleware/fileUpload');

// All chat routes require authentication
router.use(authMiddleware.verifyToken);

// Get chat history
router.get('/history', chatController.getHistory);

// Get active sessions
router.get('/sessions', chatController.getSessions);

// Create a new session
router.post('/session', chatController.createSession);

// Get a specific session
router.get('/session/:sessionId', chatController.getSession);

// Clear a session
router.delete('/session/:sessionId', chatController.clearSession);

// Update session title
router.patch('/session/:sessionId/title', chatController.updateSessionTitle);

// Process a new message
router.post('/message', chatController.processMessage);

// File upload route for security analysis
router.post('/analyze-file', fileUploadMiddleware, chatController.analyzeFile);

module.exports = router;
