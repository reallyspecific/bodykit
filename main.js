#!/usr/bin/env node

import path from 'path';
import fs, {rmSync as rm, existsSync as fileExists } from 'fs';
import readline from 'readline';

import MarkdownCompiler from "./compilers/markdown.js";
import JSCompiler from "./compilers/js.js";
import CSSCompiler from "./compilers/css.js";
import {bumpVersion, parseSettings} from "./util/settings.js";
import Listener from "./server.js";

const runSettings = parseSettings( process.cwd() );

const build = async ( what ) => {

	const compilers = [];

	const version = Date.now().toString(36);

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
			assetVersion: version,
			compilers: compilers,
		} );
		await compilers['md'].compile();
	}
	if ( what.includes('fonts') ) {
		try {
			const { default: FontCompiler } = await import("@reallyspecific/bodykit-fonts");

			compilers['fonts'] = new FontCompiler({
				sourceIn: runSettings.sourceIn,
				destOut: runSettings.destOut,
				buildOptions: runSettings.fontOptions,
				compilers: compilers,
			} );
			await compilers['fonts'].compile();
		} catch(e) {
			console.error( 'Font compiler not available, please install @reallyspecific/bodykit-fonts' );
		}

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
	let server = null;

	if ( runSettings.serve ) {
		server = new Listener( runSettings.serve );
		server.start();
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
		let refresh = true;
		if ( extension === '.map' ) {
			return;
		} else if ( basename.endsWith('.min') ) {
			return;
		} else if ( extension.endsWith('~') ) {
			return;
		} else if ( extension === '.css' ) {
			what = ['css','js','md'];
			refresh = false;
		} else if ( extension === '.js' ) {
			what = ['css','js','md'];
		} else if ( extension === '.md' || extension === '.html' ) {
			what = ['css','js','md'];
		}

		try {
			await build(what);
			if ( runSettings.phpVersion ) {
				bumpVersion(runSettings.destOut);
			}
			console.log(`${changedPath} ${event} event, compilation of ${what} files complete`);

			if (server) {
				if ( refresh ) {
					server.refresh();
				} else {
					server.reload();
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
				server.stop();
			}
			process.exit();
		}
	} );
	console.log( 'Press "q" to exit' );
} else {
	await build( runSettings.build );
}
