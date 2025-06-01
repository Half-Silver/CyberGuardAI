const express = require('express');
const router = express.Router();
const openRouter = require('../utils/openRouter');
const config = require('../config/config');
const { verifyToken } = require('../middleware/auth');

// All admin routes require authentication
router.use(verifyToken);

// Get system status
router.get('/status', (req, res) => {
  res.json({
    status: 'operational',
    version: '1.0.0',
    environment: config.environment,
    user: req.user.email,
    timestamp: new Date().toISOString()
  });
});

// Get available AI models
router.get('/models', async (req, res) => {
  try {
    const models = await openRouter.getAvailableModels();
    res.json({ models });
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      detail: 'Error fetching AI models'
    });
  }
});

// Simple GET test endpoint for OpenRouter API
router.get('/test-ai-quick', async (req, res) => {
  try {
    console.log('Testing OpenRouter API connection...');
    const messages = [{ role: 'user', content: 'Hello CyberGuard AI, this is a quick test message.' }];
    const response = await openRouter.generateResponse(messages);
    
    console.log('OpenRouter API test successful!', response.text.substring(0, 50) + '...');
    res.json({
      success: true,
      response: response.text,
      model: response.model
    });
  } catch (error) {
    console.error('OpenRouter API test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Test AI response
router.post('/test-ai', async (req, res) => {
  try {
    const { prompt, model, options } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        error: 'Bad Request',
        detail: 'Prompt is required'
      });
    }
    
    const messages = [{ role: 'user', content: prompt }];
    const response = await openRouter.generateResponse(messages, model, options);
    
    res.json({
      response: response.text,
      model: response.model,
      usage: response.usage
    });
  } catch (error) {
    console.error('Test AI error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      detail: error.message
    });
  }
});

// Test security analysis
router.post('/test-security', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({
        error: 'Bad Request',
        detail: 'Text to analyze is required'
      });
    }
    
    const analysis = await openRouter.analyzeSecurityRisk(text);
    
    res.json({
      threatLevel: analysis.threatLevel,
      analysis: analysis.analysis
    });
  } catch (error) {
    console.error('Test security error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      detail: error.message
    });
  }
});

// Get configuration (non-sensitive)
router.get('/config', (req, res) => {
  res.json({
    environment: config.environment,
    defaultModel: config.defaultModel,
    logLevel: config.logLevel,
    hasVirusTotalKey: !!config.virusTotalApiKey,
    hasOpenRouterKey: !!config.openRouterApiKey
  });
});

module.exports = router;
