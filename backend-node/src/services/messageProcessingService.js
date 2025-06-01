const scamDetectionService = require('./scamDetectionService');
const emailService = require('./emailService');

class MessageProcessingService {
  constructor() {
    this.userSessions = new Map(); // Track user interactions
  }

  async processMessage(userId, message, userEmail = 'unknown@example.com') {
    // Detect if message is a scam
    const detectionResult = scamDetectionService.detectScam(message);
    
    // Get appropriate response
    const response = this.generateResponse(detectionResult, message);
    
    // If it's a confirmed scam, send email report
    if (detectionResult.isScam && this.shouldReportScam(userId, message)) {
      await this.reportScam(userEmail, message, detectionResult);
    }

    return {
      success: true,
      message: response,
      isScam: detectionResult.isScam,
      confidence: detectionResult.confidence
    };
  }

  generateResponse(detectionResult, originalMessage) {
    if (!detectionResult.isScam) {
      return null; // No response needed for non-scam messages
    }

    // Get the most severe issue
    const mainIssue = detectionResult.details.reduce((prev, current) => 
      (prev.weight > current.weight) ? prev : current
    );

    let response = "⚠️ **Scam Alert!** I've detected potential scam indicators in this message. \n\n";
    
    // Add specific advice based on the type of scam
    switch(mainIssue.type) {
      case 'financial_scam':
        response += "🚩 **Financial Scam Detected**\n";
        response += "This appears to be a financial scam. Never send money to claim prizes or winnings. ";
        response += "Legitimate organizations will never ask you to pay fees to receive money you've won.\n\n";
        break;
      case 'payment_request':
        response += "💸 **Suspicious Payment Request**\n";
        response += "Be cautious! This message is asking for money, which is a common scam tactic. ";
        response += "Never transfer money to someone you don't know personally.\n\n";
        break;
      case 'urgency_tactic':
        response += "⏰ **False Urgency Detected**\n";
        response += "Scammers often create a false sense of urgency to pressure you into acting without thinking. ";
        response += "Take your time to verify any claims before taking action.\n\n";
        break;
      case 'information_harvesting':
        response += "🔒 **Personal Information Theft Attempt**\n";
        response += "This seems like an attempt to steal personal information. ";
        response += "Never share sensitive details like passwords, SSN, or credit card information through unsecured channels.\n\n";
        break;
      default:
        response += "⚠️ **Suspicious Activity Detected**\n";
        response += "This message contains characteristics commonly found in scams. ";
        response += "Please be extremely cautious.\n\n";
    }

    // Add general advice
    response += "**What you should do now:**\n";
    response += "• Do not send any money or provide personal information\n";
    response += "• Verify the information through official channels\n";
    response += "• Report suspicious messages to the appropriate authorities\n\n";
    response += "I've automatically reported this to our security team for further investigation.";
    
    return response;
  }

  shouldReportScam(userId, message) {
    // Check if we've recently reported a similar message from this user
    const userSession = this.getUserSession(userId);
    
    // Don't report the same message multiple times
    if (userSession.lastReportedMessage === message) {
      return false;
    }

    // Update session
    userSession.lastReportedMessage = message;
    userSession.lastReportTime = Date.now();
    this.userSessions.set(userId, userSession);
    
    return true;
  }

  async reportScam(userEmail, message, detectionResult) {
    try {
      const reportDetails = {
        message,
        analysis: detectionResult.details.map(d => `${d.description} (${d.type}): ${d.matched}`).join('\n'),
        confidence: detectionResult.confidence,
        timestamp: new Date().toISOString()
      };

      await emailService.sendScamReport(userEmail, reportDetails);
      console.log(`Scam report sent for message from ${userEmail}`);
    } catch (error) {
      console.error('Failed to send scam report:', error);
    }
  }

  getUserSession(userId) {
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, {
        lastReportedMessage: null,
        lastReportTime: null,
        reportCount: 0
      });
    }
    return this.userSessions.get(userId);
  }
}

module.exports = new MessageProcessingService();
