import nodemailer from "nodemailer";
import type { Transporter, SendMailOptions } from "nodemailer";
import type { Options as SMTPTransportOptions } from 'nodemailer/lib/smtp-transport'
import type { Options as SMTPPoolOptions } from 'nodemailer/lib/smtp-pool'
import logger from "../../utils/logger";
import CONFIG from "../../config/env";
import ApiError from "../../utils/ApiError";
import { promises as dns } from 'dns';

const DEFAULT_FROM = `"Trava" <${CONFIG.SMTP_USER}>`

interface SMTPConfig {
	host: string;
	port: number;
	secure: boolean;
	user: string;
	pass: string;
}

interface SendTemplateEmailOptions {
	to: string;
	subject: string;
	text: string;
	html?: string;
	from?: string;
}

interface PaymentEmailOptions {
	email: string;
	customerName: string;
	amount: number;
	currency: string;
	transactionId: string;
	paymentMethod?: string;
	bookingReference?: string;
	failureReason?: string;
}

interface GenericEmailOptions {
  to: string;
  name: string;
  subject: string;
  message: string;
  url?: string; // Optional URL for a call-to-action button
}

const validateSmtpConfig = (config: Partial<SMTPConfig>): SMTPConfig => {
	const errors: string[] = [];
	if (!config.host) errors.push('SMTP_HOST is required');
	if (config.port === undefined || config.port === null || isNaN(Number(config.port)))
		errors.push('SMTP_PORT must be a valid number');
	if (config.secure === undefined) {
		config.secure = Number(config.port) === 465;
	}
	if (!config.user) errors.push('SMTP_USER is required');
	if (!config.pass) errors.push('SMTP_PASS is required');

	if (errors.length > 0) {
		const errorMessage = `Invalid SMTP configuration: ${errors.join(', ')}`;
		logger.error(errorMessage);
		throw new Error(errorMessage);
	}
	config.port = Number(config.port);
	return config as SMTPConfig;
};

const SMTPConfig: SMTPConfig = validateSmtpConfig({
	host: CONFIG.SMTP_HOST,
	port: CONFIG.SMTP_PORT ? Number(CONFIG.SMTP_PORT) : undefined,
	secure: CONFIG.SMTP_SECURE !== undefined ? CONFIG.SMTP_SECURE === 'true' : undefined,
	user: CONFIG.SMTP_USER,
	pass: CONFIG.SMTP_PASS,
});

const transportOptions: SMTPPoolOptions = {
	host: SMTPConfig.host,
	port: SMTPConfig.port,
	secure: SMTPConfig.secure,
	auth: {
		user: SMTPConfig.user,
		pass: SMTPConfig.pass,
	},
	pool: true,
	maxConnections: 10, // Increased for better scalability
	maxMessages: 1000, // Increased for better throughput
	rateLimit: 50, // Limit emails per second to prevent rate limiting
	greetingTimeout: 30000, // Increased timeout
	socketTimeout: 30000,
	connectionTimeout: 15000,
	logger: CONFIG.NODE_ENV !== 'production',
	debug: CONFIG.NODE_ENV !== 'production',
};

class EmailService {
	private transporter: Transporter;
	private isVerified: boolean = false;
	private readonly maxRetries: number = 3;
	private readonly retryDelay: number = 1000; // 1 second
	
	constructor(transporterOpts: SMTPTransportOptions) {
		try {
			this.transporter = nodemailer.createTransport(transporterOpts);
			logger.info('Nodemailer transporter created successfully.');
			
			// Verify connection asynchronously without blocking initialization
			this.verifyConnection().then(verified => {
				this.isVerified = verified;
			}).catch(() => {
				logger.warn('Initial SMTP connection verification failed. Service will attempt to send emails regardless.');
				this.isVerified = false;
			});
		} catch (error: any) {
			const errorMessage = error?.message || 'Unknown error';
			logger.error('Failed to create Nodemailer transporter:', errorMessage);
			throw new Error(`Failed to initialize email service transporter: ${errorMessage}`);
		}
	}

	async verifyConnection(throwError = false): Promise<boolean> {
		try {
			await this.transporter.verify();
			logger.info('Nodemailer transporter connection verified successfully.');
			this.isVerified = true;
			return true;
		} catch (error: any) {
			const errorMessage = error?.message || 'Unknown error';
			logger.error('Nodemailer transporter connection verification failed:', { error: errorMessage });

			this.isVerified = false;
			if (throwError) {
				throw new Error(`SMTP connection verification failed: ${errorMessage}`);
			}
			return false;
		}
	}

