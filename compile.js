import browserslist from 'browserslist';
import { bundle, browserslistToTargets } from 'lightningcss';
import esbuild from 'esbuild';

import util from './util.js';

import fs from 'fs';
import path from 'path';

export function css( sourceIn, destOut ) {

	const sourcePath = path.join( sourceIn, 'css' );
	const outputPath = path.join( destOut, 'css' );

	return new Promise( ( resolve, reject ) => {

		const targets = browserslistToTargets(browserslist('>= 1%'));

		try {

			if ( fs.existsSync( outputPath ) ) {
				fs.rmSync( outputPath, { recursive: true } );
			}
			fs.mkdirSync( outputPath );

			fs.readdirSync( sourcePath ).forEach( file => {

				if ( file.substr( 0, 1 ) === '.' || file.substr( 0, 1 ) === '_' ) {
					return;
				}

				if ( path.extname( file ) !== '.css' ) {
					return;
				}

				const { code, map } = bundle( {
					filename: path.join( sourcePath, file ),
					minify: true,
					sourceMap: true,
					targets
				} );

				fs.writeFileSync( path.join( outputPath, file ), code );
				fs.writeFileSync( path.join( outputPath, file + '.map' ), map );

			} );

		} catch ( error ) {
			reject( error );
		}

		resolve();

	} );

}

export function js( sourceIn, destOut ) {

	const sourcePath = path.join( sourceIn, 'js' );
	const outputPath = path.join( destOut, 'js' );

	return new Promise( ( resolve, reject ) => {

		try {

			const promises = [];

			if ( fs.existsSync( outputPath ) ) {
				fs.rmSync( outputPath, { recursive: true } );
			}
			fs.mkdirSync( outputPath );

			fs.readdirSync( sourcePath ).forEach( file => {

				if ( file.substr( 0, 1 ) === '.' || file.substr( 0, 1 ) === '_' ) {
					return;
				}

				if ( path.extname( file ) !== '.js' ) {
					return;
				}

				promises.push( esbuild.build( {
					bundle: true,
					entryPoints: [ path.join( sourcePath, file ) ],
					minify: true,
					outfile: path.join( outputPath, file ),
					sourcemap: true
				} ) );

			} );

			Promise.all( promises ).then( () => {
				resolve();
			} );

		} catch ( error ) {

			reject( error );

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