require('dotenv').config();
const mongoose = require('mongoose');
const { Client, RemoteAuth, MessageMedia } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const qrcode = require('qrcode-terminal');

const MONGO_URI = process.env.MONGO_URI;
const port = 5000;

async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const store = new MongoStore({ mongoose });

// Prevent storing new auth data (read-only mode)
store.save = async () => {
  console.log('Skipped saving auth data (read-only mode)');
};

const client = new Client({
  authStrategy: new RemoteAuth({
    store,
    backupSyncIntervalMs: 300000, // this won't do anything now
  }),
  puppeteer: {
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});


    client.on('qr', (qr) => {
      console.log('QR RECEIVED');
      qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
      console.log('WhatsApp client is ready!');
    });

    client.on('auth_failure', (msg) => {
      console.error('Authentication failure:', msg);
    });

    client.on('disconnected', (reason) => {
      console.log('Client disconnected:', reason);
    });

    client.on('change_state', (state) => {
      console.log('Client state changed:', state);
    });

    client.on('remote_session_saved', () => {
      console.log('Remote session saved to MongoDB');
    });

    client.on('authenticated', () => {
      console.log('Client authenticated successfully');
    });

    client.initialize();

    // Global error handlers for unhandled promise rejections
    process.on('unhandledRejection', (reason, p) => {
      console.error('Unhandled Rejection at:', p, 'reason:', reason);
    });

    const app = express();
    app.use(cors());
    app.use(bodyParser.json());

    app.post('/send-whatsapp', async (req, res) => {
      const { phone, message, qrcode: qrcodeUrl } = req.body;

      if (!phone || !message) {
        return res.status(400).json({ message: 'Missing phone or message' });
      }

      try {
        const formattedPhone = phone + '@c.us';
        if (qrcodeUrl) {
          const media = await MessageMedia.fromUrl(qrcodeUrl, { unsafeMime: true });
          await client.sendMessage(formattedPhone, media, { caption: message });
        } else {
          await client.sendMessage(formattedPhone, message);
        }
        res.json({ message: 'WhatsApp message sent successfully' });
      } catch (error) {
        console.error('Error sending WhatsApp message:', error);
        res.status(500).json({ message: 'Failed to send message' });
      }
    });

    app.listen(port, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${port}`);
    });

  } catch (error) {
    console.error('Failed to start application:', error);
  }
}

start();
