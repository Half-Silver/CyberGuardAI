/**
 * CyberGuard AI - Frontend-Backend Integration Tests
 * 
 * Tests the integration between frontend and backend including:
 * - API endpoints required by the frontend
 * - Data formats expected by the React components
 * - WebSocket compatibility
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Test configuration
const config = {
  baseUrl: 'http://localhost:8001',
  frontendPath: '/Volumes/DataVault/Projects/project_Cyber_bot/CyberGuardAI_Restructured/frontend',
  testUser: {
    email: 'test@cyberguard.ai',
    fullname: 'Test User',
    password: 'TestPassword123!'
  },
  requiredEndpoints: [
    { method: 'POST', path: '/api/auth/login', description: 'User login' },
    { method: 'POST', path: '/api/auth/signup', description: 'User registration' },
    { method: 'POST', path: '/api/auth/logout', description: 'User logout' },
    { method: 'GET', path: '/api/auth/profile', description: 'User profile' },
    { method: 'GET', path: '/api/status', description: 'System status' },
    { method: 'GET', path: '/api/chat/history', description: 'Chat history' },
    { method: 'POST', path: '/api/chat/session', description: 'Create chat session' },
    { method: 'GET', path: '/api/chat/session/:id', description: 'Get chat session' },
    { method: 'DELETE', path: '/api/chat/session/:id', description: 'Delete chat session' }
  ]
};

// Store data between tests
const testData = {
  token: null,
  frontendFiles: [],
  componentImports: {},
  webSocketUsage: []
};

const runTests = async ({ success, failure, skipped }) => {
  try {
    // Authenticate first to get a token
    await authenticate(success, failure, skipped);
    
    // Check required API endpoints
    await testRequiredEndpoints(success, failure, skipped);
    
    // Analyze frontend code for API usage
    await analyzeFrontendCode(success, failure, skipped);
    
    // Verify data structure compatibility
    await testDataStructureCompatibility(success, failure, skipped);
    
    // Test CORS configuration
    await testCorsConfiguration(success, failure, skipped);
  } catch (error) {
    failure('Integration test suite failed', error);
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
        success('Integration authentication - Login successful');
        return;
      }
    } catch (e) {
      // User doesn't exist, create a new one
      try {
        const signupRes = await axios.post(`${config.baseUrl}/api/auth/signup`, config.testUser);
        
        if (signupRes.data && signupRes.data.token) {
          testData.token = signupRes.data.token;
          success('Integration authentication - Created test user');
          return;
        }
      } catch (signupError) {
        failure('Integration authentication - Failed to create test user', signupError);
        return;
      }
    }
    
    failure('Integration authentication - Failed to get authentication token');
  } catch (error) {
    failure('Integration authentication failed', error);
  }
};

// Test required API endpoints
const testRequiredEndpoints = async (success, failure, skipped) => {
  if (!testData.token) {
    skipped('API endpoints - No authentication token available');
    return;
  }
  
  let passedEndpoints = 0;
  let failedEndpoints = 0;
  
  for (const endpoint of config.requiredEndpoints) {
    try {
      let response;
      const url = endpoint.path.includes(':id')
        ? endpoint.path.replace(':id', 'test') // Use a dummy ID for test
        : endpoint.path;
      
      if (endpoint.method === 'GET') {
        response = await axios.get(`${config.baseUrl}${url}`, {
          headers: { Authorization: `Bearer ${testData.token}` },
          validateStatus: () => true // Don't throw on error status
        });
      } else if (endpoint.method === 'POST') {
        response = await axios.post(`${config.baseUrl}${url}`, {}, {
          headers: { Authorization: `Bearer ${testData.token}` },
          validateStatus: () => true // Don't throw on error status
        });
      } else if (endpoint.method === 'DELETE') {
        response = await axios.delete(`${config.baseUrl}${url}`, {
          headers: { Authorization: `Bearer ${testData.token}` },
          validateStatus: () => true // Don't throw on error status
        });
      }
      
      // If we get a 404, the endpoint doesn't exist
      if (response.status === 404) {
        failure(`API endpoints - Missing endpoint: ${endpoint.method} ${endpoint.path} (${endpoint.description})`);
        failedEndpoints++;
      } else {
        // Any other status is fine for this test, we just want to make sure the endpoint exists
        success(`API endpoints - Found endpoint: ${endpoint.method} ${endpoint.path} (${endpoint.description})`);
        passedEndpoints++;
      }
    } catch (error) {
      failure(`API endpoints - Error testing endpoint: ${endpoint.method} ${endpoint.path}`, error);
      failedEndpoints++;
    }
  }
  
  console.log('\nAPI Endpoint Availability:');
  console.log('-'.repeat(80));
  console.log(`Total endpoints: ${config.requiredEndpoints.length}`);
  console.log(`Available: ${passedEndpoints}`);
  console.log(`Missing: ${failedEndpoints}`);
  console.log('-'.repeat(80));
  
  if (failedEndpoints === 0) {
    success(`API endpoints - All ${passedEndpoints} required endpoints are available`);
  } else {
    failure(`API endpoints - ${failedEndpoints} required endpoints are missing`);
  }
};

// Analyze frontend code for API usage
const analyzeFrontendCode = async (success, failure, skipped) => {
  // Check if frontend path exists
  const frontendDir = path.resolve(__dirname, config.frontendPath);
  
  try {
    if (!fs.existsSync(frontendDir)) {
      skipped('Frontend analysis - Frontend directory not found');
      return;
    }
    
    success('Frontend analysis - Frontend directory found');
    
    // Scan the src directory for React components
    const srcDir = path.join(frontendDir, 'src');
    if (!fs.existsSync(srcDir)) {
      skipped('Frontend analysis - Frontend src directory not found');
      return;
    }
    
    // Analyze the main component files
    await analyzeFrontendFile(srcDir, 'hooks/useWebSocket.jsx', success, failure);
    await analyzeFrontendFile(srcDir, 'context/AuthContext.jsx', success, failure);
    await analyzeFrontendFile(srcDir, 'pages/Chat.jsx', success, failure);
    await analyzeFrontendFile(srcDir, 'pages/Login.jsx', success, failure);
    await analyzeFrontendFile(srcDir, 'pages/Signup.jsx', success, failure);
    
    // Report findings
    if (testData.webSocketUsage.length > 0) {
      success(`Frontend analysis - Found ${testData.webSocketUsage.length} components using WebSockets`);
    } else {
      failure('Frontend analysis - No WebSocket usage found in frontend code');
    }
  } catch (error) {
    failure('Frontend analysis failed', error);
  }
};

const analyzeFrontendFile = async (baseDir, relativePath, success, failure) => {
  const filePath = path.join(baseDir, relativePath);
  
  try {
    if (!fs.existsSync(filePath)) {
      failure(`Frontend analysis - Component file not found: ${relativePath}`);
      return;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    testData.frontendFiles.push({ path: relativePath, content });
    
    // Check for WebSocket imports
    if (content.includes('useWebSocket') || 
        content.includes('WebSocket') || 
        content.includes('socket.io')) {
      testData.webSocketUsage.push(relativePath);
      success(`Frontend analysis - WebSocket usage found in ${relativePath}`);
    }
    
    // Check for API endpoints usage
    let apiEndpoints = [];
    for (const endpoint of config.requiredEndpoints) {
      if (content.includes(endpoint.path)) {
        apiEndpoints.push(endpoint.path);
      }
    }
    
    if (apiEndpoints.length > 0) {
      success(`Frontend analysis - Found ${apiEndpoints.length} API endpoints in ${relativePath}`);
    }
    
    return true;
  } catch (error) {
    failure(`Frontend analysis - Error analyzing ${relativePath}`, error);
    return false;
  }
};

// Verify data structure compatibility
const testDataStructureCompatibility = async (success, failure, skipped) => {
  // Refresh authentication token to ensure it's valid
  try {
    const loginRes = await axios.post(`${config.baseUrl}/api/auth/login`, {
      email: config.testUser.email,
      password: config.testUser.password
    });
    
    if (loginRes.data && loginRes.data.token) {
      testData.token = loginRes.data.token;
      success('Data structure - Authentication refreshed for tests');
    }
  } catch (authError) {
    failure('Data structure - Failed to refresh authentication', authError);
  }
  
  if (!testData.token) {
    skipped('Data structure - No authentication token available');
    return;
  }
  
  try {
    // Test login response format
    try {
      const loginRes = await axios.post(`${config.baseUrl}/api/auth/login`, {
        email: config.testUser.email,
        password: config.testUser.password
      });
      
      // Check for required fields in login response
      const requiredLoginFields = ['token', 'user'];
      const userFields = ['id', 'email', 'fullname'];
      
      const missingLoginFields = requiredLoginFields.filter(field => !loginRes.data.hasOwnProperty(field));
      const missingUserFields = userFields.filter(field => !loginRes.data.user || !loginRes.data.user.hasOwnProperty(field));
      
      if (missingLoginFields.length === 0 && missingUserFields.length === 0) {
        success('Data structure - Login response format is compatible with frontend');
      } else {
        failure(`Data structure - Login response missing fields: ${[...missingLoginFields, ...missingUserFields.map(f => `user.${f}`)].join(', ')}`);
      }
    } catch (error) {
      failure('Data structure - Error testing login response format', error);
    }
    
    // Test chat session format
    try {
      // Create a session
      const sessionRes = await axios.post(
        `${config.baseUrl}/api/chat/session`,
        {},
        { headers: { Authorization: `Bearer ${testData.token}` } }
      );
      
      if (sessionRes.data && sessionRes.data.sessionId) {
        success('Data structure - Chat session creation format is compatible with frontend');
        
        // Test session retrieval format
        try {
          const getSessionRes = await axios.get(
            `${config.baseUrl}/api/chat/session/${sessionRes.data.sessionId}`,
            { headers: { Authorization: `Bearer ${testData.token}` } }
          );
          
          if (getSessionRes.data && 
              getSessionRes.data.session && 
              typeof getSessionRes.data.session.session_id === 'string' &&
              Array.isArray(getSessionRes.data.session.messages)) {
            success('Data structure - Chat session retrieval format is compatible with frontend');
          } else {
            failure('Data structure - Chat session retrieval format is not compatible with frontend');
          }
        } catch (error) {
          failure('Data structure - Error testing chat session retrieval format', error);
        }
      } else {
        failure('Data structure - Chat session creation format is not compatible with frontend');
      }
    } catch (error) {
      failure('Data structure - Error testing chat session format', error);
    }
  } catch (error) {
    failure('Data structure compatibility test failed', error);
  }
};

// Test CORS configuration
const testCorsConfiguration = async (success, failure, skipped) => {
  try {
    // Send an OPTIONS request to check CORS headers
    const corsRes = await axios.options(`${config.baseUrl}/api/status`, {
      headers: {
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET'
      }
    });
    
    const corsHeaders = corsRes.headers;
    
    if (corsHeaders['access-control-allow-origin']) {
      success(`CORS configuration - CORS is enabled (${corsHeaders['access-control-allow-origin']})`);
      
      // Check for frontend origin
      if (corsHeaders['access-control-allow-origin'].includes('localhost:5173') ||
          corsHeaders['access-control-allow-origin'] === '*') {
        success('CORS configuration - Frontend origin is allowed');
      } else {
        failure(`CORS configuration - Frontend origin may not be allowed: ${corsHeaders['access-control-allow-origin']}`);
      }
      
      // Check allowed methods
      if (corsHeaders['access-control-allow-methods']) {
        success(`CORS configuration - Methods allowed: ${corsHeaders['access-control-allow-methods']}`);
      } else {
        failure('CORS configuration - No methods specified in CORS headers');
      }
    } else {
      failure('CORS configuration - CORS headers are not set');
    }
  } catch (error) {
    failure('CORS configuration test failed', error);
  }
};

module.exports = { runTests };
