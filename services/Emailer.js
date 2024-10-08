const nodeMailer = require('nodemailer');
const Analytics = require('./Analytics');
require('dotenv').config();

/**
 * Emailer class to send emails
 * 
 * @method checkPermission: Checks if the system has permission to send emails
 * @method checkContext: Checks if the system context is set up properly
 * @method sendEmail: Sends an email. Provide a destination email, subject line, fallback text content and HTML content.
 */
class Emailer {
    static contextChecked = false;

    static checkPermission() {
        return process.env.EMAILING_ENABLED === "True";
    }

    static checkContext() {
        if (this.checkPermission()) {
            if (!process.env.EMAIL_ADDRESS || !process.env.EMAIL_PASSWORD) {
                throw new Error("ERROR: EMAIL_ADDRESS or EMAIL_PASSWORD environment variables not set.")
            }
        }

        this.contextChecked = true;
    }

    static async sendEmail(to, subject, text, html) {
        if (!this.contextChecked) {
            console.log("EMAILER ERROR: System context was not checked before sending email. Skipping email.")
            return true;
        }

        if (!this.checkPermission()) {
            console.log("EMAILER ERROR: Emailing services are not enabled. Skipping email.")
            return true;
        }

        try {
            const transporter = nodeMailer.createTransport({
                host: "smtp.gmail.com",
                port: 465,
                auth: {
                    user: process.env.EMAIL_ADDRESS,
                    pass: process.env.EMAIL_PASSWORD
                }
            });

            if (Array.isArray(to)) {
                to = to.join(", ");
            }

            await transporter.sendMail({
                from: {
                    name: 'MakanMatch System',
                    address: process.env.EMAIL_ADDRESS
                },
                to: to,
                subject: subject,
                text: text,
                html: html
            })
            .then(() => {
                console.log(`EMAILER: Sent email to ${to}.`)
                if (Analytics.checkPermission()) {
                    Analytics.supplementSystemMetricUpdate({
                        emailDispatches: 1
                    })
                    .catch(err => {
                        console.log(`EMAILER ANALYTICS: Failed to supplement email dispatch metric. Error: ${err}`)
                    })
                }
                return true;
            })

            return true;
        } catch (err) {
            console.log(`EMAILER ERROR: Failed to send email to ${to}. Error: ${err}`)
            return false;
        }
    }
}

module.exports = Emailer;