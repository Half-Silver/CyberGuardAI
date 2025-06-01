/**
 * Email Reporter Utility
 * Handles generation and sending of security reports via email
 */
const nodemailer = require('nodemailer');
const config = require('../config/config');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: config.smtpServer,
    port: config.smtpPort,
    secure: config.smtpPort === 465, // true for 465, false for other ports
    auth: {
      user: config.smtpUsername,
      pass: config.smtpPassword
    }
  });
};

// Template directory
const templatesDir = path.join(__dirname, '../../views/email-templates');

// Ensure templates directory exists
if (!fs.existsSync(templatesDir)) {
  fs.mkdirSync(templatesDir, { recursive: true });
}

/**
 * Email reporting utility
 */
const emailReporter = {
  /**
   * Generate and send a security incident report
   * @param {Object} data - Security incident data
   * @param {string} data.title - Incident title
   * @param {string} data.description - Incident description
   * @param {string} data.threatLevel - Threat level (LOW, MEDIUM, HIGH)
   * @param {Object} data.details - Additional details about the incident
   * @param {string} [data.recipient] - Optional recipient email, will use default from config if not provided
   * @returns {Promise<Object>} - Send result
   */
  async sendIncidentReport(data) {
    try {
      // Basic validation
      if (!data.title || !data.description || !data.threatLevel) {
        throw new Error('Missing required incident data');
      }
      
      // Generate report content
      const reportHtml = await this.generateReportHtml('incident-report', data);
      
      // Set up email data
      const emailData = {
        from: `"${config.smtpName}" <${config.fromEmail}>`,
        to: data.recipient || config.defaultRecipient,
        subject: `[CyberGuard AI] Security Incident Report: ${data.title}`,
        html: reportHtml
      };
      
      // Send the email
      const transporter = createTransporter();
      const result = await transporter.sendMail(emailData);
      
      console.log(`Security incident report sent: ${result.messageId}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Error sending incident report:', error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Send a security scan report
   * @param {Object} data - Scan data
   * @param {string} data.title - Scan title
   * @param {string} data.scanType - Type of scan (URL, FILE, SYSTEM)
   * @param {Object} data.results - Scan results
   * @param {string} [data.recipient] - Optional recipient email
   * @returns {Promise<Object>} - Send result
   */
  async sendScanReport(data) {
    try {
      // Basic validation
      if (!data.title || !data.scanType || !data.results) {
        throw new Error('Missing required scan data');
      }
      
      // Generate report content
      const reportHtml = await this.generateReportHtml('scan-report', data);
      
      // Set up email data
      const emailData = {
        from: `"${config.smtpName}" <${config.fromEmail}>`,
        to: data.recipient || config.defaultRecipient,
        subject: `[CyberGuard AI] Security Scan Report: ${data.title}`,
        html: reportHtml
      };
      
      // Send the email
      const transporter = createTransporter();
      const result = await transporter.sendMail(emailData);
      
      console.log(`Scan report sent: ${result.messageId}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Error sending scan report:', error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Generate a generic security report
   * @param {Object} data - Report data
   * @param {string} data.title - Report title
   * @param {string} data.content - Report content
   * @param {Object} [data.metrics] - Optional metrics to include
   * @param {string} [data.recipient] - Optional recipient email
   * @returns {Promise<Object>} - Send result
   */
  async sendGenericReport(data) {
    try {
      // Basic validation
      if (!data.title || !data.content) {
        throw new Error('Missing required report data');
      }
      
      // Generate report content
      const reportHtml = await this.generateReportHtml('generic-report', data);
      
      // Set up email data
      const emailData = {
        from: `"${config.smtpName}" <${config.fromEmail}>`,
        to: data.recipient || config.defaultRecipient,
        subject: `[CyberGuard AI] Security Report: ${data.title}`,
        html: reportHtml
      };
      
      // Send the email
      const transporter = createTransporter();
      const result = await transporter.sendMail(emailData);
      
      console.log(`Generic report sent: ${result.messageId}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Error sending generic report:', error);
      return { success: false, error: error.message };
    }
  },
  
  /**
   * Generate HTML for a report using EJS templates
   * @param {string} templateName - Name of the template file (without extension)
   * @param {Object} data - Data to inject into the template
   * @returns {Promise<string>} - Generated HTML
   */
  async generateReportHtml(templateName, data) {
    try {
      // Add default data for all templates
      const templateData = {
        ...data,
        date: new Date().toISOString(),
        generatedBy: 'CyberGuard AI',
        version: '1.0.0'
      };
      
      // Check if template exists
      const templatePath = path.join(templatesDir, `${templateName}.ejs`);
      if (!fs.existsSync(templatePath)) {
        // Use default template if the specific one doesn't exist
        return this.generateDefaultTemplate(templateData);
      }
      
      // Render template
      const template = fs.readFileSync(templatePath, 'utf8');
      return ejs.render(template, templateData);
    } catch (error) {
      console.error('Error generating report HTML:', error);
      return this.generateDefaultTemplate(data);
    }
  },
  
  /**
   * Generate a default HTML template for when a specific template is not found
   * @param {Object} data - Template data
   * @returns {string} - Default HTML template
   */
  generateDefaultTemplate(data) {
    const threatColorMap = {
      HIGH: '#e74c3c',
      MEDIUM: '#f39c12',
      LOW: '#3498db',
      UNKNOWN: '#95a5a6'
    };
    
    const threatColor = threatColorMap[data.threatLevel] || '#95a5a6';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>CyberGuard AI Report: ${data.title}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            color: #333;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            border: 1px solid #ddd;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          }
          .header {
            background-color: #1a237e;
            color: white;
            padding: 20px;
            border-top-left-radius: 5px;
            border-top-right-radius: 5px;
          }
          .content {
            padding: 20px;
          }
          .footer {
            background-color: #f5f5f5;
            padding: 15px 20px;
            font-size: 12px;
            color: #666;
            border-bottom-left-radius: 5px;
            border-bottom-right-radius: 5px;
          }
          .threat-badge {
            display: inline-block;
            background-color: ${threatColor};
            color: white;
            padding: 5px 10px;
            border-radius: 3px;
            font-weight: bold;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
          }
          table, th, td {
            border: 1px solid #ddd;
          }
          th, td {
            padding: 10px;
            text-align: left;
          }
          th {
            background-color: #f2f2f2;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>CyberGuard AI</h1>
            <h2>${data.title}</h2>
          </div>
          <div class="content">
            ${data.threatLevel ? `<p>Threat Level: <span class="threat-badge">${data.threatLevel}</span></p>` : ''}
            <p>${data.description || data.content || 'No description provided.'}</p>
            
            ${data.details ? `
              <h3>Details</h3>
              <table>
                <tbody>
                  ${Object.entries(data.details).map(([key, value]) => `
                    <tr>
                      <th>${key}</th>
                      <td>${value}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : ''}
            
            ${data.results ? `
              <h3>Scan Results</h3>
              <table>
                <tbody>
                  ${Object.entries(data.results).map(([key, value]) => `
                    <tr>
                      <th>${key}</th>
                      <td>${typeof value === 'object' ? JSON.stringify(value) : value}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : ''}
            
            ${data.metrics ? `
              <h3>Metrics</h3>
              <table>
                <tbody>
                  ${Object.entries(data.metrics).map(([key, value]) => `
                    <tr>
                      <th>${key}</th>
                      <td>${value}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : ''}
          </div>
          <div class="footer">
            <p>Generated by CyberGuard AI on ${new Date().toLocaleString()}</p>
            <p>This is an automated security report. If you have any questions, please contact your security administrator.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
};

module.exports = emailReporter;
