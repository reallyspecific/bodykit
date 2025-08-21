import { subset } from '@web-alchemy/fonttools';
import { readFileSync as readFile } from "fs";
import path from "path";
import {Compiler} from "../util/compiler.js";
import {stripHtml} from "string-strip-html";

export default class FontCompiler extends Compiler {

	fileExtension = 'woff2';
	allowedExtensions = [ '.otf', '.ttf' ];

	async build( { filePath, buildOptions } ) {

		const inputFileBuffer = readFile(filePath);

		let unicodes = 'U+0000-007F';
		let textset = '';
		if ( buildOptions.contentCollection ) {
			for( const node of buildOptions.contentCollection ) {
				if ( node.contents ?? false ) {
					textset += stripHtml(node.contents).result;
				}
			}
		} else {
			unicodes += ',U+00A0-00FF';
		}

		try {
			const outputFileBuffer = await subset(inputFileBuffer, {
				'text': textset,
				'unicodes': buildOptions.unicodes ?? unicodes,
				'flavor': buildOptions.outputType ?? 'woff2',
			});
			const fontFileName = path.basename(filePath, path.extname(filePath)) + '.woff2';
			const relPath = path.relative( this.sourceIn, path.dirname( filePath ) );
			this.collection.push( {
				destPath: path.join( this.destOut, relPath, fontFileName ),
				relPath: path.join( relPath, fontFileName ),
				filename: fontFileName,
			} );
			return [{
				filename: fontFileName,
				contents: outputFileBuffer
			}];
		} catch( error ) {
			return [{
				filePath,
				error: {
					type: error.name,
					message: error.message,
					stack: error.stack,
				}
			}];
		}



	}

}


