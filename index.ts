import * as cheerio from 'cheerio';
import axios from 'axios';
import * as fs from 'fs';
import { Client, LocalAuth, MessageMedia, MessageAck, Message } from 'whatsapp-web.js';
import * as qrcode from 'qrcode-terminal';

(async () => {
  try {
    const respuestaMain = await axios.get('https://mb.unc.edu.ar/');
    const main$ = cheerio.load(respuestaMain.data);

    const articulos = main$('article.post.fusion-column.column.col.col-lg-4.col-md-4.col-sm-4');

    const articlePromises = articulos.toArray().map(async (element) => {
      const tiempo = main$(element).find('span.updated').text();

      if (!fs.existsSync('ultimo_articulo.txt')) {
        fs.writeFileSync('ultimo_articulo.txt', '');
      }

      let fechaArticulo = fs.readFileSync('ultimo_articulo.txt', 'utf8').trim();

      // Check if the current article is newer than the last recorded article
      if (tiempo > fechaArticulo) {
        const url = main$(element).find('a.hover-type-none').attr('href');
        const titulo = main$(element).find('h4.entry-title').text();
        const previewTexto = main$(element).find('p:not(.meta)').first().text();
        const imagen = main$(element).find('img.attachment-full.size-full').attr('src');

        const respuestaArticulo = (await axios.get(url!)).data; // usando ! porque ningun post en la web no va a tener un link
        const articulo$ = cheerio.load(respuestaArticulo);

        // const primerParrafo = articulo$(element).find('div.fusion-text.fusion-text-1 p').first().text().trim(); TODO: Copiar parrafo entero
        // console.log('Primer Parrafo:', primerParrafo);

        const client = new Client({
          authStrategy: new LocalAuth(),
          puppeteer: {
            headless: true
          }
        });

        let message: Promise<Message>; 

        client.on('qr', qr => {
          qrcode.generate(qr, {small: true});
        });

        client.on('ready', async () => {
          const media = await MessageMedia.fromUrl(imagen!);
          message = client.sendMessage('xxx@g.us', media, {caption: `${titulo}\n\n${previewTexto}\n\n${url}`})
        });

        client.on('message_ack', async (ackMessage, ack) => {
          if (ack === MessageAck.ACK_DEVICE && ackMessage.id.id === (await message).id.id) {
            fs.writeFileSync('ultimo_articulo.txt', tiempo);
            client.destroy();
            process.exit()
          }
        });

        client.initialize();
      }
    })
  } catch (error) {
    console.error(error);
  }
})();