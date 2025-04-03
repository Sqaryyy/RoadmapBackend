// email-utils.ts (example)

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface EmailParams {
    to: string | string[]; // Allow single recipient or multiple recipients
    subject: string;
    html: string; // Use HTML for rich content
}

async function sendEmail({ to, subject, html }: EmailParams): Promise<boolean> {
    try {
        const data = await resend.emails.send({
            from: 'notifications@updates.roadmap.it.com', // Replace with your verified Resend email
            to: to,
            subject: subject,
            html: html,
        });

        console.log("Email sent successfully:", data);
        return true;
    } catch (error) {
        console.error("Error sending email:", error);
        return false;
    }
}

async function sendSubscriptionPausedEmail(userEmail: string): Promise<boolean> {
    const subject = 'Your Subscription is Paused';
    const html = `<p>Your subscription has been paused.  Please contact us if you have any questions.</p>`; // Customize the content
    return sendEmail({ to: userEmail, subject, html });
}

async function sendSubscriptionResumedEmail(userEmail: string): Promise<boolean> {
    const subject = 'Your Subscription is Active Again!';
    const html = `<p>Your subscription has been resumed. Welcome back!</p>`; // Customize the content
    return sendEmail({ to: userEmail, subject, html });
}

async function sendTrialEndingSoonEmail(userEmail: string, daysLeft: number): Promise<boolean> {
    const subject = 'Your Trial is Ending Soon!';
    const html = `<p>Your trial is ending in ${daysLeft} days.  Upgrade now to continue enjoying our features!</p>`; // Customize
    return sendEmail({ to: userEmail, subject, html });
}

 async function sendPaymentFailedEmail(userEmail: string): Promise<boolean> {
     const subject = 'Payment Failed for Your Subscription';
     const html = `<p>Your recent payment for your subscription failed. Please update your payment information to avoid interruption of service.</p>`; // Customize
     return sendEmail({ to: userEmail, subject, html });
 }

 async function sendSubscriptionCanceledEmail(userEmail: string): Promise<boolean> {
     const subject = 'Your Subscription has been Canceled';
     const html = `<p>Your subscription has been canceled. We're sorry to see you go!</p>`; // Customize
     return sendEmail({ to: userEmail, subject, html });
 }

export { sendSubscriptionPausedEmail, sendSubscriptionResumedEmail, sendTrialEndingSoonEmail, sendPaymentFailedEmail, sendSubscriptionCanceledEmail };