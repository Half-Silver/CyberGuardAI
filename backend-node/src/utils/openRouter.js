const axios = require('axios');
const config = require('../config/config');
const logger = require('./logger');

class OpenRouterService {
  constructor() {
    if (!config.openRouterApiKey) {
      logger.error('OpenRouter API key is missing in config');
      throw new Error('OpenRouter API key is not configured');
    }
    
    this.apiKey = config.openRouterApiKey;
    this.baseUrl = 'https://openrouter.ai/api/v1';
    this.defaultModel = config.defaultModel || 'openai/gpt-3.5-turbo';
  }

  /**
   * Generate a streaming response from OpenRouter
   * @param {Array} messages - Array of message objects with role and content
   * @param {string} model - Model to use for the response
   * @param {Object} options - Additional options like max_tokens, temperature, etc.
   * @returns {AsyncGenerator<string>} - Async generator that yields chunks of the response
   */
  async *generateStreamingResponse(messages, model = null, options = {}) {
    try {
      const modelToUse = model || this.defaultModel;
      logger.info(`Generating streaming response using model: ${modelToUse}`);
      
      const response = await axios({
        method: 'post',
        url: `${this.baseUrl}/chat/completions`,
        responseType: 'stream',
        data: {
          model: modelToUse,
          messages: [
            { 
              role: "system", 
              content: "You are CyberGuard AI, an advanced cybersecurity assistant. Provide accurate, helpful information about cybersecurity topics. Focus on clear explanations and practical advice. Include warnings about potential security risks when appropriate." 
            },
            ...messages
          ],
          max_tokens: options.max_tokens || 1024,
          temperature: options.temperature || 0.7,
          stream: true
        },
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://cyberguard-ai.com',
          'X-Title': 'CyberGuard AI'
        }
      });

      // Process the streaming response
      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          const message = line.replace(/^data: /, '').trim();
          
          // Skip empty messages and the [DONE] message
          if (message === '' || message === '[DONE]') {
            continue;
          }
          
          try {
            const parsed = JSON.parse(message);
            if (parsed.choices?.[0]?.delta?.content) {
              yield parsed.choices[0].delta.content;
            }
          } catch (error) {
            logger.error('Error parsing message chunk:', { error, message });
          }
        }
      }
    } catch (error) {
      logger.error('OpenRouter streaming error:', error);
      throw new Error(error.response?.data?.error?.message || 'Error in streaming response');
    }
  }

  /**
   * Generate a complete response from OpenRouter (non-streaming)
   */
  async generateResponse(messages, model = null, options = {}) {
    try {
      const modelToUse = model || this.defaultModel;
      logger.info(`Generating response using model: ${modelToUse}`);

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: modelToUse,
          messages: [
            { 
              role: "system", 
              content: "You are CyberGuard AI, an advanced cybersecurity assistant. Provide accurate, helpful information about cybersecurity topics. Focus on clear explanations and practical advice. Include warnings about potential security risks when appropriate." 
            },
            ...messages
          ],
          max_tokens: options.max_tokens || 1024,
          temperature: options.temperature || 0.7,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': 'https://cyberguard-ai.com',
            'X-Title': 'CyberGuard AI'
          }
        }
      );

      if (response.data?.choices?.[0]?.message?.content) {
        return {
          text: response.data.choices[0].message.content,
          model: modelToUse,
          usage: response.data.usage || {}
        };
      }
      
      throw new Error('No response generated from OpenRouter');
    } catch (error) {
      logger.error('Error in generateResponse:', error);
      throw new Error(error.response?.data?.error?.message || 'Error generating AI response');
    }
  }

  /**
   * Analyze text for security risks
   * @param {string} text - Text to analyze for security risks
   * @returns {Promise<Object>} - Analysis result with threat level and details
   */
  async analyzeSecurityRisk(text) {
    const analysisPrompt = [
      { 
        role: "system", 
        content: `You are a cybersecurity threat analyzer. Evaluate the following content for potential security threats or vulnerabilities. 
        Provide a detailed analysis including:
        - Threat level (LOW, MEDIUM, or HIGH)
        - Type of threat (if any)
        - Explanation of the risk
        - Recommended actions (if applicable)` 
      },
      { 
        role: "user", 
        content: `Analyze this for security threats: "${text}"` 
      }
    ];

    try {
      const response = await this.generateResponse(analysisPrompt);
      
      // Extract threat level from response
      let threatLevel = 'LOW';
      const content = response.text.toUpperCase();
      
      if (content.includes('HIGH THREAT') || content.includes('THREAT LEVEL: HIGH') || content.includes('THREAT LEVEL HIGH')) {
        threatLevel = 'HIGH';
      } else if (content.includes('MEDIUM THREAT') || content.includes('THREAT LEVEL: MEDIUM') || content.includes('THREAT LEVEL MEDIUM')) {
        threatLevel = 'MEDIUM';
      }
      
      return {
        threatLevel,
        analysis: response.text,
        model: response.model
      };
    } catch (error) {
      logger.error('Error in analyzeSecurityRisk:', error);
      throw new Error('Failed to analyze security risk');
    }
  }

  async getAvailableModels() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/models`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': 'https://cyberguard-ai.com',
            'X-Title': 'CyberGuard AI'
          }
        }
      );

      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching models:', error);
      return [];
    }
  }
}

module.exports = new OpenRouterService();
