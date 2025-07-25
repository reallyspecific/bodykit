#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import readline from 'readline';

import compile from './compile.js';
import setupServer from './sync.js';
import { parseSettings, bumpVersion } from './util.js';

const runSettings = parseSettings( process.cwd() );

const build = ( what ) => {

	if ( what === 'css' ) {
		return compile.css( runSettings.sourceIn, runSettings.destOut, runSettings ?? null );
	} else if ( what === 'js' ) {
		return compile.js( runSettings.sourceIn, runSettings.destOut, runSettings ?? null );
	} else if ( what === 'fonts' ) {
		return compile.fonts( runSettings.sourceIn, runSettings.destOut, runSettings ?? null );
	}

	return compile.all( runSettings.sourceIn, runSettings.destOut, runSettings );

};

const DONT_WATCH_LIST = [ 'version.php', 'package.json', 'package-lock.json' ];

const watch = ( pathIn, callback ) => {

	console.log( 'Watching for changes in ' + pathIn );

	return fs.watch(
		pathIn,
		{
			recursive: true,
			persistent: true
		},
		callback
	);

};

if ( runSettings.watch ) {
	console.clear();
	let server = null, app = null, page = null, io = null;
	if ( runSettings.host ?? false ) {
		setupServer( runSettings.host ).then( config => {
			server = config.server;
			app    = config.app;
			page   = config.tab;
			io     = config.io;
		} ).catch( error => {
			console.error( error );
		} );
	}
	readline.emitKeypressEvents(process.stdin);
	if ( process.stdin.isTTY ) {
		process.stdin.setRawMode( true );
	}

	const watchDir = ( event, changedPath ) => {
		if ( DONT_WATCH_LIST.includes( path.basename( changedPath ) ) ) {
			return;
		}
		const extension = path.extname( changedPath );
		const basename = path.basename( changedPath, extension );
		let what = 'all';
		if ( extension === '.map' ) {
			return;
		} else if ( basename.endsWith('.min') ) {
			return;
		} else if ( extension.endsWith('~') ) {
			return;
		}else if ( extension === '.css' ) {
			what = 'css';
		} else if ( extension === '.js' ) {
			what = 'js';
		}
		build( what ).then( () => {
			bumpVersion( runSettings.destOut );
			console.log( `${changedPath} ${event} event, compilation of ${what} files complete` );
			if ( io ) {
				if ( what === 'js' ) {
					io.emit( 'reload' );
				}
				if ( what === 'css' ) {
					io.emit( 'refresh css', [ changedPath ] );
				}
			}
		} ).catch( error => {
			console.error( `${changedPath} ${event} event, error: ${error}` );
			console.error( error.stack );
		} );
	};

	watch( runSettings.sourceIn, watchDir );
	process.stdin.on( 'keypress', ( str, key ) => {
		if ( key.name === 'q' ) {
			if ( server ) {
				server.close();
			}
			process.exit();
		}
	} );
	console.log( 'Press "q" to exit' );
} else {
	build( runSettings.build );
}
