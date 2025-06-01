/**
 * Report Controller
 * Handles security report generation and email delivery
 */
const emailReporter = require('../utils/emailReporter');
const virusTotalScanner = require('../utils/virusTotalScanner');
const openRouter = require('../utils/openRouter');

/**
 * Report controller methods
 */
const reportController = {
  /**
   * Generate and send a security incident report
   */
  async sendIncidentReport(req, res) {
    try {
      // Validate request
      const { title, description, threatLevel, details, recipient } = req.body;
      
      if (!title || !description || !threatLevel) {
        return res.status(400).json({
          error: 'Bad Request',
          detail: 'Title, description, and threat level are required'
        });
      }
      
      // Prepare recommendations using AI
      let recommendations = '';
      try {
        const aiResponse = await openRouter.generateResponse([
          { role: 'system', content: 'You are a cybersecurity expert. Provide concise, practical recommendations for addressing the security incident described.' },
          { role: 'user', content: `Based on this security incident: ${title} - ${description} (Threat level: ${threatLevel}), what are the top 3-5 recommendations to address this issue?` }
        ]);
        recommendations = aiResponse.text;
      } catch (aiError) {
        console.error('Error generating AI recommendations:', aiError);
        recommendations = 'Unable to generate recommendations due to an error.';
      }
      
      // Prepare report data
      const reportData = {
        title,
        description,
        threatLevel,
        details: details || {},
        recommendations,
        recipient
      };
      
      // Send the report
      const result = await emailReporter.sendIncidentReport(reportData);
      
      if (result.success) {
        res.status(200).json({
          message: 'Security incident report sent successfully',
          messageId: result.messageId
        });
      } else {
        throw new Error(result.error || 'Failed to send report');
      }
    } catch (error) {
      console.error('Send incident report error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        detail: error.message || 'Error sending security incident report'
      });
    }
  },
  
  /**
   * Generate and send a scan report based on a URL or file
   */
  async sendScanReport(req, res) {
    try {
      // Validate request
      const { title, scanType, target, recipient } = req.body;
      
      if (!title || !scanType || !target) {
        return res.status(400).json({
          error: 'Bad Request',
          detail: 'Title, scan type, and target are required'
        });
      }
      
      // Validate scan type
      const validScanTypes = ['URL', 'FILE', 'SYSTEM'];
      if (!validScanTypes.includes(scanType)) {
        return res.status(400).json({
          error: 'Bad Request',
          detail: `Invalid scan type. Must be one of: ${validScanTypes.join(', ')}`
        });
      }
      
      // Perform scan based on type
      let scanResults = {};
      
      if (scanType === 'URL') {
        // Scan URL using VirusTotal
        const vtResults = await virusTotalScanner.scanUrl(target);
        
        // Prepare scan results for report
        scanResults = {
          target,
          threatLevel: vtResults.positives > 5 ? 'HIGH' : vtResults.positives > 0 ? 'MEDIUM' : 'LOW',
          maliciousCount: vtResults.positives || 0,
          totalScans: vtResults.total || 0,
          scanDetails: vtResults.scans || {},
          scanDate: vtResults.scan_date || new Date().toISOString(),
          findings: []
        };
        
        // Add findings based on scan results
        if (vtResults.positives > 0) {
          for (const [engine, result] of Object.entries(vtResults.scans || {})) {
            if (result.detected) {
              scanResults.findings.push({
                title: `${engine} Detection`,
                description: `${result.result || 'Suspicious content'} detected`,
                severity: result.result?.toLowerCase().includes('malicious') ? 'HIGH' : 'MEDIUM'
              });
            }
          }
        }
      } else if (scanType === 'FILE') {
        // For file scans, we'd typically have a file hash
        // This would be expanded in a real implementation
        scanResults = {
          target,
          threatLevel: 'LOW',
          maliciousCount: 0,
          suspiciousCount: 0,
          scanDetails: {
            format: 'Unknown',
            size: 'Unknown',
            hash: target // Assuming target is a hash in this case
          },
          findings: []
        };
      } else {
        // System scan (placeholder)
        scanResults = {
          target: 'System',
          threatLevel: 'LOW',
          maliciousCount: 0,
          suspiciousCount: 0,
          scanDetails: {
            scanType: 'Basic system scan',
            componentsScanned: ['Memory', 'Startup items', 'Critical files']
          },
          findings: []
        };
      }
      
      // Prepare report data
      const reportData = {
        title,
        scanType,
        results: scanResults,
        recipient
      };
      
      // Send the report
      const result = await emailReporter.sendScanReport(reportData);
      
      if (result.success) {
        res.status(200).json({
          message: 'Scan report sent successfully',
          messageId: result.messageId,
          scanResults
        });
      } else {
        throw new Error(result.error || 'Failed to send scan report');
      }
    } catch (error) {
      console.error('Send scan report error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        detail: error.message || 'Error sending scan report'
      });
    }
  },
  
  /**
   * Send a generic security report
   */
  async sendGenericReport(req, res) {
    try {
      // Validate request
      const { title, content, metrics, recipient } = req.body;
      
      if (!title || !content) {
        return res.status(400).json({
          error: 'Bad Request',
          detail: 'Title and content are required'
        });
      }
      
      // Prepare report data
      const reportData = {
        title,
        content,
        metrics: metrics || {},
        recipient
      };
      
      // Send the report
      const result = await emailReporter.sendGenericReport(reportData);
      
      if (result.success) {
        res.status(200).json({
          message: 'Report sent successfully',
          messageId: result.messageId
        });
      } else {
        throw new Error(result.error || 'Failed to send report');
      }
    } catch (error) {
      console.error('Send generic report error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        detail: error.message || 'Error sending report'
      });
    }
  },
  
  /**
   * Get reporting configuration
   */
  getReportConfig(req, res) {
    try {
      // Return current reporting configuration (sanitized)
      res.status(200).json({
        smtpConfigured: Boolean(process.env.SMTP_SERVER && process.env.SMTP_USERNAME),
        defaultRecipient: process.env.DEFAULT_RECIPIENT,
        reportTypes: [
          {
            id: 'incident',
            name: 'Security Incident Report',
            description: 'Report security incidents with threat assessment'
          },
          {
            id: 'scan',
            name: 'Security Scan Report',
            description: 'Report results from security scans of URLs, files, or systems'
          },
          {
            id: 'generic',
            name: 'Generic Security Report',
            description: 'Send custom security reports with flexible content'
          }
        ]
      });
    } catch (error) {
      console.error('Get report config error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        detail: 'Error retrieving reporting configuration'
      });
    }
  }
};

module.exports = reportController;
