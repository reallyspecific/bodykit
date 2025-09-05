import path from "path";
import {globalSettings} from "./settings.js";
import { Minimatch } from "minimatch";
import fs from "fs";
import readline from 'readline';
import Compiler from "./compiler.js";

export default class Watcher {
	constructor( props ) {
		const { directory, ignore, exclude, watching } = props;

		this.directory = directory ?? globalSettings.sourceIn;
		this.watching = Compiler.get( watching );

		this.excluded = new Set( [ ...exclude ?? [], '**/node_modules/**' ] );
		this.excluded.forEach( pattern => {
			pattern = new Minimatch( pattern );
		} );
		this.ignored = new Set( [ ...ignore ?? [], '._*', '*.map', '*.min' ] );
		this.ignored.forEach( pattern => {
			pattern = new Minimatch( pattern );
		} );
	}

	watch( server ) {
		readline.emitKeypressEvents(process.stdin);
		if ( process.stdin.isTTY ) {
			process.stdin.setRawMode( true );
		}
		process.stdin.on( 'keypress', ( str, key ) => {
			if ( key.name === 'q' ) {
				if ( server ) {
					server.stop();
				}
				process.exit();
			}
		} );
		console.log( 'Press "q" to exit' );

		this.server = server;

		return fs.watch(
			this.directory,
			{
				recursive: true,
				persistent: true
			},
			this.change.bind(this)
		);
	}

	async change( event, changedPath ) {

		for( const matcher of this.excluded ) {
			if ( pattern.match( changedPath ) ) {
				return;
			}
		}

		let reload = false;
		for ( const compiler of this.watching ) {
			if ( compiler.match( path.basename( changedPath ), compiler.include ) ) {
				try {
					await compiler.compile();
				} catch( e ) {
					console.error( `${changedPath} error: `, e );
				}
				if ( ! reload && compiler.reload ) {
					reload = true;
				}
			}
		}
		if ( this.server ) {
			this.server.refresh( reload );
		}

	}
}
