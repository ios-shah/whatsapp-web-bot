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
    // Connect to MongoDB and wait
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Create store after connection is ready
    const store = new MongoStore({ mongoose });

    // Initialize WhatsApp client with RemoteAuth + MongoStore
    const client = new Client({
      authStrategy: new RemoteAuth({
        store,
        backupSyncIntervalMs: 300000, // 5 min backup
      }),
      puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      }
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

    client.initialize();

    // Set up Express server
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
        let media;
        if (qrcodeUrl) {
          media = await MessageMedia.fromUrl(qrcodeUrl, { unsafeMime: true });
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

    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });

  } catch (error) {
    console.error('Failed to start application:', error);
  }
}

start();
