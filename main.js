#!/usr/bin/env node

import path from 'path';
import fs, {rmSync as rm, existsSync as fileExists } from 'fs';
import readline from 'readline';

import setupServer from './sync.js';

import MarkdownCompiler from "./compilers/markdown.js";
import JSCompiler from "./compilers/js.js";
import CSSCompiler from "./compilers/css.js";
import FontCompiler from "./compilers/fonts.js";
import {bumpVersion, parseSettings} from "./util/settings.js";

const runSettings = parseSettings( process.cwd() );

const build = async ( what ) => {

	const compilers = [];

	if ( what === 'all') {
		if ( fileExists( runSettings.destOut) ) {
			rm(runSettings.destOut, {recursive: true,});
		}
	}

	if ( what === 'all' || what.includes('css') ) {
		compilers['css'] = new CSSCompiler({
			sourceIn: runSettings.sourceIn,
			destOut: runSettings.destOut,
			buildOptions: runSettings.cssOptions,
		} );
		await compilers['css'].compile();
	}
	if ( what === 'all' || what.includes('js') ) {
		compilers['js'] = new JSCompiler({
			sourceIn: runSettings.sourceIn,
			destOut: runSettings.destOut,
			buildOptions: runSettings.jsOptions,
		} );
		await compilers['js'].compile();
	}
	if ( what === 'all' || what.includes('md') ) {
		compilers['md'] = new MarkdownCompiler({
			sourceIn: runSettings.sourceIn,
			destOut: runSettings.destOut,
			buildOptions: runSettings.markdownOptions,
		} );
		await compilers['md'].compile();
	}
	if ( what === 'all' || what.includes('fonts') ) {
		compilers['fonts'] = new FontCompiler({
			sourceIn: runSettings.sourceIn,
			destOut: runSettings.destOut,
			buildOptions: {
				...runSettings.fontOptions,
				contentCollection: compilers.md?.collection,
			},
		} );
		await compilers['fonts'].compile();
	}

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

	const watchDir = async ( event, changedPath ) => {
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
		} else if ( extension === '.css' ) {
			what = 'css';
		} else if ( extension === '.js' ) {
			what = 'js';
		} else if ( extension === '.md' ) {
			what = 'md';
		}

		try {
			await build([what]);
			bumpVersion(runSettings.destOut);
			console.log(`${changedPath} ${event} event, compilation of ${what} files complete`);

			if (io) {
				if (what === 'js' || what === 'md') {
					io.emit('reload');
				}
				if (what === 'css') {
					io.emit('refresh css', [changedPath]);
				}
			}
		} catch( e ) {
			console.error( `${changedPath} ${event} event, error: ${e}` );
			console.error( e.stack );
		}
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
	await build( runSettings.build );
}
