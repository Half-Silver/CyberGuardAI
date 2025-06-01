class ScamDetectionService {
  constructor() {
    this.scamPatterns = [
      // Money-related scams
      { 
        pattern: /(won|win|prize|lottery|reward).*\$?\d+([.,]\d{1,2})?/i, 
        weight: 0.8,
        type: 'financial_scam',
        description: 'Mentions winning money or prizes'
      },
      { 
        pattern: /(pay|send|transfer|deposit|fee).*\$?\d+([.,]\d{1,2})?/i, 
        weight: 0.7,
        type: 'payment_request',
        description: 'Requests for payment or transfer of money'
      },
      
      // Urgency indicators
      { 
        pattern: /(urgent|immediately|right away|asap|limited time|act now)/i, 
        weight: 0.6,
        type: 'urgency_tactic',
        description: 'Creates false urgency'
      },
      
      // Personal information requests
      { 
        pattern: /(password|ssn|social security|credit card|bank account|personal info)/i, 
        weight: 0.9,
        type: 'information_harvesting',
        description: 'Requests for sensitive personal information'
      },
      
      // Common scam phrases
      { 
        pattern: /(Nigerian prince|inheritance|unclaimed money|tax refund|free gift|account suspended)/i, 
        weight: 0.85,
        type: 'common_scam_phrase',
        description: 'Contains known scam phrases'
      }
    ];
  }

  detectScam(message) {
    if (!message || typeof message !== 'string') {
      return { isScam: false, confidence: 0, details: [] };
    }

    const details = [];
    let totalWeight = 0;

    // Check against each pattern
    this.scamPatterns.forEach(pattern => {
      if (pattern.pattern.test(message)) {
        details.push({
          type: pattern.type,
          description: pattern.description,
          weight: pattern.weight,
          matched: message.match(pattern.pattern)[0]
        });
        totalWeight += pattern.weight;
      }
    });

    // Calculate confidence score (0-1)
    const confidence = Math.min(1, totalWeight / 2); // Cap at 1.0
    const isScam = confidence > 0.5; // Threshold for considering it a scam

    return {
      isScam,
      confidence: parseFloat(confidence.toFixed(2)),
      details
    };
  }

  getScamResponse(detectionResult) {
    if (!detectionResult.isScam) {
      return null;
    }

    // Generate a response based on the type of scam detected
    const mainIssue = detectionResult.details.reduce((prev, current) => 
      (prev.weight > current.weight) ? prev : current
    );

    let response = "⚠️ **Scam Alert!** I've detected potential scam indicators in this message. ";
    
    switch(mainIssue.type) {
      case 'financial_scam':
        response += "This appears to be a financial scam. Never send money to claim prizes or winnings. ";
        break;
      case 'payment_request':
        response += "Be cautious! This message is asking for money, which is a common scam tactic. ";
        break;
      case 'urgency_tactic':
        response += "Scammers often create a false sense of urgency. Take your time to verify any claims. ";
        break;
      case 'information_harvesting':
        response += "This seems like an attempt to steal personal information. Never share sensitive details. ";
        break;
      default:
        response += "This message contains characteristics commonly found in scams. ";
    }

    response += "Would you like me to report this to our security team? (Yes/No)";
    
    return response;
  }
}

module.exports = new ScamDetectionService();