	private async delay(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	private async sendWithRetry(mailPayload: SendMailOptions, attempt = 1): Promise<any> {
		try {
			return await this.transporter.sendMail(mailPayload);
		} catch (error: any) {
			if (attempt < this.maxRetries) {
				logger.warn(`Email send attempt ${attempt} failed, retrying in ${this.retryDelay}ms...`, {
					error: error?.message,
					to: mailPayload.to,
					subject: mailPayload.subject
				});
				
				await this.delay(this.retryDelay * attempt); // Exponential backoff
				return this.sendWithRetry(mailPayload, attempt + 1);
			}
			throw error;
		}
	}

	async sendMail(options: SendTemplateEmailOptions): Promise<void> {
		const { to, subject, text, html, from = DEFAULT_FROM } = options;

		// Input validation
		if (!to || !subject || !text) {
			throw new ApiError('Missing required options for sending email (to, subject, text).', 400);
		}

		// Email validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(to)) {
			throw new ApiError(`Invalid email address: ${to}`, 400);
		}

		try {
			const mailPayload: SendMailOptions = {
				from: from,
				to: to,
				subject: subject,
				text: text,
				...(html && { html }),
				headers: {
					'X-Mailer': 'Trava Email Service',
					'X-Priority': '3 (Normal)',
					'Message-ID': `<${Date.now()}-${Math.random().toString(36).substr(2, 9)}@trava.com>`,
				}
			};

			const info = await this.sendWithRetry(mailPayload);
			logger.info(`Email sent successfully`, {
				to,
				subject,
				messageId: info.messageId,
				response: info.response
			});
		} catch (error: any) {
			const errorMessage = error?.message || 'Unknown SMTP error';
			logger.error(`Failed to send email`, {
				to,
				subject,
				error: errorMessage,
				stack: error?.stack
			});
			throw new ApiError(`Failed to send email to ${to}`, 500);
		}
	}

	async sendGenericEmail(options: GenericEmailOptions): Promise<void> {
    const { to, name, subject, message, url } = options;

    if (!to || !name || !subject || !message) {
      throw new ApiError('Missing required fields for generic email (to, name, subject, message).', 400);
    }

    const text = `Hi ${name},\n\n${message}\n\n${url ? `You can view more details here: ${url}` : ''}\n\nThe Trava Team`;

    const html = `
      <div style="font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; max-width: 600px; margin: 20px auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #007bff; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Trava Notification</h1>
        </div>
        <div style="padding: 30px 20px; font-size: 16px; line-height: 1.6; color: #333;">
          <h2 style="font-size: 20px; color: #333;">Hi ${name},</h2>
          <p>${message.replace(/\n/g, '<br>')}</p>
          ${url ? `
            <div style="text-align: center; margin: 30px 0;">
              <a href="${url}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">View Details</a>
            </div>
          ` : ''}
          <p style="margin-top: 30px;">Best regards,<br>The Trava Team</p>
        </div>
        <div style="background-color: #f7f7f7; color: #888; padding: 15px 20px; text-align: center; font-size: 12px;">
          <p>This is an automated notification. Please do not reply to this email.</p>
          <p>&copy; ${new Date().getFullYear()} Trava. All rights reserved.</p>
        </div>
      </div>
    `;

    await this.sendMail({
      to,
      subject,
      text,
      html
    });
  }


	async sendVerificationEmail(email: string, token: string, fullName?: string): Promise<void> {
		if (!email || !token) {
			throw new ApiError('Email and token are required for verification email', 400);
		}

		const isProduction = CONFIG.NODE_ENV === 'production';
		const baseUrl = isProduction ? CONFIG.FRONTEND_URL : "http://localhost:4000";
		const verificationLink = `${baseUrl}/verify-email?token=${token}`;
		const expiryInfo = new Date(Date.now() + CONFIG.JWT_VERIFICATION_EXPIRY).toUTCString();
	
		const name = fullName.split(" ")[0] || 'User';

		const text = `Hi ${name},\nPlease verify your email address to complete your Trava signup by clicking on the verification link: ${verificationLink}. This link will expire in ${expiryInfo}.`;

		const html = `
			<p> Hi ${name},</p>
			<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
				<h2 style="color: #333;">Welcome to Trava!</h2>
				<p>Please verify your email address to complete your signup.</p>
				<div style="text-align: center; margin: 30px 0;">
					<a href="${verificationLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email Address</a>
				</div>
				<p style="color: #666; font-size: 12px;">If the button doesn't work, copy and paste this link into your browser: ${verificationLink}</p>
				<p style="color: #666; font-size: 12px;">This link will expire in ${expiryInfo}.</p>
			</div>
		`;

		await this.sendMail({
			to: email,
			subject: 'Trava - Verify your Email Address',
			text,
			html
		});
	}

