const nodemailer = require('nodemailer');
const crypto = require('crypto');

class EmailService {
  constructor() {
    this.transporter = this.createTransporter();
  }

  createTransporter() {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  // Generate a 6-digit OTP
  generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
  }

  // Send OTP verification email
  async sendOTPEmail(to, otp, domainName) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@domainbuddy.com',
        to: to,
        subject: 'Domain Purchase Verification - OTP Code',
        html: this.getOTPEmailTemplate(otp, domainName),
        text: this.getOTPEmailText(otp, domainName),
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('OTP email sent successfully:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Failed to send OTP email:', error);
      throw new Error('Failed to send verification email');
    }
  }

  // HTML email template for OTP
  getOTPEmailTemplate(otp, domainName) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Domain Purchase Verification</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container {
            background-color: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
          }
          .otp-container {
            background-color: #f8fafc;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            margin: 30px 0;
          }
          .otp-code {
            font-size: 36px;
            font-weight: bold;
            color: #2563eb;
            letter-spacing: 8px;
            margin: 10px 0;
            font-family: 'Courier New', monospace;
          }
          .domain-info {
            background-color: #eff6ff;
            border-left: 4px solid #2563eb;
            padding: 15px;
            margin: 20px 0;
          }
          .warning {
            background-color: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
            color: #dc2626;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            font-size: 14px;
            color: #6b7280;
            text-align: center;
          }
          .button {
            display: inline-block;
            background-color: #2563eb;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🌐 DomainBuddy</div>
            <h1>Domain Purchase Verification</h1>
          </div>
          
          <p>Hello,</p>
          
          <p>You've initiated a domain purchase for <strong>${domainName}</strong>. To complete your purchase securely, please verify your identity using the One-Time Password (OTP) below:</p>
          
          <div class="otp-container">
            <p><strong>Your Verification Code:</strong></p>
            <div class="otp-code">${otp}</div>
            <p><small>This code expires in 3 minutes</small></p>
          </div>
          
          <div class="domain-info">
            <h3>📋 Purchase Details</h3>
            <p><strong>Domain:</strong> ${domainName}</p>
            <p><strong>Registration Period:</strong> 1 Year</p>
            <p><strong>Next Step:</strong> Enter the OTP code to complete your payment</p>
          </div>
          
          <div class="warning">
            <h4>🔒 Security Notice</h4>
            <ul>
              <li>Never share this OTP with anyone</li>
              <li>DomainBuddy will never ask for your OTP via phone or email</li>
              <li>This code expires in 3 minutes for your security</li>
              <li>If you didn't initiate this purchase, please ignore this email</li>
            </ul>
          </div>
          
          <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
          
          <div class="footer">
            <p>Best regards,<br>The DomainBuddy Team</p>
            <p><small>This is an automated email. Please do not reply to this message.</small></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Plain text version for email clients that don't support HTML
  getOTPEmailText(otp, domainName) {
    return `
Domain Purchase Verification - DomainBuddy

Hello,

You've initiated a domain purchase for ${domainName}. To complete your purchase securely, please verify your identity using the One-Time Password (OTP) below:

Verification Code: ${otp}

This code expires in 3 minutes.

Purchase Details:
- Domain: ${domainName}
- Registration Period: 1 Year
- Next Step: Enter the OTP code to complete your payment

Security Notice:
- Never share this OTP with anyone
- DomainBuddy will never ask for your OTP via phone or email
- This code expires in 3 minutes for your security
- If you didn't initiate this purchase, please ignore this email

If you have any questions or need assistance, please contact our support team.

Best regards,
The DomainBuddy Team

This is an automated email. Please do not reply to this message.
    `;
  }

  // Send payment confirmation email
  async sendPaymentConfirmationEmail(to, domainName, transactionId) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@domainbuddy.com',
        to: to,
        subject: `Payment Confirmed - Domain ${domainName} Successfully Purchased`,
        html: this.getPaymentConfirmationTemplate(domainName, transactionId),
        text: this.getPaymentConfirmationText(domainName, transactionId),
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Payment confirmation email sent successfully:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Failed to send payment confirmation email:', error);
      // Don't throw here as payment was successful, just log the error
      return { success: false, error: error.message };
    }
  }

  getPaymentConfirmationTemplate(domainName, transactionId) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Confirmed</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container {
            background-color: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #16a34a;
            margin-bottom: 10px;
          }
          .success-icon {
            font-size: 48px;
            color: #16a34a;
            margin: 20px 0;
          }
          .domain-info {
            background-color: #f0fdf4;
            border-left: 4px solid #16a34a;
            padding: 15px;
            margin: 20px 0;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            font-size: 14px;
            color: #6b7280;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🌐 DomainBuddy</div>
            <div class="success-icon">✅</div>
            <h1>Payment Successful!</h1>
          </div>
          
          <p>Congratulations! Your domain purchase has been completed successfully.</p>
          
          <div class="domain-info">
            <h3>📋 Purchase Summary</h3>
            <p><strong>Domain:</strong> ${domainName}</p>
            <p><strong>Transaction ID:</strong> ${transactionId}</p>
            <p><strong>Status:</strong> Registered and Active</p>
            <p><strong>Registration Period:</strong> 1 Year</p>
          </div>
          
          <p>Your domain is now being registered and will be available in your account shortly. You can manage your domain through your DomainBuddy dashboard.</p>
          
          <p>What's next?</p>
          <ul>
            <li>Set up DNS records for your domain</li>
            <li>Configure email forwarding if needed</li>
            <li>Monitor your domain's expiration date</li>
            <li>Set up auto-renewal to avoid losing your domain</li>
          </ul>
          
          <div class="footer">
            <p>Thank you for choosing DomainBuddy!</p>
            <p><small>This is an automated email. Please do not reply to this message.</small></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getPaymentConfirmationText(domainName, transactionId) {
    return `
Payment Successful - DomainBuddy

Congratulations! Your domain purchase has been completed successfully.

Purchase Summary:
- Domain: ${domainName}
- Transaction ID: ${transactionId}
- Status: Registered and Active
- Registration Period: 1 Year

Your domain is now being registered and will be available in your account shortly. You can manage your domain through your DomainBuddy dashboard.

What's next?
- Set up DNS records for your domain
- Configure email forwarding if needed
- Monitor your domain's expiration date
- Set up auto-renewal to avoid losing your domain

Thank you for choosing DomainBuddy!

This is an automated email. Please do not reply to this message.
    `;
  }

  // Test email configuration
  async testEmailConfiguration() {
    try {
      await this.transporter.verify();
      console.log('✅ Email configuration is valid');
      return true;
    } catch (error) {
      console.error('❌ Email configuration error:', error);
      return false;
    }
  }
}

module.exports = new EmailService();
