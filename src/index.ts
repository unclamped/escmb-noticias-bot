import sqlite3 from 'sqlite3';
import pkg from 'whatsapp-web.js'
const { Client, LocalAuth, MessageMedia, MessageAck } = pkg;
import * as cheerio from 'cheerio';
import * as qrcode from 'qrcode-terminal';

try {
	const db = new sqlite3.Database('posts.db');
	db.run(`CREATE TABLE IF NOT EXISTS posts (url TEXT PRIMARY KEY)`);
	console.log('db init')

	let articuloPendienteID: string;
	let articuloPendienteURL: string;
	let main$: cheerio.CheerioAPI;
	let articulos: cheerio.Element[];

	let client: any;
	let clientInit: boolean;

	const iniciarWA = () => {
		return new Promise<pkg.Client>((resolve) => {
			console.log('starting whatsapp!')
			const client = new Client({
				authStrategy: new LocalAuth(),
				puppeteer: {
					headless: true
				}
			});

			client.on('qr', (qr: string) => {
				qrcode.generate(qr, {small: true});
			});
		
			client.on('ready', async () => {
				clientInit = true;
				console.log('whatsapp started!')
				resolve(client);
			});
		
			client.on('message_ack', async (ackMessage: { id: { id: string; }; }, ack: pkg.MessageAck) => {
				if (ack === MessageAck.ACK_SERVER && ackMessage.id.id === articuloPendienteID) {
					console.log('ack received!')
					articuloPendienteID = "";
					db.run('INSERT INTO posts (url) VALUES (?)', [articuloPendienteURL]);
					articuloPendienteURL = "";
					enviarArticulo(articulos, main$);
				};
			});

			client.initialize();
		})
	}

	const enviarArticulo = async (articulos: cheerio.Element[], $: cheerio.CheerioAPI) => {
		if (articulos.length === 0) {
			console.log('goodbye!')
			if (clientInit) await client.destroy();
			db.close();
			process.exit();
		}; // Se acabaron los articulos

		const articulo = articulos.shift();

		articuloPendienteURL = $(articulo).find('a.hover-type-none').attr('href') as string;

		const yaExisteFunc = (URL: string) => new Promise((resolve, reject) => 
			db.get('SELECT EXISTS(SELECT 1 FROM posts WHERE url = ?) AS URLExiste', [URL],
			(error, row: any) => error ? reject(error) : resolve(row.URLExiste === 1))
			);

		if (await yaExisteFunc(articuloPendienteURL)) {
			enviarArticulo(articulos, $);
			return;
		}

		if (!clientInit)
			console.log('initializing client!') 
			client = await iniciarWA();

		const titulo = $(articulo).find('h4.entry-title').text();
		const previewTexto = $(articulo).find('p:not(.meta)').first().text();
		const imagen = $(articulo).find('img.attachment-full.size-full').attr('src');

		const media = await MessageMedia.fromUrl(imagen!);
		// 120363159253802611@g.us <- grupo normal
		// 120363158664052984@g.us <- grupo basurero
		console.log('sending article!')
		let mensaje = await client.sendMessage('120363159253802611@g.us', media, {caption: `${titulo}\n\n${previewTexto}\n\n${articuloPendienteURL}`});
		articuloPendienteID = mensaje.id.id;
	};

	main$ = cheerio.load(await (await fetch('https://mb.unc.edu.ar/')).text());
	articulos = main$('article.post.fusion-column.column.col.col-lg-4.col-md-4.col-sm-4').toArray().reverse();

	console.log('triggering enviarArticulo')
	enviarArticulo(articulos, main$)
} catch (err) {
	console.error(err);
	process.exit();
};