// Load Environment Variables FIRST
require('dotenv').config();

// Import Dependencies
const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const xss = require('xss');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const { OAuth2Client } = require('google-auth-library'); // Added for Google login

// Initialize Express App
const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": ["'self'", "https://www.google.com/recaptcha/", "https://www.gstatic.com/"],
            "frame-src": ["'self'", "https://www.google.com/recaptcha/"],
        },
    }
}));
app.use(cors());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Input Sanitization Function
const sanitizeInput = (obj) => {
    const sanitized = {};
    for (let [key, value] of Object.entries(obj)) {
        sanitized[key] = typeof value === 'string' ? xss(value.trim()) : value;
    }
    return sanitized;
};

// Verify reCAPTCHA
async function verifyRecaptcha(token) {
    try {
        const response = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
            params: {
                secret: process.env.RECAPTCHA_SECRET_KEY,
                response: token
            }
        });
        return response.data.success;
    } catch (error) {
        console.error('reCAPTCHA verification failed:', error);
        return false;
    }
}

// Route to Serve the HTML Form
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route to Handle Form Submission
app.post('/submit-help-request', async (req, res) => {
    try {
        console.log('Form data received:', req.body);

        // Verify reCAPTCHA
        const recaptchaValid = await verifyRecaptcha(req.body['g-recaptcha-response']);
        if (!recaptchaValid) {
            return res.status(400).send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Validation Error</title>
                    <link rel="stylesheet" href="/style.css">
                </head>
                <body>
                    <div class="error-container">
                        <h1>Validation Error</h1>
                        <p>reCAPTCHA verification failed. Please try again.</p>
                        <p><a href="javascript:history.back()">Go Back</a></p>
                    </div>
                </body>
                </html>
            `);
        }

        // Sanitize inputs
        const sanitizedInput = sanitizeInput(req.body);
        const {
            first_name, last_name, company_name, email, phone,
            urgency, problem_description
        } = sanitizedInput;

        // Enhanced Server-Side Validation
        const errors = [];
        if (!first_name || first_name.length < 2) errors.push('First name is required (minimum 2 characters)');
        if (!last_name || last_name.length < 2) errors.push('Last name is required (minimum 2 characters)');
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Valid email is required');
        if (!phone || !/^[0-9\s\-()+]{10,}$/.test(phone)) errors.push('Valid phone number is required');
        if (!urgency) errors.push('Urgency level is required');
        if (!problem_description || problem_description.length < 10) errors.push('Problem description is required (minimum 10 characters)');

        if (errors.length > 0) {
            return res.status(400).send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Validation Error</title>
                    <link rel="stylesheet" href="/style.css">
                </head>
                <body>
                    <div class="error-container">
                        <h1>Validation Error</h1>
                        <ul>${errors.map(error => `<li>${error}</li>`).join('')}</ul>
                        <p><a href="javascript:history.back()">Go Back</a></p>
                    </div>
                </body>
                </html>
            `);
        }

        // Configure Nodemailer
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        // Verify SMTP connection
        await transporter.verify();

        // Enhanced HTML email template
        const htmlEmail = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #0066cc; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
                    .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
                    .field { margin-bottom: 15px; }
                    .label { font-weight: bold; color: #666; }
                    .urgency-${urgency} { color: ${
                        urgency === 'critical' ? '#dc3545' : 
                        urgency === 'high' ? '#fd7e14' : 
                        urgency === 'medium' ? '#ffc107' : 
                        '#28a745'
                    }; }
                    .problem { white-space: pre-wrap; background: #fff; padding: 15px; border: 1px solid #eee; border-radius: 4px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2>New Help Request</h2>
                    </div>
                    <div class="content">
                        <div class="field">
                            <div class="label">From:</div>
                            ${first_name} ${last_name}
                        </div>
                        <div class="field">
                            <div class="label">Company:</div>
                            ${company_name || 'N/A'}
                        </div>
                        <div class="field">
                            <div class="label">Contact:</div>
                            Email: <a href="mailto:${email}">${email}</a><br>
                            Phone: <a href="tel:${phone}">${phone}</a>
                        </div>
                        <div class="field">
                            <div class="label">Urgency:</div>
                            <strong class="urgency-${urgency}">${urgency.toUpperCase()}</strong>
                        </div>
                        <div class="field">
                            <div class="label">Problem Description:</div>
                            <div class="problem">${problem_description}</div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        // Define Email Options
        const mailOptions = {
            from: `"Help Form" <${process.env.SMTP_USER}>`,
            to: process.env.EMAIL_RECIPIENT,
            replyTo: email,
            subject: `New Help Request - ${urgency.toUpperCase()} - ${first_name} ${last_name}`,
            text: `New help request:\n\nName: ${first_name} ${last_name}\nCompany: ${company_name || 'N/A'}\nEmail: ${email}\nPhone: ${phone}\nUrgency: ${urgency}\nProblem: ${problem_description}`,
            html: htmlEmail
        };

        // Send Email
        const info = await transporter.sendMail(mailOptions);
        console.log('Message sent: %s', info.messageId);

        // Success Response
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Request Submitted</title>
                <link rel="stylesheet" href="/style.css">
                <meta http-equiv="refresh" content="5;url=/">
            </head>
            <body>
                <div class="thank-you-container">
                    <h1>Thank You!</h1>
                    <p>Your request has been submitted successfully. We will get back to you as soon as possible.</p>
                    <p>You will be redirected in 5 seconds...</p>
                    <p><a href="/">Submit Another Request</a></p>
                </div>
            </body>
            </html>
        `);

    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Server Error</title>
                <link rel="stylesheet" href="/style.css">
            </head>
            <body>
                <div class="error-container">
                    <h1>Server Error</h1>
                    <p>Could not process your request due to a server error. Please try again later or contact us directly.</p>
                    <p><a href="/">Go Back</a></p>
                </div>
            </body>
            </html>
        `);
    }
});

// Add endpoint to handle Google login
const googleClient = new OAuth2Client('YOUR_GOOGLE_CLIENT_ID'); // Replace with your Google Client ID

app.post('/google-login', async (req, res) => {
    try {
        const { idToken } = req.body;
        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: 'YOUR_GOOGLE_CLIENT_ID', // Replace with your Google Client ID
        });
        const payload = ticket.getPayload();

        console.log('Google user verified:', payload);

        // You can add additional logic here, such as creating a session or user in your database

        res.status(200).json({ message: 'Google login successful', user: payload });
    } catch (error) {
        console.error('Error verifying Google ID token:', error);
        res.status(400).json({ message: 'Invalid Google ID token' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start the Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
