import browserslist from 'browserslist';
import { bundle, browserslistToTargets } from 'lightningcss';
import esbuild from 'esbuild';

import util from './util.js';

import fs from 'fs';
import path from 'path';

import { subset } from '@web-alchemy/fonttools';

async function recurseDirectoryForCompile( props ) {

	const sourcePath = path.join( props.sourceIn, props.subfolder ?? '' );
	const outputPath = path.join( props.destOut, props.subfolder ?? '' );

	if ( ! fs.existsSync( sourcePath ) ) {
		return;
	}

	if ( fs.existsSync( outputPath ) && sourcePath !== outputPath ) {
		fs.rmSync( outputPath, { recursive: true } );
	}
	if ( ! fs.existsSync( outputPath ) ) {
		fs.mkdirSync( outputPath, { recursive: true } );
	}

	for (const file of fs.readdirSync(sourcePath)) {

		if ( [ '.', '_', '~' ].includes( file.substring( 0, 1 ) ) ) {
			continue;
		}
		if ( [ '~' ].includes( file.substring( file.length - 1 ) ) ) {
			continue;
		}

		const fileStats = fs.lstatSync( path.join( sourcePath, file ) );
		if ( fileStats.isDirectory() ) {
			await recurseDirectoryForCompile( {
				...props,
				subfolder: path.join( props.subfolder, file ),
			} );
			continue;
		}

		if ( path.basename( file, path.extname( file ) ).endsWith( '.min' ) ) {
			continue;
		}

		if ( props.allowedExtensions && ! props.allowedExtensions.includes( path.extname( file ) ) ) {
			continue;
		}

		const compiledFiles = await props.callback( {
			filePath: path.join( sourcePath, file ),
			fileName: file,
			outputPath,
		} );

		if ( compiledFiles ) {
			compiledFiles.forEach( compiled => {
				if ( compiled.error ) {

					switch( compiled.error.type ) {
						case 'ParserError':
							console.log( `\x1b[31m${compiled.fileName}: ${compiled.error.message}\r\n    in ${compiled.error.path} (${compiled.error.line}:${compiled.error.column})\x1b[0m` );
							break;
						default:
							console.log( `\x1b[31m${compiled.fileName}: ${JSON.stringify(compiled.error, null,4 ) }\x1b[0m` );
					}
					return;
				}
				fs.writeFileSync( path.join( outputPath, compiled.filename ), compiled.contents );
			} );
		}

	}


}

export async function css( sourceIn, destOut, props ) {

	const targets = browserslistToTargets( browserslist( props.targetBrowsers || '>= 1%' ) );

	return await recurseDirectoryForCompile( {
		sourceIn,
		destOut,
		subfolder: sourceIn === destOut ? '' : 'css',
		allowedExtensions: [ '.css' ],
		callback: async ( { fileName, filePath } ) => {

			try {
				let mixins = new Map();
				const results = bundle({
					filename: filePath,
					minify: true,
					sourceMap: true,
					targets,
					...props.bundleArgs || [],
					customAtRules: {
						mixin: {
							prelude: '<custom-ident>',
							body: 'style-block'
						},
						apply: {
							prelude: '<custom-ident>'
						},
						...props?.bundleArgs?.customAtRules || {}
					},
					visitor: {
						Rule: {
							custom: {
								mixin(rule) {
									mixins.set(rule.prelude.value, rule.body.value);
									return [];
								},
								apply(rule) {
									return mixins.get(rule.prelude.value);
								}
							}
						},
						...props?.bundleArgs?.visitor || {}
					},

				});

				const cssFileName = path.basename( fileName, path.extname( fileName ) ) + '.min.css';

				return [ {
					filename: cssFileName,
					contents: results.code,
				},{
					filename: cssFileName + '.map',
					contents: results.map,
				} ];

			} catch( error ) {

				return [{
					fileName,
					error: {
						type: error.data.type,
						line: error.loc.line,
						column: error.loc.column,
						path: `.${error.fileName.replace( sourceIn, '' )}`,
						message: error.message
					}
				}];

			}

		}
	} );

}

export async function js( sourceIn, destOut, props ) {

	return recurseDirectoryForCompile( {
		sourceIn,
		destOut,
		subfolder: sourceIn === destOut ? '' : 'js',
		allowedExtensions: [ '.js' ],
		callback: async ( { filePath, outputPath } ) => {

			const build = await esbuild.build( {
				bundle: true,
				entryPoints: [ filePath ],
				minify: true,
				sourcemap: true,
				write: false,
				outdir: outputPath,
				outExtension: { '.js': '.min.js' },
				...props?.buildArgs || []
			} );

			const returnFiles = [];

			build.outputFiles.forEach( file => {
				returnFiles.push( {
					filename: path.basename( file.path ),
					contents: file.contents,
				} );
			} );

			return returnFiles;

		}
	} );

}

export function fonts( sourceIn, destOut, props ) {

	return recurseDirectoryForCompile( {
		sourceIn,
		destOut,
		subfolder: sourceIn === destOut ? '' : 'fonts',
		allowedExtensions: [ '.otf', '.ttf' ],
		callback: async ( { filePath } ) => {

			const inputFileBuffer = await fs.promises.readFile( filePath );

			const outputFileBuffer = await subset( inputFileBuffer, {
				'unicodes': props?.subsetArgs?.unicodes ?? 'U+0000-007F,U+00A0-00FF',
				'flavor':   props?.subsetArgs?.outputType ?? 'woff2',
			} );

			return [ {
				filename: path.basename( filePath, path.extname( filePath ) ) + '.woff2',
				contents: outputFileBuffer
			} ];

		}
	} );



}

export function all( sourceIn, destOut, props ) {

	const promises = [];

	promises.push( css( sourceIn, destOut, props ) );
	promises.push( js( sourceIn, destOut, props ) );
	promises.push( fonts( sourceIn, destOut, props ) );

	util.bumpVersion( destOut );

	return Promise.all( promises );

}

export default { css, js, fonts, all };