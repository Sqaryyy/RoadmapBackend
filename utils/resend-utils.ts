// email-service.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface EmailParams {
    to: string | string[];
    subject: string;
    html: string;
}

async function sendEmail(params: EmailParams): Promise<boolean> {
    try {
        const data = await resend.emails.send({
            from: 'notifications@updates.roadmap.it.com', // Replace with your verified Resend email
            to: params.to,
            subject: params.subject,
            html: params.html,
        });
        console.log("Email sent successfully:", data);
        return true;
    } catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
}

// --- Helper function to generate consistent email template ---
const createEmailTemplate = (content: string) => {
    const brandColor = '#007BFF'; // Replace with your brand color
    const logoUrl = 'https://example.com/your-logo.png'; // Replace with your logo URL

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Template</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f4f4f4;
                margin: 0;
                padding: 0;
            }
            .container {
                max-width: 600px;
                margin: 20px auto;
                background-color: #fff;
                padding: 20px;
                border-radius: 5px;
                box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            }
            .header {
                text-align: center;
                padding-bottom: 20px;
                border-bottom: 1px solid #eee;
            }
            .header img {
                max-width: 200px;
                height: auto;
            }
            .content {
                padding: 20px 0;
            }
            .footer {
                text-align: center;
                padding-top: 20px;
                border-top: 1px solid #eee;
                color: #777;
                font-size: 0.8em;
            }
            .button {
                display: inline-block;
                padding: 10px 20px;
                background-color: ${brandColor};
                color: white;
                text-decoration: none;
                border-radius: 5px;
            }
            .disclaimer {
                font-size: 0.7em;
                color: #888;
                margin-top: 15px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <img src="${logoUrl}" alt="Your Logo">
            </div>
            <div class="content">
                ${content}
            </div>
            <div class="footer">
                <p class="disclaimer">This is an automated email. Please do not reply.</p>
                © ${new Date().getFullYear()} Your Company. All rights reserved.
            </div>
        </div>
    </body>
    </html>
    `;
};


async function sendWelcomeEmail(userEmail: string): Promise<boolean> {
    const subject = 'Welcome to Our Service!';
    const content = `
        <h1>Welcome!</h1>
        <p>Thanks for signing up. Explore our features and get started today.</p>
        <a href="https://example.com/get-started" class="button">Get Started</a>
    `;
    const html = createEmailTemplate(content);
    return sendEmail({ to: userEmail, subject, html });
}

async function sendSubscriptionCreatedEmail(userEmail: string, planName: string): Promise<boolean> {
    const subject = `Subscription to ${planName} Created!`;
    const content = `
        <h1>Subscription Created!</h1>
        <p>Your subscription to the <strong>${planName}</strong> plan has been created. Enjoy the benefits of your new plan!</p>
        <a href="https://example.com/account" class="button">View Account</a>
    `;
    const html = createEmailTemplate(content);
    return sendEmail({ to: userEmail, subject, html });
}

async function sendSubscriptionUpdatedEmail(userEmail: string, oldPlan: string, newPlan: string): Promise<boolean> {
    const subject = 'Subscription Updated';
    const content = `
        <h1>Subscription Updated</h1>
        <p>Your subscription has been updated from <strong>${oldPlan}</strong> to <strong>${newPlan}</strong>.</p>
        <a href="https://example.com/account" class="button">Manage Subscription</a>
    `;
    const html = createEmailTemplate(content);
    return sendEmail({to:userEmail, subject, html})
}

async function sendPaymentIntentSucceededEmail(userEmail: string, amount: number): Promise<boolean> {
    const subject = 'Payment Successful!';
    const content = `
        <h1>Payment Successful!</h1>
        <p>Your payment of <strong>$${amount}</strong> was successful.</p>
    `;
    const html = createEmailTemplate(content);
    return sendEmail({to:userEmail, subject, html})
}

async function sendPaymentIntentFailedEmail(userEmail: string): Promise<boolean> {
    const subject = 'Payment Failed.';
    const content = `
        <h1>Payment Failed</h1>
        <p>Your payment has failed, please retry!</p>
        <a href="https://example.com/payment-methods" class="button">Retry Payment</a>
    `;
    const html = createEmailTemplate(content);
    return sendEmail({to:userEmail, subject, html})
}

async function sendPaymentIntentCanceledEmail(userEmail: string): Promise<boolean> {
    const subject = 'Payment Canceled.';
    const content = `
        <h1>Payment Canceled</h1>
        <p>Your payment has been canceled!</p>
    `;
    const html = createEmailTemplate(content);
    return sendEmail({to:userEmail, subject, html})
}

async function sendSubscriptionPausedEmail(userEmail: string): Promise<boolean> {
    const subject = 'Your Subscription is Paused';
    const content = `
        <h1>Subscription Paused</h1>
        <p>Your subscription has been paused. Please contact us if you have any questions.</p>
        <a href="https://example.com/contact" class="button">Contact Us</a>
    `;
    const html = createEmailTemplate(content);
    return sendEmail({ to: userEmail, subject, html });
}

async function sendSubscriptionResumedEmail(userEmail: string): Promise<boolean> {
    const subject = 'Your Subscription is Active Again!';
    const content = `
        <h1>Subscription Resumed!</h1>
        <p>Your subscription has been resumed. Welcome back!</p>
    `;
    const html = createEmailTemplate(content);
    return sendEmail({ to: userEmail, subject, html });
}

async function sendTrialEndingSoonEmail(userEmail: string, daysLeft: number): Promise<boolean> {
    const subject = 'Your Trial is Ending Soon!';
    const content = `
        <h1>Trial Ending Soon!</h1>
        <p>Your trial is ending in <strong>${daysLeft} days</strong>. Upgrade now to continue enjoying our features!</p>
        <a href="https://example.com/upgrade" class="button">Upgrade Now</a>
    `;
    const html = createEmailTemplate(content);
    return sendEmail({ to: userEmail, subject, html });
}

async function sendPaymentFailedEmail(userEmail: string): Promise<boolean> {
    const subject = 'Payment Failed for Your Subscription';
    const content = `
        <h1>Payment Failed</h1>
        <p>Your recent payment for your subscription failed. Please update your payment information to avoid interruption of service.</p>
        <a href="https://example.com/payment-methods" class="button">Update Payment Information</a>
    `;
    const html = createEmailTemplate(content);
    return sendEmail({ to: userEmail, subject, html });
}

async function sendSubscriptionCanceledEmail(userEmail: string): Promise<boolean> {
    const subject = 'Your Subscription has been Canceled';
    const content = `
        <h1>Subscription Canceled</h1>
        <p>Your subscription has been canceled. We're sorry to see you go!</p>
    `;
    const html = createEmailTemplate(content);
    return sendEmail({ to: userEmail, subject, html });
}

export { sendWelcomeEmail, sendSubscriptionPausedEmail, sendSubscriptionResumedEmail, sendTrialEndingSoonEmail, sendPaymentFailedEmail, sendSubscriptionCanceledEmail, sendSubscriptionCreatedEmail, sendSubscriptionUpdatedEmail, sendPaymentIntentSucceededEmail, sendPaymentIntentFailedEmail, sendPaymentIntentCanceledEmail };