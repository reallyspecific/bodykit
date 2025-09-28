import browserslist from 'browserslist';
import { bundle, browserslistToTargets } from 'lightningcss';
import esbuild from 'esbuild';

import util from './util.js';

import fs from 'fs';
import path from 'path';

async function recurseDirectoryForCompile( props ) {

	const sourcePath = path.join( props.sourceIn, props.subfolder ?? '' );
	const outputPath = path.join( props.destOut, props.subfolder ?? '' );

	if ( ! fs.existsSync( sourcePath ) ) {
		return;
	}

	try {

		if ( fs.existsSync( outputPath ) && sourcePath !== outputPath ) {
			fs.rmSync( outputPath, { recursive: true } );
		}
		if ( ! fs.existsSync( outputPath ) ) {
			fs.mkdirSync( outputPath, { recursive: true } );
		}

		fs.readdirSync( sourcePath ).forEach( async file => {

			if ( [ '.', '_', '~' ].includes( file.substring( 0, 1 ) ) ) {
				return;
			}

			const fileStats = fs.lstatSync( path.join( sourcePath, file ) );
			if ( fileStats.isDirectory() ) {
				await recurseDirectoryForCompile( {
					...props,
					subfolder: path.join( props.subfolder, file ),
				} );
				return;
			}

			if ( path.basename( file, path.extname( file ) ).endsWith( '.min' ) ) {
				return;
			}

			if ( props.allowedExtensions && ! props.allowedExtensions.includes( path.extname( file ) ) ) {
				return;
			}

			const compiledFiles = await props.callback( {
				filePath: path.join( sourcePath, file ),
				fileName: file,
				outputPath,
			} );

			if ( compiledFiles ) {
				compiledFiles.forEach( file => {
					fs.writeFileSync( path.join( outputPath, file.filename ), file.contents );
				} );
			}

		} );

	} catch ( error ) {
		throw error;
	}

}

export async function css( sourceIn, destOut ) {

	const targets = browserslistToTargets( browserslist('>= 1%') );

	return await recurseDirectoryForCompile( {
		sourceIn,
		destOut,
		subfolder: sourceIn === destOut ? '' : 'css',
		allowedExtensions: [ '.css' ],
		callback: async ( { fileName, filePath } ) => {

			const { code, map } = bundle( {
				filename: filePath,
				minify: true,
				sourceMap: true,
				targets
			} );

			const cssFileName = path.basename( fileName, path.extname( fileName ) ) + '.min.css';

			return [ {
				filename: cssFileName,
				contents: code,
			},{
				filename: cssFileName + '.map',
				contents: map,
			} ];

		}
	} );

}

export async function js( sourceIn, destOut ) {

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

};

export function all( sourceIn, destOut ) {

	const promises = [];

	promises.push( css( sourceIn, destOut ) );
	promises.push( js( sourceIn, destOut ) );

	util.bumpVersion( destOut );

	return Promise.all( promises );

}

export default { css, js, all };