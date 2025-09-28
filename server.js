import {globalSettings} from "./util/settings.js";
import { Server } from 'socket.io';
import { createServer } from 'node:http';
import express from "express";
import path from "path";
import { existsSync as fileExists, readFileSync as readFile } from "fs";

export default class Listener {
	constructor( serverRoot ) {
		this.serverRoot = serverRoot;

		this.app = express();
		this.server = createServer( this.app );
		this.url = `http://${globalSettings.host}:${globalSettings.port}`;
		this.socket = new Server( this.server, {
			cors: {
				origin: this.url,
			}
		} );
		this.socket.on( 'connection', ( socket ) => {
			console.log( 'Socket connected, watching for changes.' );
		})
	}

	listener( request, resource ) {

		resource.set( 'Cache-Control', 'no-cache' );

		const requestUrl = new URL( request.url, this.url );
		let filePath = path.join( this.serverRoot, requestUrl.pathname );

		if ( requestUrl.pathname === '/bodykit.js' ) {
			resource.set( 'Content-Type', 'application/javascript' );

			return resource.sendFile( globalSettings.cwd + '/sync-listener.js');
		}
		if ( filePath.endsWith('.html') || fileExists( path.join( filePath, 'index.html' ) ) ) {
			if ( ! filePath.endsWith( '.html' ) ) {
				filePath = path.join( filePath, 'index.html' );
			}
			try {
				const fileContents = readFile(filePath, {encoding: 'utf-8'});
				resource.set( 'Content-Type', 'text/html' );
				const response = fileContents.replace( '</head>', `
					<script>
						var syncParams = { socketHost: "${this.url}", socket: ${globalSettings.socket} };
					</script>
					<script src="https://cdn.socket.io/4.7.5/socket.io.min.js" integrity="sha384-2huaZvOR9iDzHqslqwpR87isEmrfxqyWOF7hr7BY6KG0+hVKLoEXMPUJw3ynWuhO" crossorigin="anonymous"></script>
					<script src="${this.url}/bodykit.js"></script>
				</head>` );
				return resource.send( response );
			} catch( e ) {
				console.error( 'Could not load file: ' + filePath );
				console.error( e );
				return resource.send( '404' );
			}
		}


		if ( ! fileExists( filePath ) ) {
			return resource.send( '404' );
		}

		return resource.sendFile( filePath );

	}

	start() {
		this.app.use( '/', this.listener.bind(this) );
		console.log( 'Server running at ' + this.url );
		this.server.listen( globalSettings.port );
		this.socket.listen( globalSettings.socket );
	}
	stop() {
		this.server.close();
	}
	restart() {
	}

	refresh() {
		this.socket.emit( 'refresh' );
	}
	reload() {
		this.socket.emit( 'reload' );
	}
	disconnect() {
		this.socket.emit( 'disconnect' );
	}
}
