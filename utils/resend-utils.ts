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

async function sendWelcomeEmail(userEmail: string): Promise<boolean> {
    const subject = 'Welcome to Our Service!';
    const html = `<p>Welcome!  Thanks for signing up.  Explore our features and get started today.</p>`;
    return sendEmail({ to: userEmail, subject, html });
}

async function sendSubscriptionCreatedEmail(userEmail: string, planName: string): Promise<boolean> {
    const subject = `Subscription to ${planName} Created!`;
    const html = `<p>Your subscription to the ${planName} plan has been created.  Enjoy the benefits of your new plan!</p>`;
    return sendEmail({ to: userEmail, subject, html });
}

async function sendSubscriptionUpdatedEmail(userEmail: string, oldPlan: string, newPlan: string): Promise<boolean> {
    const subject = 'Subscription Updated';
    const html = `<p>Your subscription has been updated from ${oldPlan} to ${newPlan}.</p>`;
    return sendEmail({to:userEmail, subject, html})
}

async function sendPaymentIntentSucceededEmail(userEmail: string, amount: number): Promise<boolean> {
    const subject = 'Payment Successful!';
    const html = `<p>Your payment of $${amount} was successful.</p>`;
    return sendEmail({to:userEmail, subject, html})
}

async function sendPaymentIntentFailedEmail(userEmail: string): Promise<boolean> {
    const subject = 'Payment Failed.';
    const html = `<p>Your payment has failed, please retry!</p>`;
    return sendEmail({to:userEmail, subject, html})
}

async function sendPaymentIntentCanceledEmail(userEmail: string): Promise<boolean> {
    const subject = 'Payment Canceled.';
    const html = `<p>Your payment has been canceled!</p>`;
    return sendEmail({to:userEmail, subject, html})
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

export { sendWelcomeEmail, sendSubscriptionPausedEmail, sendSubscriptionResumedEmail, sendTrialEndingSoonEmail, sendPaymentFailedEmail, sendSubscriptionCanceledEmail, sendSubscriptionCreatedEmail, sendSubscriptionUpdatedEmail, sendPaymentIntentSucceededEmail, sendPaymentIntentFailedEmail, sendPaymentIntentCanceledEmail };