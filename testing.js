const qrcode = require('qrcode-terminal');
const sqlite3 = require('sqlite3')

const db = new sqlite3.Database('posts.db');
db.run(`CREATE TABLE IF NOT EXISTS posts (url TEXT PRIMARY KEY)`);

db.get('SELECT EXISTS(SELECT 1 FROM posts WHERE url = ?) AS urlExiste', ['h'], async (error, row) => {
    console.log(row)
    console.log(row.urlExiste)
    if (row.urlExiste === 1) {
      return;
    }
})

const { Client, LocalAuth } = require('whatsapp-web.js');
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: false
    }
});

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
});

client.on('ready', () => {
    console.log('Client is ready!');
    client.on('message', message => {
        console.log(message);
    });    
});

client.initialize();