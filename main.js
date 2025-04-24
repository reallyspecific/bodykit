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
		return compile.css( runSettings.sourceIn, runSettings.destOut );
	} else if ( what === 'js' ) {
		return compile.js( runSettings.sourceIn, runSettings.destOut );
	}

	return compile.all( runSettings.sourceIn, runSettings.destOut );

}

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
	if ( runSettings.host ) {
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
	watch( runSettings.sourceIn, ( event, changedPath ) => {
		const relPath = changedPath.split( path.sep );
		let what = 'all';
		if ( relPath[0] === 'css' ) {
			what = 'css';
		} else if ( relPath[0] === 'js' ) {
			what = 'js';
		}
		build( what ).then( () => {
			bumpVersion( runSettings.destOut );
			console.log( `${changedPath} ${event} event, compilation of ${what} files complete` );
			if ( what === 'js' ) {
				io.emit( 'reload' );
			}
			if ( what === 'css' ) {
				io.emit( 'refresh css', [ changedPath ] );
			}
		} ).catch( error => {
			console.error( `${changedPath} ${event} event, error: ${error}` );
		} );
	} );
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
