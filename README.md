# Help Form App

A secure and user-friendly web form application for handling support requests.

## Features

- Responsive design that works on all devices
- Server-side validation with detailed error messages
- Input sanitization and XSS protection
- Rate limiting to prevent abuse
- Email notifications for support requests
- Configurable SMTP settings
- Error handling with user-friendly messages

## Setup

1. Clone this repository
2. Install dependencies:
```bash
npm install
```
3. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
4. Edit `.env` and update with your SMTP and email settings
5. Start the server:
```bash
npm start
```

## Environment Variables

- `PORT`: The port number for the server (default: 3000)
- `SMTP_HOST`: Your SMTP server hostname
- `SMTP_PORT`: SMTP server port (usually 587 or 465)
- `SMTP_SECURE`: Use TLS (true/false)
- `SMTP_USER`: SMTP username/email
- `SMTP_PASS`: SMTP password
- `EMAIL_RECIPIENT`: Email address where support requests will be sent

## Security Features

- Helmet.js for secure HTTP headers
- CORS protection
- XSS sanitization
- Rate limiting
- Input validation
- Secure email handling

## Development

To run in development mode with auto-reload:
```bash
npm install -g nodemon
nodemon server.js
```
