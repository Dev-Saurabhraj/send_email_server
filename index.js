
const express = require("express");
const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const bodyParser = require("body-parser");
require("dotenv").config()

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
app.use(bodyParser.json());

//  SEND MAIL FUNCTION 
async function sendMail(toName, toEmail, query) {
  try {
    const { token } = await oAuth2Client.getAccessToken();

    const transport = nodemailer.createTransport({
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
      to: toEmail, 
      subject: `Support Query from ${toName}`,
      text: `Name: ${toName}\nEmail: ${toEmail}\n\nQuery:\n${query}`,
      html: `<p><strong>Name:</strong> ${toName}</p>
             <p><strong>Email:</strong> ${toEmail}</p>
             <p><strong>Query:</strong><br>${query}</p>`,
    };

    const result = await transport.sendMail(mailOptions);
    return result;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

//  API ENDPOINT 
app.post("/send-email", async (req, res) => {
  const { name, email, query } = req.body;

  if (!name || !email || !query) {
    return res.status(400).json({ message: "Name, email, and query are required" });
  }

  try {
    const result = await sendMail(name, email, query);
    res.status(200).json({ message: "Email sent successfully", result });
  } catch (error) {
    res.status(500).json({ message: "Failed to send email", error: error.message });
  }
});

//  START SERVER 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
