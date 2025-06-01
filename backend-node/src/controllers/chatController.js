const crypto = require('crypto');
const db = require('../utils/database');
const openRouter = require('../utils/openRouter');
const { Stream } = require('stream');
const { extractTextFromFile, prepareSecurityAnalysisPrompt } = require('../utils/fileAnalyzer');
const fs = require('fs');
const virusTotalScanner = require('../utils/virusTotalScanner');
const messageProcessor = require('../services/messageProcessingService');
const logger = require('../utils/logger');

const chatController = {
  /**
   * Get chat history for a user
   */
  async getHistory(req, res) {
    try {
      const userId = req.user.id;
      const history = await db.getHistory(userId);
      
      res.status(200).json({
        history: history
      });
    } catch (error) {
      console.error('Get history error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        detail: 'Error retrieving chat history'
      });
    }
  },

  /**
   * Get all active sessions for a user
   */
  async getSessions(req, res) {
    try {
      const userId = req.user.id;
      const sessions = await db.getSessions(userId);
      
      res.status(200).json({
        sessions: sessions
      });
    } catch (error) {
      console.error('Get sessions error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        detail: 'Error retrieving chat sessions'
      });
    }
  },

  /**
   * Get a specific chat session
   */
  async getSession(req, res) {
    try {
      const { sessionId } = req.params;
      
      if (!sessionId) {
        return res.status(400).json({
          error: 'Bad Request',
          detail: 'Session ID is required'
        });
      }
      
      const session = await db.getSession(sessionId);
      
      res.status(200).json({
        session: session
      });
    } catch (error) {
      console.error('Get session error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        detail: 'Error retrieving chat session'
      });
    }
  },

  /**
   * Create a new chat session
   */
  async createSession(req, res) {
    try {
      const userId = req.user.id;
      const sessionId = crypto.randomBytes(16).toString('hex');
      
      res.status(201).json({
        sessionId: sessionId,
        message: 'New chat session created'
      });
    } catch (error) {
      console.error('Create session error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        detail: 'Error creating chat session'
      });
    }
  },

  /**
   * Clear a chat session
   */
  async clearSession(req, res) {
    try {
      const { sessionId } = req.params;
      
      if (!sessionId) {
        return res.status(400).json({
          error: 'Bad Request',
          detail: 'Session ID is required'
        });
      }
      
      await db.clearSession(sessionId);
      
      res.status(200).json({
        message: 'Chat session cleared'
      });
    } catch (error) {
      console.error('Clear session error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        detail: 'Error clearing chat session'
      });
    }
  },

  /**
   * Process a chat message using OpenRouter AI with scam detection
   * Note: This is for REST API fallback, WebSocket is preferred
   */
  async processMessage(req, res) {
    try {
      const { sessionId, message, model = config.defaultModel } = req.body;
      const userId = req.user.id;
      const userEmail = req.user.email || 'unknown@example.com';

      if (!sessionId || !message) {
        return res.status(400).json({
          error: 'Bad Request',
          detail: 'Session ID and message are required'
        });
      }

      // Add user message to the database
      await db.saveMessage(userId, sessionId, 'user', message);

      // Check for scam patterns in the message
      const scamCheck = await messageProcessor.processMessage(userId, message, userEmail);
      
      // If it's a scam, return the warning immediately
      if (scamCheck && scamCheck.isScam) {
        // Add the warning to the chat history
        await db.saveMessage(userId, sessionId, 'system', scamCheck.message);
        
        return res.status(200).json({
          response: scamCheck.message,
          sessionId: sessionId,
          isScam: true,
          confidence: scamCheck.confidence
        });
      }

      // Get chat history for context
      const history = await db.getMessages(sessionId, userId, 10);
      
      // Prepare messages for the AI
      const messages = history.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      try {
        // Get response from OpenRouter
        const aiResponse = await openRouter.chatCompletion({
          model: model,
          messages: messages,
          max_tokens: 1000,
          temperature: 0.7
        });

        // Add AI response to the database
        await db.saveMessage(userId, sessionId, 'assistant', aiResponse, model);

        res.status(200).json({
          response: aiResponse,
          sessionId: sessionId
        });
      } catch (aiError) {
        logger.error('AI processing error:', aiError);
        throw new Error('Failed to get AI response');
      }
    } catch (error) {
      console.error('Process message error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        detail: 'Error processing message'
      });
    }
  },
  
  /**
   * Handle WebSocket message processing
   * This is used by the WebSocket handler in server.js
   */
  async handleWebSocketMessage(user, sessionId, message, model, socket, messageId = null) {
    try {
      logger.info('Processing WebSocket message:', { 
        user: user.email, 
        sessionId, 
        messageLength: message.length, 
        model 
      });
      
      const userId = user.id;
      const userEmail = user.email || 'unknown@example.com';
      
      // Check if this is a new session (no messages in this session yet)
      const sessionMessages = await db.getMessages(sessionId, userId, 1);
      const isNewSession = sessionMessages.length === 0;
      
      // Add user message to the database first
      // For new sessions, the first message will be used as the title
      await db.saveMessage(userId, sessionId, 'user', message, null, null, isNewSession ? message : null);
      
      // If this is a new session, get the updated session list to include the new title
      let updatedSessions = [];
      if (isNewSession) {
        updatedSessions = await db.getSessions(userId);
      }

      // Check for scam patterns in the message
      const scamCheck = await messageProcessor.processMessage(userId, message, userEmail);
      
      // If it's a scam, send the warning immediately
      if (scamCheck && scamCheck.isScam) {
        // Add the warning to the chat history
        await db.saveMessage(userId, sessionId, 'system', scamCheck.message);
        
        // Send the scam alert as a system message
        if (socket) {
          socket.emit('system_message', {
            sessionId,
            message: scamCheck.message,
            isScam: true,
            confidence: scamCheck.confidence
          });
        }
        
        return {
          success: true,
          isScam: true,
          response: scamCheck.message,
          sessionId: sessionId
        };
      }

      // Get chat history for context
      const history = await db.getMessages(sessionId, userId, 10);
      
      // Prepare messages for the AI (include system message and history)
      const messages = [
        { role: 'system', content: 'You are CyberGuard AI, an advanced cybersecurity assistant. Provide accurate, helpful information about cybersecurity topics.' },
        ...history.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      ];
      
      try {
        logger.info('Sending request to OpenRouter with messages:', { 
          messageCount: messages.length,
          model: model
        });
        
        // Get response from OpenRouter with streaming
        const stream = await openRouter.generateStreamingResponse(messages, model);
        
        // Handle streaming chunks from the AI
        const handleStreamingResponse = (data) => {
          console.log('Received streaming chunk:', data);
          
          // Find the AI message that matches this stream
          const aiMessageIndex = messages.findIndex(
            msg => msg.role === 'assistant' && msg.isStreaming && msg.messageId === data.messageId
          );
          
          if (aiMessageIndex >= 0) {
            // Update existing streaming message
            messages[aiMessageIndex] = {
              ...messages[aiMessageIndex],
              content: messages[aiMessageIndex].content + (data.chunk || ''),
              isTyping: true,
              isError: false, // Clear any previous error state
              timestamp: new Date().toISOString()
            };
          } else {
            // If no matching AI message found, check if we should create one
            const hasUserMessage = messages.some(
              msg => msg.id === data.messageId && msg.role === 'user'
            );
            
            if (hasUserMessage) {
              // Create new streaming message
              messages.push({
                id: `assistant-${data.messageId}`,
                sessionId: data.sessionId,
                messageId: data.messageId,
                content: data.chunk || '',
                role: 'assistant',
                isStreaming: true,
                isTyping: true,
                isError: false,
                timestamp: new Date().toISOString()
              });
            }
          }
          
          // Send the chunk to the client
          if (socket) {
            socket.emit('stream_chunk', {
              sessionId,
              messageId: data.messageId,
              chunk: data.chunk
            });
          }
        };
        
        // Collect all chunks for the complete response
        let fullResponse = '';
        
        // Generate a message ID if not provided
        const currentMessageId = messageId || `msg-${Date.now()}`;
        
        // Process each chunk of the response
        for await (const chunk of stream) {
          // Add chunk to full response
          fullResponse += chunk;
          
          // Handle the streaming response
          handleStreamingResponse({
            sessionId,
            messageId: currentMessageId,
            chunk
          });
        }
        
        // Save the complete AI message to the database
        if (fullResponse.trim()) {
          await db.saveMessage(userId, sessionId, 'assistant', fullResponse, model);
        }
        
        // Send the complete response back
        if (socket) {
          socket.emit('ai_response', {
            sessionId,
            messageId: currentMessageId,
            message: fullResponse,
            model: model,
            // Include updated sessions if this is a new session
            sessions: isNewSession ? updatedSessions : undefined
          });
        }
        
        return {
          success: true,
          response: fullResponse,
          sessionId: sessionId,
          // Include updated sessions if this is a new session
          sessions: isNewSession ? updatedSessions : undefined
        };
      } catch (aiError) {
        logger.error('AI processing error in WebSocket:', aiError);
        if (socket) {
          socket.emit('error', {
            error: 'Error processing message',
            detail: aiError.message || 'Failed to generate AI response'
          });
        }
        return {
          success: false,
          error: 'Error processing message',
          detail: aiError.message || 'Failed to generate AI response'
        };
      }
    } catch (error) {
      logger.error('WebSocket message error:', error);
      if (socket) {
        socket.emit('error', {
          error: 'Error processing message',
          detail: error.message || 'Unknown error occurred while processing your message'
        });
      }
      return {
        success: false,
        error: 'Error processing message',
        detail: error.message || 'Unknown error occurred while processing your message'
      };
    }
  },

  /**
   * Analyze uploaded file for security threats
   */
  async analyzeFile(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { model } = req.body;
      const userId = req.user.id;
      const file = req.file;
      
      console.log(`Analyzing file: ${file.originalname} (${file.mimetype})`);
      
      // First, try to scan with VirusTotal API if it's configured
      let vtScanResult = null;
      let threatLevel = 'unknown';
      
      try {
        vtScanResult = await virusTotalScanner.scanFile(file.path);
        
        if (!vtScanResult.error) {
          console.log('VirusTotal scan successful:', vtScanResult);
          threatLevel = vtScanResult.threatLevel;
        } else {
          console.log('VirusTotal scan failed, will use AI analysis only:', vtScanResult.error);
        }
      } catch (vtError) {
        console.error('Error during VirusTotal scan:', vtError);
        // Continue with AI analysis as fallback
      }
      
      // Extract text from file based on its type
      let fileText;
      try {
        fileText = await extractTextFromFile(file);
        console.log(`Successfully extracted text from ${file.originalname}`);
      } catch (error) {
        console.error('Text extraction error:', error);
        return res.status(500).json({ error: `Failed to extract text from file: ${error.message}` });
      }
      
      // Add VirusTotal results to the prompt if available
      let virusTotalInfo = '';
      if (vtScanResult && !vtScanResult.error) {
        virusTotalInfo = `
VIRUSTOTAL SCAN RESULTS:
- Threat Level: ${vtScanResult.threatLevel.toUpperCase()}
- Malicious Detections: ${vtScanResult.detections.malicious}/${vtScanResult.detections.totalEngines}
- Suspicious Detections: ${vtScanResult.detections.suspicious}
- Scan Date: ${vtScanResult.analysisDate}
`;
      }
      
      // Prepare a specialized prompt for security analysis
      const basePrompt = prepareSecurityAnalysisPrompt(file, fileText);
      const prompt = virusTotalInfo ? basePrompt + '\n\n' + virusTotalInfo : basePrompt;
      
      // Call AI model for analysis
      const selectedModel = model || process.env.DEFAULT_MODEL;
      const analysis = await openRouter.generateResponse(prompt, selectedModel);
      
      // Extract threat level from AI response if VirusTotal wasn't available
      if (!vtScanResult || vtScanResult.error) {
        const threatMatch = analysis.match(/THREAT LEVEL:\s*(LOW|MEDIUM|HIGH)/i);
        if (threatMatch) {
          threatLevel = threatMatch[1].toLowerCase();
        }
      }
      
      // Create a session for this analysis if requested
      let session = null;
      if (req.body.createSession === 'true') {
        // Create a new chat session
        const sessionId = crypto.randomBytes(16).toString('hex');
        
        // Save the file analysis as chat messages
        await db.saveMessage(
          userId, 
          sessionId, 
          'user', 
          `File upload: ${file.originalname} (${Math.round(file.size / 1024)} KB)`
        );
        
        // Prepare a rich analysis response with VirusTotal data if available
        let aiResponse = analysis;
        if (vtScanResult && !vtScanResult.error) {
          aiResponse = `## Security Analysis Results

**VirusTotal Scan**: ${vtScanResult.threatLevel.toUpperCase()} threat level detected
- ${vtScanResult.detections.malicious} security vendors flagged this file as malicious
- ${vtScanResult.detections.suspicious} marked it as suspicious
- Scan completed on ${new Date(vtScanResult.analysisDate).toLocaleString()}

**AI Analysis**:
${analysis}`;
        }
        
        await db.saveMessage(
          userId, 
          sessionId, 
          'assistant', 
          aiResponse, 
          selectedModel, 
          threatLevel
        );
        
        session = {
          id: sessionId,
          created: new Date().toISOString()
        };
      }
      
      // Clean up the file after analysis
      fs.unlink(file.path, (err) => {
        if (err) {
          console.error(`Error deleting file ${file.path}:`, err);
        }
      });
      
      // Return analysis results
      return res.status(200).json({
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        analysis: vtScanResult && !vtScanResult.error ? 
          `## Security Analysis Results\n\n**VirusTotal Scan**: ${vtScanResult.threatLevel.toUpperCase()} threat level detected\n- ${vtScanResult.detections.malicious} security vendors flagged this file as malicious\n- ${vtScanResult.detections.suspicious} marked it as suspicious\n\n**AI Analysis**:\n${analysis}` : 
          analysis,
        threatLevel,
        virusTotalResult: vtScanResult && !vtScanResult.error ? vtScanResult : null,
        session
      });
      
    } catch (error) {
      console.error('File analysis error:', error);
      return res.status(500).json({ error: 'Failed to analyze file' });
    }
  },
  analyzeFile: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const filePath = req.file.path;
      const fileBuffer = fs.readFileSync(filePath);
      const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // Check file size (max 100MB)
      const fileSizeInMB = req.file.size / (1024 * 1024);
      if (fileSizeInMB > 100) {
        fs.unlinkSync(filePath); // Clean up the uploaded file
        return res.status(400).json({ error: 'File size exceeds 100MB limit' });
      }

      // Check file type
      const allowedTypes = [
        'application/pdf',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/zip',
        'application/x-rar-compressed',
        'application/x-7z-compressed',
        'application/x-tar',
        'application/gzip',
        'application/x-bzip2'
      ];

      if (!allowedTypes.includes(req.file.mimetype)) {
        fs.unlinkSync(filePath); // Clean up the uploaded file
        return res.status(400).json({ error: 'Unsupported file type' });
      }

      // Check for malware using VirusTotal
      const scanResult = await virusTotalScanner.scanFile(filePath);
      
      if (scanResult.malicious > 0) {
        fs.unlinkSync(filePath); // Clean up the uploaded file
        return res.status(400).json({
          error: 'Malicious file detected',
          details: scanResult
        });
      }

      // Extract text from the file
      const fileContent = await extractTextFromFile(filePath, req.file.mimetype);
      
      // Analyze the content for security issues
      const analysisPrompt = prepareSecurityAnalysisPrompt(fileContent);
      const analysis = await openRouter.generateResponse({
        model: 'openai/gpt-4',
        messages: [
          { role: 'system', content: 'You are a cybersecurity expert analyzing files for potential security threats.' },
          { role: 'user', content: analysisPrompt }
        ]
      });

      // Clean up the uploaded file
      fs.unlinkSync(filePath);

      // Return the analysis results
      res.status(200).json({
        filename: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        fileHash,
        scanResult,
        analysis: analysis.text
      });
    } catch (error) {
      console.error('File analysis error:', error);
      return res.status(500).json({ error: 'Failed to analyze file' });
    }
  },

  /**
   * Update a session's title
   */
  updateSessionTitle: async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { title } = req.body;
      const userId = req.user.id;

      if (!sessionId || !title) {
        return res.status(400).json({
          error: 'Bad Request',
          detail: 'Session ID and title are required'
        });
      }

      // Update the session title in the database
      const updated = await db.updateSessionTitle(userId, sessionId, title);

      if (!updated) {
        return res.status(404).json({
          error: 'Not Found',
          detail: 'Session not found or not authorized'
        });
      }

      res.status(200).json({
        success: true,
        session: {
          id: sessionId,
          title: title
        }
      });
    } catch (error) {
      console.error('Update session title error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        detail: 'Error updating session title'
      });
    }
  }
};

module.exports = chatController;
