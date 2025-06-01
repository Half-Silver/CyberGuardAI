const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middleware/auth');

// All report routes require authentication
router.use(authMiddleware.verifyToken);

// Get reporting configuration
router.get('/config', reportController.getReportConfig);

// Send security incident report
router.post('/incident', reportController.sendIncidentReport);

// Send security scan report
router.post('/scan', reportController.sendScanReport);

// Send generic security report
router.post('/generic', reportController.sendGenericReport);

module.exports = router;
