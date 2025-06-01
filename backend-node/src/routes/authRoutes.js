const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

// Public routes
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/logout', authController.logout);

// Protected routes
router.get('/profile', verifyToken, authController.profile);

// Alternative route for frontend compatibility
router.get('/me', verifyToken, authController.profile);

module.exports = router;
