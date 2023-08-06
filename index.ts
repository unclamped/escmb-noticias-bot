import * as sqlite3 from 'sqlite3';
import { Client, LocalAuth, MessageMedia, MessageAck } from 'whatsapp-web.js';
import * as cheerio from 'cheerio';
import * as qrcode from 'qrcode-terminal';

try {
	const db = new sqlite3.Database('posts.db');
	db.run(`CREATE TABLE IF NOT EXISTS posts (url TEXT PRIMARY KEY)`);

	const client = new Client({
		authStrategy: new LocalAuth(),
		puppeteer: {
			headless: true
		}
	});

	let articuloPendienteID: string;
	let articuloPendienteURL: string;
	let main$: cheerio.CheerioAPI;
	let articulos: cheerio.Element[];

	const enviarArticulo = async (articulos: cheerio.Element[], $: cheerio.CheerioAPI) => {
		if (articulos.length === 0) {
			console.log('exiting');
			await client.destroy();
			db.close();
			process.exit();
		}; // Se acabaron los articulos

		const articulo = articulos.shift();

		articuloPendienteURL = $(articulo).find('a.hover-type-none').attr('href') as string;

		const yaExisteFunc = (URL: string) => new Promise((resolve, reject) => 
			db.get('SELECT EXISTS(SELECT 1 FROM posts WHERE url = ?) AS URLExiste', [URL],
			(error, row: any) => error ? reject(error) : resolve(row.URLExiste === 1))
			);

		if (await yaExisteFunc(articuloPendienteURL)) return;

		const titulo = $(articulo).find('h4.entry-title').text();
		const previewTexto = $(articulo).find('p:not(.meta)').first().text();
		const imagen = $(articulo).find('img.attachment-full.size-full').attr('src');

		const media = await MessageMedia.fromUrl(imagen!);
		let mensaje = await client.sendMessage('120363158664052984@g.us', media, {caption: `${titulo}\n\n${previewTexto}\n\n${articuloPendienteURL}`});
		articuloPendienteID = mensaje.id.id;
	};

	client.on('qr', qr => {
		qrcode.generate(qr, {small: true});
	});

	client.on('ready', async () => {
		console.log('bready steady go');
		main$ = cheerio.load(await (await fetch('https://mb.unc.edu.ar/')).text(	));
		articulos = main$('article.post.fusion-column.column.col.col-lg-4.col-md-4.col-sm-4').toArray().reverse();

		enviarArticulo(articulos, main$);

	/* for (const articulo of articulos.toArray().reverse()) {
		const url = main$(articulo).find('a.hover-type-none').attr('href') as string;
		console.log('running iteration for ' + url)

		const getUrlExistsPromise = (url: string) => new Promise((resolve, reject) => 
		db.get('SELECT EXISTS(SELECT 1 FROM posts WHERE url = ?) AS urlExiste', [url],
			(error, row: any) => error ? reject(error) : resolve(row.urlExiste === 1))
			);

		const yaExiste = await getUrlExistsPromise(url);
		
		if (yaExiste) {
		console.log('skipping iteration ' + url)
		continue;
		}

		const titulo = main$(articulo).find('h4.entry-title').text();
		const previewTexto = main$(articulo).find('p:not(.meta)').first().text();
		const imagen = main$(articulo).find('img.attachment-full.size-full').attr('src');

		const media = await MessageMedia.fromUrl(imagen!);
		let mensaje = await client.sendMessage('120363158664052984@g.us', media, {caption: `${titulo}\n\n${previewTexto}\n\n${url}`});
		pendiente = mensaje.id.id;

		while (!enviado) {
		setTimeout(() => {}, 1000)
		}

		db.run('INSERT INTO posts (url) VALUES (?)', [url])
		enviado = false;
		console.log('finished iteration ' + url)
	} */

	});

	client.on('message_ack', async (ackMessage, ack) => {
		console.log('ack ' + ack);
		if (ack === MessageAck.ACK_SERVER && ackMessage.id.id === articuloPendienteID) {
			articuloPendienteID = "";
			db.run('INSERT INTO posts (url) VALUES (?)', [articuloPendienteURL]);
			articuloPendienteURL = "";
			enviarArticulo(articulos, main$);
		};
	});

	client.initialize();
} catch (err) {
	console.error(err);
	process.exit();
};