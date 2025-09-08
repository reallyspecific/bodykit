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

export default class Compiler {

	static type = 'default';

	options = {};

	filenamePattern = getSetting('filename');
	include = ['*'];

	sourceIn = getSetting('sourceIn');
	destOut = getSetting('destOut');
	ignore = getSetting('ignore') ?? [];
	exclude = getSetting('exclude') ?? [];

	targets = browserslistToTargets( browserslist( getSetting('targets') ?? 'last 2 versions' ) );

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
				.filter( compiler => which.includes( compiler.type ) )

		}
		return Compiler.registeredCompilers.get( which );
	}

	async build() {
		return false;
	}

	find( relPath = null ) {
		let absPath = this.sourceIn;
		if ( relPath ) {
			absPath = path.join( absPath, relPath );
		}
		return glob( path.join( absPath, '**/' + this.include ), { recursive:true, withFileTypes: true } );
	}

	out( path, basename, ext ) {
		let pathParts = path ? path.split( path.sep ) : [];
		while ( pathParts.length && ( pathParts[0] === '.' || pathParts[0] === '..' || pathParts[0] === '' ) ) {
			pathParts.shift();
		}
		let outputPath = this.filenamePattern;
		if ( typeof this.filenamePattern === 'function' ) {
			outputPath = this.filenamePattern( { path, basename, ext, tree: pathParts } );
		}
		outputPath = outputPath.replaceAll( '[path]', path ?? '' );
		if ( pathParts.length ) {
			outputPath = outputPath.replaceAll('[path:last]', getSetting('rootUrl') );
			for ( const partIndex in pathParts ) {
				outputPath.replaceAll(`[path:${partIndex}]`, pathParts[partIndex] );
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
			in: './',
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
				switch ( file.error.type ) {
					case 'ParserError':
					case 'SyntaxError':
						console.log(`\x1b[31m${file.fileName}: ${file.error.message}\r\n    in ${file.error.path} (${file.error.line}:${file.error.column})\x1b[0m`);
						break;
					default:
						console.log(`\x1b[31m${file.fileName}: ${JSON.stringify(file.error, null, 4)}\x1b[0m`);
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

		const files = this.find( props.in ?? null );

		const out = new Set();
		for (const file of files) {
			if ( file.isDirectory() || ! this.match( file.name, this.include ) || this.match( file.name, this.ignore ) ) {
				continue;
			}
			let filepath = path.relative( this.sourceIn, file.fullpath() );
			if ( this.match( filepath, this.exclude ) ) {
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

	match( filePath, matchers = null, matchAny = true ) {
		if ( Array.isArray( matchers ) ) {
			for( let matcher of matchers ) {
				if ( ! ( matcher instanceof Minimatch ) ) {
					matcher = new Minimatch( matcher );
				}
				if ( matchAny && matcher.match( filePath ) ) {
					return true;
				}
				if ( ! matchAny && ! matcher.match( filePath ) ) {
					return false;
				}
			}
			return ! matchAny;
		}
		return matchers.match( filePath );
	}

}
