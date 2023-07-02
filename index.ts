import axios from 'axios';
import * as sqlite3 from 'sqlite3';
import { Client, LocalAuth, MessageMedia, MessageAck } from 'whatsapp-web.js';
import * as cheerio from 'cheerio';
import * as qrcode from 'qrcode-terminal';

const db = new sqlite3.Database('posts.db');
db.run(`CREATE TABLE IF NOT EXISTS posts (url TEXT PRIMARY KEY)`);

(async () => {
  try {
    const client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true
      }
    });

    let pendiente: string;
    let enviado: boolean = false;

    client.on('qr', qr => {
      qrcode.generate(qr, {small: true});
    });

    client.on('ready', async () => {
      const respuestaMain = await axios.get('https://mb.unc.edu.ar/');
      const main$ = cheerio.load(respuestaMain.data);
      const articulos = main$('article.post.fusion-column.column.col.col-lg-4.col-md-4.col-sm-4');

      for (let i = articulos.length - 1; i >= 0; i--) {
        const articulo = articulos.eq(i);

        const url = main$(articulo).find('a.hover-type-none').attr('href') as string;

        const getUrlExistsPromise = (url: string) => new Promise((resolve, reject) => 
          db.get('SELECT EXISTS(SELECT 1 FROM posts WHERE url = ?) AS urlExiste', [url],
            (error, row: any) => error ? reject(error) : resolve(row.urlExiste === 1))
            );

        const yaExiste = await getUrlExistsPromise(url);
        console.log(yaExiste)
        
        if (yaExiste) {
          return;
        }

        const titulo = main$(articulo).find('h4.entry-title').text();
        const previewTexto = main$(articulo).find('p:not(.meta)').first().text();
        const imagen = main$(articulo).find('img.attachment-full.size-full').attr('src');

        const media = await MessageMedia.fromUrl(imagen!);
        let mensaje = client.sendMessage('120363158664052984@g.us', media, {caption: `${titulo}\n\n${previewTexto}\n\n${url}`});
        pendiente = (await mensaje).id.id;
        while (!enviado) {}
        
        db.run('INSERT INTO posts (url) VALUES (?)', [url])
        enviado = false;
      }
    });

    client.on('message_ack', async (ackMessage, ack) => {
      console.log(ack)
      if (ack === MessageAck.ACK_DEVICE && ackMessage.id.id === pendiente) {
        enviado = true;
      }
    });

    client.initialize();
  } catch (err) {
    console.error(err);
    db.close();
    process.exit();
  }
})();