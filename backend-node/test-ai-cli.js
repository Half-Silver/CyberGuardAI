const axios = require('axios');
const readline = require('readline');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
const envPath = path.resolve(__dirname, '.env');
dotenv.config({ path: envPath });

// Configuration
const config = {
  baseUrl: process.env.API_BASE_URL || 'http://localhost:8002',
  openRouterKey: process.env.OPENROUTER_API_KEY,
  model: 'nvidia/llama-3.1-nemotron-ultra-253b-v1:free',
  maxTokens: 1000,
  temperature: 0.7
};

// Check if OpenRouter API key is available
if (!config.openRouterKey) {
  console.error('❌ Error: OPENROUTER_API_KEY is not set in environment variables');
  process.exit(1);
}

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to test AI response
async function testAI(prompt) {
  try {
    console.log(`\n🤖 Sending request to AI...`);
    console.log(`📝 Prompt: "${prompt}"`);
    
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      messages: [
        {
          role: 'system',
          content: `You are CyberGuard AI, a cybersecurity expert assistant. Follow these guidelines:
- Provide accurate, technical information about cybersecurity
- Include security best practices and potential risks
- Format responses in clear, readable markdown
- Use code blocks for commands and configurations
- Be concise but thorough in explanations
- If a query is not security-related, politely redirect to security topics`
        },
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${config.openRouterKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const aiResponse = response.data.choices[0].message.content;
    console.log('\n✅ AI Response:');
    console.log('---\n' + aiResponse + '\n---');
    
    return aiResponse;
  } catch (error) {
    console.error('\n❌ Error calling AI service:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
    return null;
  }
}

// Interactive mode
function startInteractiveMode() {
  console.log('\n🔍 CyberGuard AI Test CLI');
  console.log('Type your message or "exit" to quit\n');

  const askQuestion = () => {
    rl.question('You: ', async (input) => {
      if (input.toLowerCase() === 'exit') {
        console.log('\n👋 Goodbye!');
        rl.close();
        return;
      }

      if (input.trim()) {
        await testAI(input);
      }
      
      // Ask the next question
      askQuestion();
    });
  };

  askQuestion();
}

// Check if a prompt was provided as command line argument
const args = process.argv.slice(2);
if (args.length > 0) {
  // Run single test with provided prompt
  testAI(args.join(' '))
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} else {
  // Start interactive mode
  startInteractiveMode();
}
