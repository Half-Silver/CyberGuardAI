const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_SERVER,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD
      },
      tls: {
        rejectUnauthorized: false // For self-signed certificates
      }
    });
  }

  async sendScamReport(userEmail, messageDetails) {
    const mailOptions = {
      from: `"${process.env.SMTP_NAME || 'CyberGuard AI'}" <${process.env.FROM_EMAIL || process.env.SMTP_USERNAME}>`,
      to: process.env.DEFAULT_RECIPIENT,
      subject: '🚨 Potential Scam Alert - Immediate Action Required',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc3545;">🚨 Potential Scam Alert</h2>
          <p><strong>Reported by:</strong> ${userEmail || 'Anonymous User'}</p>
          <p><strong>Report Time:</strong> ${new Date().toLocaleString()}</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #dc3545; margin: 15px 0;">
            <h4>Reported Message:</h4>
            <p>${messageDetails.message}</p>
          </div>
          <div style="margin-top: 20px; padding: 15px; background-color: #e9ecef; border-radius: 5px;">
            <h4>Analysis Results:</h4>
            <p>${messageDetails.analysis || 'This message has been flagged as a potential scam.'}</p>
            <p><strong>Confidence Level:</strong> ${messageDetails.confidence || 'High'}</p>
          </div>
          <p style="margin-top: 20px; font-size: 0.9em; color: #6c757d;">
            This is an automated message. Please investigate this report promptly.
          </p>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('Scam report email sent successfully');
      return { success: true, message: 'Scam report sent successfully' };
    } catch (error) {
      console.error('Error sending scam report email:', error);
      return { success: false, error: 'Failed to send scam report' };
    }
  }
}

module.exports = new EmailService();