	async sendWelcomeEmailOnboarding(email: string, name: string): Promise<void> {
		if (!email || !name) {
			throw new ApiError('Email and name are required for welcome email', 400);
		}

		const text = `Hi ${name.split(" ")[0]}, welcome to Trava - your travel companion! We're excited to have you join our community of travelers.`;
		
		const html = `
			<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
				<h2 style="color: #333;">Welcome to Trava, ${name.split(" ")[0]}!</h2>
				<p>We're thrilled to have you join our community of travel enthusiasts.</p>
				<p>Get ready to discover amazing destinations and connect with fellow travelers.</p>
				<div style="text-align: center; margin: 30px 0;">
					<a href="${CONFIG.FRONTEND_URL || 'https://trava.com'}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Start Exploring</a>
				</div>
				<p>Happy travels!</p>
				<p>The Trava Team</p>
			</div>
		`;

		await this.sendMail({
			to: email,
			subject: 'Welcome to Trava!',
			text,
			html
		});
	}

	async sendPaymentSuccessEmail(options: PaymentEmailOptions): Promise<void> {
		const { email, customerName, amount, currency, transactionId, paymentMethod = 'Card', bookingReference } = options;

		if (!email || !customerName || !amount || !currency || !transactionId) {
			throw new ApiError('Missing required fields for payment success email', 400);
		}

		const formattedAmount = new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currency.toUpperCase()
		}).format(amount);

		const text = `Hi ${customerName}, your payment of ${formattedAmount} has been processed successfully. Transaction ID: ${transactionId}${bookingReference ? `. Booking Reference: ${bookingReference}` : ''}. Thank you for choosing Trava!`;

		const html = `
			<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
				<div style="background-color: #28a745; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
					<h2 style="margin: 0;">Payment Successful!</h2>
				</div>
				<div style="padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px;">
					<p>Hi ${customerName},</p>
					<p>Great news! Your payment has been processed successfully.</p>
					
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
						<h3 style="margin-top: 0; color: #333;">Payment Details</h3>
						<p><strong>Amount:</strong> ${formattedAmount}</p>
						<p><strong>Payment Method:</strong> ${paymentMethod}</p>
						<p><strong>Transaction ID:</strong> ${transactionId}</p>
						${bookingReference ? `<p><strong>Booking Reference:</strong> ${bookingReference}</p>` : ''}
						<p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
					</div>
					
					<p>Thank you for choosing Trava for your travel needs. We hope you have an amazing trip!</p>
					
					<div style="text-align: center; margin: 30px 0;">
						<a href="${CONFIG.FRONTEND_URL || 'https://trava.com'}/bookings" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">View My Bookings</a>
					</div>
				</div>
			</div>
		`;

		await this.sendMail({
			to: email,
			subject: 'Payment Confirmation - Trava',
			text,
			html
		});
	}

	async sendPaymentFailureEmail(options: PaymentEmailOptions): Promise<void> {
		const { email, customerName, amount, currency, transactionId, paymentMethod = 'Card', failureReason = 'Payment could not be processed' } = options;

		if (!email || !customerName || !amount || !currency) {
			throw new ApiError('Missing required fields for payment failure email', 400);
		}

		const formattedAmount = new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currency.toUpperCase()
		}).format(amount);

		const text = `Hi ${customerName}, we're sorry to inform you that your payment of ${formattedAmount} could not be processed. Reason: ${failureReason}${transactionId ? `. Transaction ID: ${transactionId}` : ''}. Please try again or contact our support team.`;

		const html = `
			<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
				<div style="background-color: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
					<h2 style="margin: 0;">Payment Failed</h2>
				</div>
				<div style="padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px;">
					<p>Hi ${customerName},</p>
					<p>We're sorry to inform you that your recent payment could not be processed.</p>
					
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
						<h3 style="margin-top: 0; color: #333;">Payment Details</h3>
						<p><strong>Amount:</strong> ${formattedAmount}</p>
						<p><strong>Payment Method:</strong> ${paymentMethod}</p>
						${transactionId ? `<p><strong>Transaction ID:</strong> ${transactionId}</p>` : ''}
						<p><strong>Failure Reason:</strong> ${failureReason}</p>
						<p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
					</div>
					
					<p>Please check your payment details and try again. If you continue to experience issues, please contact our support team.</p>
					
					<div style="text-align: center; margin: 30px 0;">
						<a href="${CONFIG.FRONTEND_URL || 'https://trava.com'}/retry-payment" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-right: 10px;">Retry Payment</a>
						<a href="${CONFIG.FRONTEND_URL || 'https://trava.com'}/support" style="background-color: #6c757d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Contact Support</a>
					</div>
				</div>
			</div>
		`;

		await this.sendMail({
			to: email,
			subject: 'Payment Failed - Trava',
			text,
			html
		});
	}

	async sendForgotPasswordEmail(email: string, token: string): Promise<void> {
		if (!email || !token) {
			throw ApiError.BadRequest('Email and token are required for forgot password email');
		}

		const isProduction = CONFIG.NODE_ENV === 'production';
		const baseUrl = isProduction ? CONFIG.FRONTEND_URL : "http://localhost:4000";
		const resetUrl = `${baseUrl}/reset?token=${token}`;
		const expirationTime = new Date(Date.now() + CONFIG.JWT_PASSWORD_RESET_EXPIRY).toUTCString();

		const text = `Hi, please use the following token to reset your password: ${token}`;
		const html = `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Reset Your Password - Trava</title>
				<style>
					/* Reset styles */
					* {
						margin: 0;
						padding: 0;
						box-sizing: border-box;
					}
					
					body {
						font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
						line-height: 1.6;
						color: #333333;
						background-color: #f8f9fa;
					}
					
					.email-container {
						max-width: 600px;
						margin: 0 auto;
						background-color: #ffffff;
						border-radius: 12px;
						overflow: hidden;
						box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
					}
					
					.header {
						background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
						padding: 40px 30px;
						text-align: center;
					}
					
					.logo {
						color: #ffffff;
						font-size: 28px;
						font-weight: bold;
						margin-bottom: 10px;
						text-decoration: none;
					}
					
					.header-subtitle {
						color: rgba(255, 255, 255, 0.9);
						font-size: 16px;
					}
					
					.content {
						padding: 40px 30px;
					}
					
					.greeting {
						font-size: 18px;
						color: #333333;
						margin-bottom: 20px;
					}
					
					.message {
						color: #666666;
						font-size: 16px;
						line-height: 1.7;
						margin-bottom: 30px;
					}
					
					.reset-button {
						display: inline-block;
						background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
						color: #ffffff !important;
						text-decoration: none;
						padding: 16px 32px;
						border-radius: 8px;
						font-weight: 600;
						font-size: 16px;
						text-align: center;
						transition: transform 0.2s ease;
						margin: 20px 0;
					}
					
					.reset-button:hover {
						transform: translateY(-2px);
					}
					
					.security-info {
						background-color: #f8f9fa;
						border-left: 4px solid #667eea;
						padding: 20px;
						margin: 30px 0;
						border-radius: 0 8px 8px 0;
					}
					
					.security-title {
						font-weight: 600;
						color: #333333;
						margin-bottom: 8px;
						font-size: 14px;
					}
					
					.security-text {
						color: #666666;
						font-size: 14px;
						line-height: 1.5;
					}
					
					.token-section {
						background-color: #f8f9fa;
						border: 2px dashed #e9ecef;
						border-radius: 8px;
						padding: 20px;
						text-align: center;
						margin: 20px 0;
					}
					
					.token-label {
						font-size: 14px;
						color: #666666;
						margin-bottom: 8px;
					}
					
					.token-code {
						font-family: 'Courier New', monospace;
						font-size: 18px;
						font-weight: bold;
						color: #333333;
						background-color: #ffffff;
						padding: 12px;
						border-radius: 6px;
						border: 1px solid #e9ecef;
						letter-spacing: 2px;
					}
					
					.footer {
						background-color: #f8f9fa;
						padding: 30px;
						text-align: center;
						border-top: 1px solid #e9ecef;
					}
					
					.footer-text {
						color: #999999;
						font-size: 14px;
						line-height: 1.5;
					}
					
					.support-link {
						color: #667eea;
						text-decoration: none;
					}
					
					.support-link:hover {
						text-decoration: underline;
					}
					
					/* Mobile responsiveness */
					@media only screen and (max-width: 600px) {
						.email-container {
							margin: 0;
							border-radius: 0;
						}
						
						.header, .content, .footer {
							padding: 30px 20px;
						}
						
						.logo {
							font-size: 24px;
						}
						
						.reset-button {
							display: block;
							width: 100%;
							padding: 18px;
						}
					}
				</style>
			</head>
			<body>
				<div class="email-container">
					<!-- Header -->
					<div class="header">
						<div class="logo">Trava</div>
						<div class="header-subtitle">Secure Password Reset</div>
					</div>
					
					<!-- Main Content -->
					<div class="content">
						<div class="greeting">Hi ${email.split('@')[0] || 'there'},</div>
						
						<div class="message">
							You recently requested to reset your password for your Trava account. We're here to help you get back into your account quickly and securely.
						</div>
						
						<div style="text-align: center;">
							<a href="${resetUrl}" class="reset-button">Reset My Password</a>
						</div>
						
						<div class="security-info">
							<div class="security-title">🔒 Security Information</div>
							<div class="security-text">
								This reset link will expire in <strong>${expirationTime}</strong> for your security. 
								If you don't reset your password within this time, you'll need to request a new reset link.
							</div>
						</div>
						
						<div class="message">
							If the button above doesn't work, you can also copy and paste the following link into your browser:
						</div>
						
						<div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; word-break: break-all; font-size: 14px; color: #666666;">
							${resetUrl}
						</div>
						
						<div class="token-section">
							<div class="token-label">Or use this reset token directly:</div>
							<div class="token-code">${token}</div>
						</div>
						
						<div class="message" style="margin-top: 30px; font-size: 14px;">
							<strong>Didn't request this?</strong> If you didn't ask to reset your password, you can safely ignore this email. 
							Your account remains secure and no changes have been made.
						</div>
					</div>
					
					<!-- Footer -->
					<div class="footer">
						<div class="footer-text">
							Best regards,<br>
							<strong>The Trava Team</strong>
						</div>
						
						<div class="footer-text" style="margin-top: 20px;">
							Need help? <a href="mailto:support@trava.com" class="support-link">Contact our support team</a>
						</div>
						
						<div class="footer-text" style="margin-top: 15px; font-size: 12px;">
							This is an automated message. Please do not reply to this email.<br>
							© 2024 Trava. All rights reserved.
						</div>
					</div>
				</div>
			</body>
			</html>
			`.trim();

		await this.sendMail({
			to: email,
			subject: 'Password Reset - Trava',
			text,
			html
		});
	}

	// Health check method for monitoring
	async healthCheck(): Promise<{ status: string; verified: boolean; timestamp: string }> {
		const timestamp = new Date().toISOString();
		
		try {
			const verified = await this.verifyConnection();
			return {
				status: verified ? 'healthy' : 'degraded',
				verified,
				timestamp
			};
		} catch (error: any) {
			logger.error('Email service health check failed:', error?.message);
			return {
				status: 'unhealthy',
				verified: false,
				timestamp
			};
		}
	}

	// Graceful shutdown
	async close(): Promise<void> {
		try {
			this.transporter.close();
			logger.info('Email service connection closed gracefully');
		} catch (error: any) {
			logger.error('Error closing email service connection:', error?.message);
		}
	}
}

