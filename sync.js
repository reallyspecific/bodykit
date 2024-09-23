import path from 'path';
import express from 'express';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { createServer } from 'node:http';
import { Server } from 'socket.io';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const startBrowser = ( host ) => {

	return new Promise( async ( resolve, reject ) => {

		try {

			const browser = await chromium.launch( { headless: true } );
			const page = await browser.newPage();
			resolve( page );

		} catch ( error ) {
			reject( error );
		}

	} );

}

const getPageContent = async ( tab, host, port = 3000, socket = 3001, path = '/' ) => {

	host = host.replace( /\/$/, '' ); // remove trailing slash from host

	const url = host + path;

	const response = await tab.goto( url, { timeout: 10000, waitUntil: 'domcontentloaded' } );
	if ( await response.headerValue( 'content-type' ) !== 'text/html; charset=UTF-8' ) {
		return '301';
	}
	if ( response.status() !== 200 && response.status() < 400 ) {
		throw new Error( 'Could not load page, returned status ' + response.status() );
	}
	for( let el of await tab.locator( 'a[href]' ).all() ) {
		// replace host url with localhost
		await el.evaluate( ( link, port ) => {
			const url = new URL( link.href );
			url.hostname = 'localhost';
			url.port = port;
			url.protocol = 'http';
			link.href = url.toString();
		}, port );
	}

	let content = await tab.content();
	content = content.replace( '</head>', `
		<script>
			var syncParams = { socket: ${socket} };
		</script>
		<script src="https://cdn.socket.io/4.7.5/socket.io.min.js" integrity="sha384-2huaZvOR9iDzHqslqwpR87isEmrfxqyWOF7hr7BY6KG0+hVKLoEXMPUJw3ynWuhO" crossorigin="anonymous"></script>
		<script src="http://localhost:${port}/sync.js"></script>
	</head>` );

	return content;

}

const openSocket = ( app, port = 3000, socket = 3001 ) => {

	const server = createServer( app );
	const io = new Server( server, {
		cors: {
			origin: `http://localhost:${port}`,
		}
	} );

	server.listen( socket );

	return io;

}

export default async ( host, port = 3000, socket = 3001 ) => {

	try {

		const tab = await startBrowser( host );

		const app = express();
		app.use( '/', ( req, res ) => {
			switch( req.url ) {
				case '/sync.js':
					return res.sendFile( __dirname + '/sync-listener.js' );
				/*case '/socket.io.js':
					const socketPath = require.resolve( 'socket.io-client/dist/socket.io.js' );
					return res.sendFile( socketPath );*/
				default:
					getPageContent( tab, host, port, socket, req.url ).then( content => {
						if ( content === '301' ) {
							res.set( 'location', host + req.url );
							res.status(301).send();
						} else {
							res.send( content );
						}
					} ).catch( error => {
						console.error( 'Could not retrieve content. ' + error );
					} );
			}
		} );
		const server = app.listen( port );

		const io = openSocket( app, port, socket );

		console.log( 'Debug server running at http://localhost:' + port );

		return { app, server, tab, io };

	} catch ( error ) {
		throw new Error( 'Could not load page debugger: ' + error );
	}

}