#!/usr/bin/env node

import SegfaultHandler from 'segfault-handler';

import Compiler from "./util/compiler.js";
import CSSCompiler from "./compilers/css.js";
import MarkdownCompiler from "./compilers/markdown.js";
import JSCompiler from "./compilers/js.js";

import {getSetting, parseSettings} from "./util/settings.js";
import {cleanFolder} from "./util/files.js";
import Listener from "./server.js";
import Watcher from "./util/watcher.js";

SegfaultHandler.registerHandler('/crash.log');

const build = async ( what ) => {

	const clean = getSetting('clean');
	if ( what === getSetting('build') && clean ) {
		cleanFolder( clean, getSetting('destOut') );
	}

	const compilers = Compiler.get(what);
	for( const compiler of compilers ) {
		if ( compiler.clean ) {
			cleanFolder( compiler.clean, compiler.destOut );
		}
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

	await build( props.build );

	if ( props.watch ) {
		watch( props );
	}

}

await main();

