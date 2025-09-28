import path from "path";
import {getSetting} from "./settings.js";
import { Minimatch } from "minimatch";
import fs from "fs";
import readline from 'readline';
import Compiler from "./compiler.js";

export default class Watcher {
	stop() {
		if ( this.server ) {
			this.server.stop();
		}
		process.exit();
	}

	constructor( props ) {
		const { directory, ignore, exclude, watching } = props;

		this.directory = directory ?? getSetting('sourceIn');
		this.watching = watching;

		this.excluded = new Set( [ ...exclude ?? [], '**/node_modules/**' ].map(
			pattern => {
				return new Minimatch( pattern );
			} )
		);
		this.ignored = new Set( [ ...ignore ?? [], '._*', '*.map', '*.min.*', '*~' ].map(
			pattern => {
				return new Minimatch( pattern );
			} )
		);

	}

	watch( server ) {
		readline.emitKeypressEvents(process.stdin);
		if ( process.stdin.isTTY ) {
			process.stdin.setRawMode( true );
		}
		process.stdin.on( 'keypress', ( str, key ) => {
			if ( key.name === 'q' || ( key.name === 'c' && key.ctrl ) ) {
				this.stop();
			}
		} );
		process.on('SIGINT', () => {
			this.stop();
		} );
		process.on('SIGTERM', () => {
			this.stop();
		} );
		process.on('SIGQUIT', () => {
			this.stop();
		} );
		console.log( 'Press "q" to exit' );

		this.server = server;

		fs.watch(
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
			if ( matcher.match( changedPath ) ) {
				console.log( `${event}: ${changedPath} [ignored]` );
				return;
			}
		}
		for( const matcher of this.ignored ) {
			if ( matcher.match( path.basename( changedPath ) ) ) {
				console.log( `${event}: ${changedPath} [ignored]` );
				return;
			}
		}

		let reload = false;
		for ( const compiler of Compiler.get( this.watching ) ) {
			if ( compiler.match( path.basename( changedPath ), compiler.include ) ) {
				console.log( `${event}: ${changedPath} [${compiler.constructor.type}]` );
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
