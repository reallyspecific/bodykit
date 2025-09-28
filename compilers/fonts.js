import path from "path";
import { readFileSync as readFile } from "fs";
import { subset } from '@web-alchemy/fonttools';
import {stripHtml} from "string-strip-html";
import {ttfInfo} from 'ttfmeta';

import {Compiler} from "../util/compiler.js";
import {globalSettings} from "../util/settings.js";


export default class FontCompiler extends Compiler {

	fileExtension = 'woff2';
	allowedExtensions = [ '.otf', '.ttf' ];

	constructor( props ) {
		super( props );
		this.embeddedFontBuffer = [];
	}

	async compile( props = {} ) {
		await super.compile(props);
		if ( this.buildOptions?.embedded ) {
			const fontBuffer = this.embeddedFontBuffer.join(' ');
			if ( ! fontBuffer ) {
				return;
			}
			// todo: minify css here
			this.write( [
				{
					filename: path.basename( 'fonts.css' ),
					contents: fontBuffer,
				}
			], path.join( this.destOut, path.dirname( this.buildOptions.embedded ) ) );
		}
	}

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

			const cssFileName = path.basename(filePath, path.extname(filePath)) + '.css';

			if ( buildOptions?.embedded ) {
				let fontName, fontStyle, fontWeight;
				await ttfInfo(inputFileBuffer, (err, result) => {
					if (err) {
						return;
					}
					fontName = result.meta.property.find(property => property.name === 'name' || property.name === 'font-family')?.text.replaceAll(/[^A-Za-z0-9-_]/g, '') ?? fontFileName;
					fontStyle = result.meta.property.find(property => property.name === 'font-subfamily')?.text.replaceAll(/[^A-Za-z0-9-_]/g, '').toLowerCase() ?? 'normal';
					if (fontStyle === 'regular') {
						fontStyle = 'normal';
					}
					return;
				});
				if (!fontWeight) {
					fontWeight = `100 900`;
				}
				if ( fontName && fontStyle && fontWeight ) {
					const base64contents = Buffer.from(outputFileBuffer).toString('base64');
					this.embeddedFontBuffer.push(
						`@font-face {` +
							`font-family: '${fontName}';` +
							`font-style: ${fontStyle};` +
							`font-weight: ${fontWeight};` +
							`src: url('data:font/woff2;charset=utf-8;base64,${base64contents}') format('woff2');` +
						`}`
					);
				}

			}

			this.collection.push( {
				destPath: path.join( this.destOut, relPath, fontFileName ),
				relPath: path.join( relPath, fontFileName ),
				filePath: filePath,
				filename: fontFileName,
			} );
			const files = [ {
				destPath: path.join( this.destOut, relPath, fontFileName ),
				filePath: filePath,
				relPath: path.join( relPath, fontFileName ),
				filename: fontFileName,
				contents: outputFileBuffer
			} ];

			return files;

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