export const emailService = new EmailService(transportOptions);

// Graceful shutdown handling
process.on('SIGINT', async () => {
	await emailService.close();
});

process.on('SIGTERM', async () => {
	await emailService.close();
});

/**
 * Checks if the email domain has valid MX or A DNS records.
 * Returns true if valid, false otherwise.
 */

export async function isEmailDomainValid(email: string): Promise<boolean> {
	try {
	  const domain = email.split('@')[1];
	  if (!domain) {
		logger.warn(`No domain found in email: ${email}`);
		return false;
	  }
  
	  try {
		const mxRecords = await dns.resolveMx(domain);
		logger.info(`MX records for ${domain}:`, mxRecords);
		if (Array.isArray(mxRecords) && mxRecords.length > 0) return true;
	  } catch (mxErr: any) {
		logger.info(`No MX records for ${domain}: ${mxErr.message}`);
	  }
  
	  try {
		const aRecords = await dns.resolve(domain);
		logger.info(`A records for ${domain}:`, aRecords);
		if (Array.isArray(aRecords) && aRecords.length > 0) return true;
	  } catch (aErr: any) {
		logger.info(`No A records for ${domain}: ${aErr.message}`);
	  }
  
	  logger.warn(`Email domain validation failed for: ${domain}`);
	  return false;
	} catch (err) {
	  logger.error('DNS lookup failed for email domain validation', { email, err });
	  return false;
	}
  }