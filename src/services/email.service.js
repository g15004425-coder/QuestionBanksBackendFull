import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import handlebars from "handlebars";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let transporter;
const templates = new Map();

async function initializeEmailService() {
  transporter = createTransporter();
  await loadTemplates();
}

function createTransporter() {
  const config = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_PORT === "465",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  };

  const transporter = nodemailer.createTransport(config);

  // Verify transporter configuration
  transporter.verify((error, success) => {
    if (error) {
      logger.error("Email transporter error:", error);
    } else {
      logger.info("Email service ready");
    }
  });

  return transporter;
}

async function loadTemplates() {
  try {
    const templateDir = path.join(__dirname, "..", "templates", "email");
    const templateFiles = await fs.readdir(templateDir);

    for (const file of templateFiles) {
      if (file.endsWith(".hbs")) {
        const templateName = file.replace(".hbs", "");
        const templatePath = path.join(templateDir, file);
        const templateContent = await fs.readFile(templatePath, "utf-8");

        templates.set(templateName, handlebars.compile(templateContent));
      }
    }

    // Register handlebars helpers
    registerHelpers();
  } catch (error) {
    logger.error("Failed to load email templates:", error);
  }
}

function registerHelpers() {
  handlebars.registerHelper("formatDate", (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  });

  handlebars.registerHelper("formatCurrency", (amount, currency = "SAR") => {
    return new Intl.NumberFormat("en-SA", {
      style: "currency",
      currency: currency,
    }).format(amount);
  });

  handlebars.registerHelper("if_eq", function (a, b, options) {
    return a === b ? options.fn(this) : options.inverse(this);
  });
}

async function sendEmail(options) {
  const {
    to,
    subject,
    html,
    text,
    attachments = [],
    cc,
    bcc,
    replyTo,
    template,
    context = {},
  } = options;

  try {
    let htmlContent = html;
    let textContent = text;

    // Use template if provided
    if (template && templates.has(template)) {
      const compiledTemplate = templates.get(template);
      htmlContent = compiledTemplate(context);

      // Generate text version from HTML
      if (!textContent) {
        textContent = htmlContent.replace(/<[^>]*>?/gm, "");
      }
    }

    const mailOptions = {
      from: `${process.env.SMTP_FROM_NAME} <${process.env.SMTP_FROM_EMAIL}>`,
      to,
      subject,
      html: htmlContent,
      text: textContent,
      attachments,
      cc,
      bcc,
      replyTo: replyTo || process.env.SMTP_REPLY_TO,
    };

    const info = await transporter.sendMail(mailOptions);

    logger.info(`Email sent: ${info.messageId}`);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    logger.error("Email sending error:", error);
    throw new ApiError(500, `Failed to send email: ${error.message}`);
  }
}

// Email sending functions
async function sendVerificationEmail(email, token) {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

  return sendEmail({
    to: email,
    subject: "Verify Your Email - Sports Platform",
    template: "verification",
    context: {
      verificationUrl,
      validHours: 24,
    },
  });
}

async function sendPasswordResetEmail(email, token) {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  return sendEmail({
    to: email,
    subject: "Reset Your Password - Sports Platform",
    template: "password-reset",
    context: {
      resetUrl,
      validMinutes: 30,
    },
  });
}

async function sendWelcomeEmail(user) {
  return sendEmail({
    to: user.email,
    subject: "Welcome to Sports Platform",
    template: "welcome",
    context: {
      userName: user.name,
      loginUrl: `${process.env.FRONTEND_URL}/login`,
    },
  });
}

async function sendNotificationEmail(email, subject, body, data = {}) {
  return sendEmail({
    to: email,
    subject,
    template: "notification",
    context: {
      subject,
      body,
      ...data,
      actionUrl: data.actionUrl || process.env.FRONTEND_URL,
    },
  });
}

async function sendPaymentConfirmationEmail(user, payment, invoice) {
  return sendEmail({
    to: user.email,
    subject: "Payment Confirmation - Sports Platform",
    template: "payment-confirmation",
    context: {
      userName: user.name,
      invoiceNumber: invoice.invoiceNumber,
      amount: payment.amount,
      currency: payment.currency,
      paymentDate: payment.completedAt,
      items: invoice.items,
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      totalAmount: invoice.totalAmount,
      downloadUrl: `${process.env.API_URL}/api/v1/invoices/${invoice._id}/download`,
    },
  });
}

async function sendOfferNotificationEmail(user, offer, type = "new") {
  const subjects = {
    new: "Your Offer Has Been Published",
    promoted: "Your Offer Has Been Promoted",
    expired: "Your Offer Has Expired",
    contactUnlocked: "Someone Unlocked Your Contact Information",
  };

  return sendEmail({
    to: user.email,
    subject: subjects[type] || "Offer Update",
    template: "offer-notification",
    context: {
      userName: user.name,
      offerTitle: offer.title.en,
      offerStatus: type,
      offerUrl: `${process.env.FRONTEND_URL}/offers/${offer._id}`,
      expiryDate: offer.expiryDate,
    },
  });
}

async function sendNewsletter(recipients, subject, content, segment) {
  const results = {
    sent: 0,
    failed: 0,
    errors: [],
  };

  // Send in batches to avoid overwhelming the server
  const batchSize = 50;
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);

    const promises = batch.map((recipient) =>
      sendEmail({
        to: recipient.email,
        subject,
        template: "newsletter",
        context: {
          userName: recipient.name,
          content,
          unsubscribeUrl: `${process.env.FRONTEND_URL}/unsubscribe?token=${recipient.unsubscribeToken}`,
          preferencesUrl: `${process.env.FRONTEND_URL}/preferences`,
        },
      })
        .then(() => {
          results.sent++;
        })
        .catch((error) => {
          results.failed++;
          results.errors.push({
            email: recipient.email,
            error: error.message,
          });
        })
    );

    await Promise.all(promises);

    // Add delay between batches
    if (i + batchSize < recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  return results;
}

async function sendInvoiceEmail(user, invoice, attachmentPath) {
  return sendEmail({
    to: user.email,
    subject: `Invoice ${invoice.invoiceNumber} - Sports Platform`,
    template: "invoice",
    context: {
      userName: user.name,
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      items: invoice.items,
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      totalAmount: invoice.totalAmount,
      paymentUrl: `${process.env.FRONTEND_URL}/pay-invoice/${invoice._id}`,
    },
    attachments: [
      {
        filename: `invoice-${invoice.invoiceNumber}.pdf`,
        path: attachmentPath,
      },
    ],
  });
}

async function testEmailConnection() {
  try {
    await transporter.verify();
    return { success: true, message: "Email service is working" };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// Export functions
export {
  initializeEmailService,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendNotificationEmail,
  sendPaymentConfirmationEmail,
  sendOfferNotificationEmail,
  sendNewsletter,
  sendInvoiceEmail,
  testEmailConnection,
};
