#!/usr/bin/env node

import SegfaultHandler from 'segfault-handler';

import {rmSync as rm, existsSync as fileExists } from 'fs';

import Compiler from "./util/compiler.js";
import CSSCompiler from "./compilers/css.js";
import MarkdownCompiler from "./compilers/markdown.js";
import JSCompiler from "./compilers/js.js";

import {getSetting, parseSettings} from "./util/settings.js";
import Listener from "./server.js";
import Watcher from "./util/watcher.js";

SegfaultHandler.registerHandler('/crash.log');

const build = async ( what ) => {

	if ( what === 'all' && getSetting('replace') && fileExists( getSetting('destOut') ) ) {
		rm( getSetting('destOut'), {recursive: true} );
	}

	const compilers = Compiler.get(what);
	for( const compiler of compilers ) {
		await compiler.compile();
	}
};

const watch = ( props ) => {

	console.clear();
	let server = null;

	if ( props.serve ) {
		server = new Listener( props.serve );
		server.start();
	}

	console.log( 'Watching for changes in ' + props.sourceIn );

	const watcher = new Watcher( { server } );
	watcher.watch();

};

async function main() {

	const props = await parseSettings( process.cwd() );
	for( const compiler of props.compilers ) {
		switch( compiler ) {
			case 'css':
				Compiler.register( CSSCompiler, props.config?.css ?? {} );
				break;
			case 'js':
				Compiler.register( JSCompiler, props.config?.js ?? {} );
				break;
			case 'md':
				Compiler.register( MarkdownCompiler, props.config?.md ?? {} );
				break;
			case 'fonts':
				try {
					const {default: FontCompiler} = await import("@reallyspecific/bodykit-fonts");
					Compiler.register( FontCompiler, props.config?.fonts ?? {} );
				} catch( error ) {
					console.error( 'Font compiler not available, is @reallyspecific/bodykit-fonts installed?' );
				}
				break;
			default:
				try {
					Compiler.register( Symbol( compiler ), props.config[ compiler ] ?? {} );
				} catch( error ) {
					console.error( 'Could not find compiler: ' + compiler );
				}
				break;
		}
	}

	if ( props.watch ) {
		watch( props );
	} else {
		await build( props.build );
	}

}

await main();

