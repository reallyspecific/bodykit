#!/usr/bin/env node

import SegfaultHandler from 'segfault-handler';
import {
	existsSync as fileExists,
	readFileSync as readFile,
	writeFileSync as writeFile
} from 'fs';
import path from 'path';

import Compiler from "./util/compiler.js";
import CSSCompiler from "./compilers/css.js";
import MarkdownCompiler from "./compilers/markdown.js";
import JSCompiler from "./compilers/js.js";

import {getSetting, parseSettings} from "./util/settings.js";
import {cleanFolder} from "./util/files.js";
import Listener from "./server.js";
import Watcher from "./util/watcher.js";

const __dirname = import.meta.dirname;

SegfaultHandler.registerHandler('/crash.log');

const build = async ( what ) => {

	const clean = getSetting('clean');
	if ( what === getSetting('build') && clean ) {
		cleanFolder( clean, getSetting('destOut') );
	}

	const compiled = {};
	const compilers = Compiler.get(what);
	for( const compiler of compilers ) {
		if ( compiler.clean ) {
			cleanFolder( compiler.clean, compiler.destOut );
		}
		const files = await compiler.compile();
		if ( files ) {
			files.forEach( file => {
				if ( file.version ) {
					let path = file.filepath;
					if ( path.startsWith( '/' ) ) {
						path = path.slice( 1 );
					}
					compiled[path] = file.version;
				}
			} );
		}
	}
	const versioning = getSetting('versioning');
	if ( versioning ) {
		let version = {};
		const versionFile = typeof versioning === 'string' ? path.join( process.cwd(), versioning ) : path.join( getSetting('destOut'), 'version.json' );
		if ( fileExists( versionFile ) ) {
			version = readFile( versionFile, { encoding: 'utf-8' } ) || '{}';
			try {
				version = JSON.parse(version);
			} catch( error ) {}
			if ( ! version ) {
				version = {};
			}
		}
		version = {
			...version,
			...compiled,
		};
		writeFile( versionFile, JSON.stringify( version, null, '\t' ) );
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

		const externalModuleArgs = {
			sourceIn: props.sourceIn,
			destOut:  props.destOut,
			filenamePattern: props.filenamePattern,
			ignore:   props.ignore,
			exclude:  props.exclude,
			include:  props.include,
			rootUrl:  props.url,
			targets:  props.targets,
			...props.config?.[compiler] ?? {},
		};

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
			case 'scss':
				let ModuleCompiler = null;
				let modulePath = `@reallyspecific/bodykit-${compiler}`;
				if ( fileExists( path.join( __dirname, `_modules/${compiler}/main.js` ) ) ) {
					modulePath = path.join( __dirname, `_modules/${compiler}/main.js` );
				}
				try {
					ModuleCompiler = ( await import(modulePath) ).default;
				} catch( error ) {
					console.error( `${compiler} compiler not available, is @reallyspecific/bodykit-${compiler} installed?` );
				}
				if ( ModuleCompiler ) {
					Compiler.register( ModuleCompiler, externalModuleArgs );
				}
				break;
			default:
				try {
					ModuleCompiler = ( await import(compiler) ).default;
				} catch( error ) {
					console.error( `${compiler} compiler not available, is it installed?` );
				}
				if ( ModuleCompiler ) {
					Compiler.register( ModuleCompiler, externalModuleArgs );
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

