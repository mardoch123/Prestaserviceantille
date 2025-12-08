import emailjs from '@emailjs/browser';
import { generateEmailTemplate } from './emailTemplates';

// EmailJS Configuration
const EMAILJS_SERVICE_ID = "PrestaServicesAntilles";
const EMAILJS_TEMPLATE_ID = "template_o74lx0n";
const EMAILJS_PUBLIC_KEY = "CAw5EbFlSL9psrSaW";

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
 * Sends an email using EmailJS with preconfigured templates
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
    context: any
): Promise<boolean> => {
    try {
        // Validate email address
        if (!to || !isValidEmail(to)) {
            console.warn(`[EmailJS] Invalid email address: ${to}`);
            return false;
        }

        // Generate complete email from preconfigured template
        const emailTemplate = generateEmailTemplate(templateType, context);

        // Extract recipient name from context
        const recipientName = context.name
            || context.clientName
            || context.providerName
            || context.to_name
            || 'Utilisateur';

        // Prepare simplified template parameters (ONLY 4 variables)
        const templateParams = {
            to_email: to,
            name: recipientName,
            subject: emailTemplate.subject,
            message: emailTemplate.message
        };

        // Log the email sending attempt (helpful for debugging)
        console.log(`[EmailJS] Sending email:`, {
            type: templateType,
            to: to,
            subject: emailTemplate.subject,
            name: recipientName
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
        // Comprehensive error logging
        console.error(`[EmailJS] ✗ Failed to send email:`, {
            to,
            templateType,
            error: error.message || error,
            text: error.text || 'No error details available'
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
