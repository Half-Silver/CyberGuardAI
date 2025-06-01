const path = require('path');
const dotenv = require('dotenv');

// Calculate the project root directory (3 levels up from config.js)
const projectRoot = path.resolve(__dirname, '../../..');
const envPath = path.join(projectRoot, '.env');

// Load environment variables from the project root .env file
console.log(`Loading environment variables from: ${envPath}`);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('Error loading .env file:', result.error.message);
} else {
  console.log('Environment file loaded successfully');
}

// Log important configuration values
console.log('Environment Variables Status:');
console.log('- OpenRouter API Key:', process.env.OPENROUTER_API_KEY ? 'Available' : 'Missing');
console.log('- VirusTotal API Key:', process.env.VIRUSTOTAL_API_KEY ? 'Available' : 'Missing'); 
console.log('- Model Name:', process.env.OPENROUTER_MODEL_NAME || 'Using default model');
console.log('- SMTP Settings:', process.env.SMTP_SERVER ? 'Available' : 'Missing');

module.exports = {
  port: process.env.NODE_PORT || 8002,
  jwtSecret: process.env.JWT_SECRET || 'cyberguard-jwt-secret-dev-only',
  jwtExpiration: process.env.JWT_EXPIRATION || '24h',
  openRouterApiKey: process.env.OPENROUTER_API_KEY,
  virusTotalApiKey: process.env.VIRUSTOTAL_API_KEY,
  defaultModel: process.env.OPENROUTER_MODEL_NAME || 'nvidia/llama-3.1-nemotron-ultra-253b-v1:free',
  alternativeModels: process.env.ALTERNATIVE_MODELS ? process.env.ALTERNATIVE_MODELS.split(',') : ['deepseek/deepseek-r1:free'],
  dbPath: process.env.DB_PATH || './data/cyberguard.db',
  environment: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Email reporting configuration
  smtpServer: process.env.SMTP_SERVER || 'smtp.mailersend.net',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUsername: process.env.SMTP_USERNAME,
  smtpPassword: process.env.SMTP_PASSWORD,
  smtpName: process.env.SMTP_NAME || 'CyberGuard Agent',
  fromEmail: process.env.FROM_EMAIL,
  defaultRecipient: process.env.DEFAULT_RECIPIENT || 'Ibmproject208@gmail.com',
};
