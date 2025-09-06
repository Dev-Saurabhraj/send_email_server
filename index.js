const express = require("express");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const bodyParser = require("body-parser");
const cors = require("cors"); // Add this package
require("dotenv").config();

//Google OAuth2 credentials
const GMAIL_USER = process.env.GMAIL_USER;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI; 
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

// OAUTH2 CLIENT
const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const app = express();

// CORS CONFIGURATION - ADD THIS SECTION
app.use(cors({
  origin: "*", // Allow all origins for now
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Accept", "Authorization"],
  credentials: false
}));

// Alternative manual CORS setup (use this if you don't want to install cors package)
/*
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight request');
    return res.sendStatus(200);
  }
  
  next();
});
*/

app.use(bodyParser.json());

// Add a test endpoint to check if server is running
app.get('/', (req, res) => {
  res.json({ 
    message: 'Email server is running!', 
    timestamp: new Date().toISOString(),
    endpoints: {
      'POST /send-email': 'Send email with {name, email, query}'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

//  SEND MAIL FUNCTION 
async function sendMail(toName, toEmail, query) {
  try {
    console.log(`Attempting to send email to: ${toEmail}`);
    const { token } = await oAuth2Client.getAccessToken();

    const transport = nodemailer.createTransporter({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: GMAIL_USER,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        refreshToken: REFRESH_TOKEN,
        accessToken: token,
      },
    });

    const mailOptions = {
      from: GMAIL_USER,
      to: GMAIL_USER, // Send to yourself instead of user's email for security
      replyTo: toEmail, // But allow reply to user
      subject: `Support Query from ${toName} - CampusBuzz`,
      text: `Name: ${toName}\nEmail: ${toEmail}\n\nQuery:\n${query}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4CAF50;">New Support Query - CampusBuzz</h2>
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px;">
            <p><strong>Name:</strong> ${toName}</p>
            <p><strong>Email:</strong> ${toEmail}</p>
            <p><strong>Query:</strong></p>
            <div style="background-color: white; padding: 15px; border-radius: 4px; margin-top: 10px;">
              ${query.replace(/\n/g, '<br>')}
            </div>
          </div>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            This email was sent from CampusBuzz support form.
          </p>
        </div>
      `,
    };

    const result = await transport.sendMail(mailOptions);
    console.log(`Email sent successfully: ${result.messageId}`);
    return result;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

//  API ENDPOINT WITH BETTER ERROR HANDLING
app.post("/send-email", async (req, res) => {
  console.log('Received POST request to /send-email');
  console.log('Request headers:', req.headers);
  console.log('Request body:', req.body);
  
  const { name, email, query } = req.body;

  // Validation
  if (!name || !email || !query) {
    console.log('Validation failed: Missing required fields');
    return res.status(400).json({ 
      success: false,
      message: "Name, email, and query are required",
      received: { name: !!name, email: !!email, query: !!query }
    });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.log('Validation failed: Invalid email format');
    return res.status(400).json({ 
      success: false,
      message: "Please provide a valid email address" 
    });
  }

  try {
    console.log(`Processing email for: ${name} (${email})`);
    const result = await sendMail(name.trim(), email.trim(), query.trim());
    
    console.log('Email sent successfully');
    res.status(200).json({ 
      success: true,
      message: "Email sent successfully",
      timestamp: new Date().toISOString(),
      messageId: result.messageId
    });
  } catch (error) {
    console.error('Error processing email:', error);
    res.status(500).json({ 
      success: false,
      message: "Failed to send email", 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// Catch all other routes
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Endpoint not found',
    availableEndpoints: {
      'GET /': 'Server info',
      'GET /health': 'Health check',
      'POST /send-email': 'Send support email'
    }
  });
});

//  START SERVER 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📧 Email service ready`);
  console.log(`🌐 CORS enabled for all origins`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});