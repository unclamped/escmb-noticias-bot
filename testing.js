const qrcode = require('qrcode-terminal');
const sqlite3 = require('sqlite3')

const { Client, LocalAuth, MessageAck } = require('whatsapp-web.js');
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true
    }
});

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
});

client.on('ready', async () => {
    console.log('Client is ready!');
    await client.sendMessage('120363158664052984@g.us', 'h');
});

client.on('message', msg => {
    console.log(msg)
});

client.initialize();