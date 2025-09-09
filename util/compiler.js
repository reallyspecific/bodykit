import path from "path";
import {
	existsSync as fileExists,
	mkdirSync as mkdir,
	writeFileSync as writeFile,
	copyFileSync as copyFile,
	lstatSync as fileStat,
} from "fs";
import {URL} from "url";
import {Minimatch} from "minimatch";
import { globSync as glob } from "glob";
import {browserslistToTargets} from "lightningcss";
import browserslist from "browserslist";

import {getSetting} from "./settings.js";
import {matchPatterns} from "./files.js";

export default class Compiler {

	static type = 'default';

	options = {};

	filenamePattern = getSetting('filename');
	include = ['*'];

	sourceIn = getSetting('sourceIn');
	destOut = getSetting('destOut');
	ignore = getSetting('ignore') ?? [];
	exclude = getSetting('exclude') ?? [];

	clean = null;

	targets = null;

	collection = new Set();
	props = {};

	constructor( buildOptions, props ) {
		if ( buildOptions ) {
			for( const key in buildOptions ) {
				if ( this.hasOwnProperty(key) ) {
					if ( Array.isArray( this[key] ) && ! Array.isArray( buildOptions[key] ) ) {
						this[key].push( buildOptions[key] );
					} else if ( Array.isArray( this[key] ) && Array.isArray( buildOptions[key] ) ) {
						this[key].concat( buildOptions[key] );
					} else {
						this[key] = buildOptions[key];
					}
					delete buildOptions[key];
				}
			}
			this.options = buildOptions;
		}
		if ( props ) {
			this.props = { ...this.props, ...props };
		}
		if ( buildOptions.targets ) {
			this.targets = browserslistToTargets( browserslist( buildOptions.targets ) );
		}
		for( const matcher in [ this.ignore, this.include, this.exclude, this.clean ] ) {
			if ( ! Array.isArray( this[matcher] ) ) {
				this[matcher] = [ this[matcher] ];
			}
			this[matcher] = this[matcher].map( matcher => {
				if ( typeof matcher === 'string' ) {
					return new Minimatch( matcher );
				}
				return matcher;
			} );
		}
	}

	static registeredCompilers = new Map();

	static register( compilerClass, props ) {
		Compiler.registeredCompilers.set( compilerClass.type, new compilerClass(props) );
	}

	static get( which = 'all' ) {
		if ( which === 'all' ) {
			return Compiler.registeredCompilers.values();
		}
		if ( Array.isArray( which ) ) {
			return Compiler.registeredCompilers.values()
				.filter( compiler => which.includes( compiler.constructor.type ) )

		}
		return Compiler.registeredCompilers.get( which );
	}

	async build() {
		return false;
	}

	find( relPath = null, include = this.include ) {
		let absPath = this.sourceIn;
		if ( relPath ) {
			if ( relPath.startsWith( '/' ) ) {
				absPath = relPath;
			} else if ( relPath.startsWith( '.' ) ) {
				absPath = path.join( process.cwd(), relPath );
			} else {
				absPath = path.join( absPath, relPath );
			}
		}
		const found = new Set();
		for ( const included of include ) {
			glob( path.join( absPath, '**/' + included ), { recursive:true, withFileTypes: true } ).forEach( file => {
				found.add( file );
			} );
		}
		return found.values();

	}

	out( path, basename, ext, pattern = this.filenamePattern ) {
		let pathParts = path ? path.split( '/' ) : [];
		while ( pathParts.length && ( pathParts[0] === '.' || pathParts[0] === '..' || pathParts[0] === '' ) ) {
			pathParts.shift();
		}
		let outputPath = pattern;
		if ( typeof pattern === 'function' ) {
			outputPath = pattern( { path, basename, ext, tree: pathParts } );
		}
		outputPath = outputPath.replaceAll( '[path]', pathParts.join('/').toLowerCase() ?? '' );
		if ( pathParts.length ) {
			outputPath = outputPath.replaceAll('[path:last]', getSetting('rootUrl') );
			for ( const partIndex in pathParts ) {
				outputPath = outputPath.replaceAll(`[path:${partIndex}]`, pathParts[partIndex].toLowerCase() );
			}
		}
		outputPath = outputPath.replaceAll( '[name]', basename );
		outputPath = outputPath.replaceAll( '[ext]', ext.substring(1) );
		return outputPath;
	}

	url( path ) {
		const url = new URL( getSetting('rootUrl') );
		url.pathname += path;
		return url;
	}

	async compile() {

		this.collection = new Set();
		return this.walkDirectory( {
			rootPath: this.sourceIn,
			in: '',
			build: this.build.bind(this),
			write: this.write.bind(this),
		} );

	}

	async write( compiled ) {

		if ( ! Array.isArray( compiled ) ) {
			compiled = [compiled];
		}

		for ( const file of compiled ) {

			if ( file.error ) {
				if ( typeof file.error === 'string' ) {
					console.log( file.error );
				}
				else if ( file.error.message ) {
					console.log(`\x1b[31m${file.filepath}: ${file.error.message}\x1b[0m`);
					if ( file.error.stack ) {
						console.log( file.error.stack );
					}
				}
				else {
					console.log(`\x1b[31m${file.filepath}: ${JSON.stringify(error)}\x1b[0m`);
				}
				return;
			}

			if ( file.copy ) {
				if ( ! fileExists( path.dirname( file.out ) ) ) {
					mkdir( path.dirname( path.join( file.out ) ), {recursive: true} );
				}
				copyFile( file.in, file.out );
			} else if ( file.contents ) {
				if ( ! fileExists( path.dirname( file.out ) ) ) {
					mkdir( path.dirname( file.out ), { recursive: true } );
				}
				writeFile( file.out, file.contents, { encoding:'utf8' } );
			}

		}

	}

	async walkDirectory( props ) {

		const files = this.find( props.in ?? null, props.include ?? this.include );

		const out = new Set();
		for (const file of files) {
			if ( file.isDirectory() || ! this.match( file.name, props.include ?? this.include ) || this.match( file.name, props.ignore ?? this.ignore ) ) {
				continue;
			}
			let filepath = path.relative( props.rootPath ?? this.sourceIn, file.fullpath() );
			if ( this.match( filepath, props.exclude ?? this.exclude ) ) {
				continue;
			}

			const ext = path.extname( file.name );
			const basename = path.basename( file.name, ext );
			const outpath = this.out( path.dirname( filepath ), basename, ext );

			try {
				const compiledFiles = await props.build( {
					in: file.fullpath(),
					out: path.join( this.destOut, outpath ),
					stat: fileStat( file.fullpath() ),
					filename: file.name,
					filepath,
					basename,
					ext,
					url: this.url( filepath ),
				} );
				if ( compiledFiles && props.write ) {
					compiledFiles.forEach( props.write );
				}
				( compiledFiles ?? [] ).forEach( file => {
					out.add( file );
				} );
			} catch( error ) {
				// todo: do something with this
				throw error;
			}

		}
		return out;

	}

	match( ...args ) {
		return matchPatterns( ...args );
	}

}
