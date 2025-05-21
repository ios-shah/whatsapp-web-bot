require('dotenv').config();
const mongoose = require('mongoose');
const { Client, RemoteAuth, MessageMedia } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const qrcode = require('qrcode-terminal');

const MONGO_URI = process.env.MONGO_URI;
const port = process.env.PORT || 5000;

let isReady = false;

async function start() {
  try {
    if (!MONGO_URI) {
      throw new Error('MONGO_URI is not defined in environment variables');
    }

    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const store = new MongoStore({ mongoose });

    const client = new Client({
      authStrategy: new RemoteAuth({
        store,
        backupSyncIntervalMs: 300000,
      }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    });

    client.on('qr', (qr) => {
      console.log('QR RECEIVED');
      qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
      isReady = true;
      console.log('WhatsApp client is ready!');
    });

    client.on('auth_failure', (msg) => {
      console.error('Authentication failure:', msg);
    });

    client.on('disconnected', (reason) => {
      isReady = false;
      console.log('Client disconnected:', reason);
    });

    client.initialize();

    const app = express();
    app.use(cors());
    app.use(bodyParser.json());

    app.get('/', (req, res) => {
      res.send('WhatsApp Web API is running.');
    });

    app.post('/send-whatsapp', async (req, res) => {
      if (!isReady) {
        return res.status(503).json({ message: 'WhatsApp client not ready yet' });
      }

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

    app.listen(port, '0.0.0.0', () => {
      console.log(`Server is running on http://0.0.0.0:${port}`);
    });
  } catch (error) {
    console.error('Failed to start application:', error);
  }
}

start();
