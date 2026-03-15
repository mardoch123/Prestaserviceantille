import emailjs from '@emailjs/browser';
import { generateEmailTemplate, htmlToPlainText } from './emailTemplates';

// EmailJS Configuration
const EMAILJS_SERVICE_ID = "service_0u67mco";
const EMAILJS_TEMPLATE_ID = "template_dhqrmbu";
const EMAILJS_PUBLIC_KEY = "jjYNnpHbr5djyFBlK";

const EMAIL_BRAND_NAME = 'Presta Services Antilles';

// Rate limiting configuration
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // Start with 1 second delay

/**
 * Sleep helper for delay between retries
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Professional Email Service using EmailJS with Preconfigured Templates
 * 
 * This service handles all automated email sending for the Presta Services application.
 * All email content is preconfigured in the application (emailTemplates.ts).
 * 
 * EmailJS Template Variables (ONLY 4 variables):
 * - {{to_email}} - Recipient email address
 * - {{name}} - Recipient name (used as "From name" in EmailJS)
 * - {{subject}} - Email subject line
 * - {{message}} - Complete HTML message body (preconfigured in app)
 * 
 * @author Presta Services Antilles
 * @version 2.0.0
 */

/**
 * Sends an email using EmailJS with preconfigured templates and retry logic for rate limiting
 * 
 * @param to - Recipient email address
 * @param subject - Email subject line (used for fallback, but will be overridden by template)
 * @param templateType - Type of email template (e.g., 'welcome_client_panel', 'mission_report')
 * @param context - Dynamic data to populate the email template
 * @returns Promise<boolean> - True if email sent successfully, false otherwise
 */
export const sendEmailViaEmailJS = async (
    to: string,
    subject: string,
    templateType: string,
    context: any,
    retryCount: number = 0
): Promise<boolean> => {
    try {
        // Check if running on localhost (CORS issue in development)
        const isLocalhost = typeof window !== 'undefined' && 
            (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        
        if (isLocalhost) {
            console.log(`[EmailJS] Development mode detected - skipping email send to avoid CORS`);
            console.log(`[EmailJS] Would have sent:`, { to, subject, templateType, context });
            return true; // Pretend success in dev mode
        }

        // Validate email address
        if (!to || !isValidEmail(to)) {
            console.warn(`[EmailJS] Invalid email address: ${to}`);
            return false;
        }

        // Generate complete email from preconfigured template
        const emailTemplate = generateEmailTemplate(templateType, context);

        // Check if message contains HTML and convert to plain text
        if (emailTemplate.message && emailTemplate.message.includes('<')) {
            emailTemplate.message = htmlToPlainText(emailTemplate.message);
        }

        const normalizedSubject = `${EMAIL_BRAND_NAME} - ${String(emailTemplate.subject || subject || '').trim()}`.trim();

        // Prepare simplified template parameters (ONLY 4 variables)
        const templateParams = {
            to_email: to,
            name: EMAIL_BRAND_NAME,
            subject: normalizedSubject,
            message: emailTemplate.message
        };

        // Log the email sending attempt (helpful for debugging)
        console.log(`[EmailJS] Sending email (attempt ${retryCount + 1}):`, {
            type: templateType,
            to: to,
            subject: normalizedSubject,
            name: EMAIL_BRAND_NAME
        });

        // Send email via EmailJS
        const response = await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            templateParams,
            EMAILJS_PUBLIC_KEY
        );

        if (response.status === 200) {
            console.log(`[EmailJS] ✓ Email sent successfully to ${to} (${templateType})`);
            return true;
        } else {
            console.warn(`[EmailJS] Unexpected response status: ${response.status}`);
            return false;
        }

    } catch (error: any) {
        // Check if it's a rate limit error (429)
        const isRateLimitError = error?.status === 429 || 
                                 error?.text?.includes('Connection Limit Exceeded') ||
                                 error?.message?.includes('429');
        
        if (isRateLimitError && retryCount < MAX_RETRIES) {
            // Calculate exponential backoff delay
            const delay = BASE_DELAY_MS * Math.pow(2, retryCount);
            console.log(`[EmailJS] Rate limit hit (429). Retrying in ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
            
            await sleep(delay);
            return sendEmailViaEmailJS(to, subject, templateType, context, retryCount + 1);
        }

        // Comprehensive error logging
        console.error(`[EmailJS] ✗ Failed to send email:`, {
            to,
            templateType,
            error: error.message || error,
            text: error.text || 'No error details available',
            status: error.status || 'unknown'
        });

        // Return false but don't throw - we don't want email failures to break the app
        return false;
    }
};

/**
 * Simple email validation helper
 */
const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Email template type definitions for documentation
 * These represent all the email types currently used in the application
 */
export type EmailTemplateType =
    // Mission-related emails
    | 'reminder_48h'
    | 'client_mission_cancelled'
    | 'provider_mission_assigned'
    | 'admin_mission_report'
    | 'mission_report'
    | 'admin_mission_cancelled'
    | 'admin_client_cancelled_late'
    | 'admin_client_cancelled'

    // Welcome emails
    | 'welcome_client_panel'
    | 'welcome_provider'

    // Document emails
    | 'new_document'
    | 'document_status_update'
    | 'admin_quote_signed'
    | 'admin_quote_rejected'

    // Customer service request emails
    | 'admin_new_service_request'
    | 'client_request_validated'

    // Other emails
    | 'reset_password'
    | 'agenda_reminder'
    | 'admin_new_message';

/**
 * Export configuration for external use if needed
 */
export const emailJSConfig = {
    serviceId: EMAILJS_SERVICE_ID,
    templateId: EMAILJS_TEMPLATE_ID,
    publicKey: EMAILJS_PUBLIC_KEY,
    variables: ['to_email', 'name', 'subject', 'message'] as const
} as const;
