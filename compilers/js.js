import path from "path";
import esbuild from "esbuild";

import {Compiler} from "../util/compiler.js";

export default class JSCompiler extends Compiler {

	allowedExtensions = [ '.js' ];

	async build({ filePath, outputPath, buildOptions } ) {

		const build = await esbuild.build( {
			bundle: true,
			entryPoints: [ filePath ],
			minify: true,
			sourcemap: true,
			write: false,
			outdir: outputPath,
			outExtension: { '.js': '.min.js' },
			...buildOptions || []
		} );

		const returnFiles = [];

		build.outputFiles.forEach( file => {
			const jsFileName = path.basename( file.path );

			const relPath = path.relative( this.sourceIn, path.dirname( filePath ) );

			this.collection.push( {
				destPath: path.join( this.destOut, relPath, jsFileName ),
				relPath: path.join( relPath, jsFileName ),
				filename: jsFileName,
			} );

			returnFiles.push( {
				filename: jsFileName,
				contents: file.contents,
			} );
		} );

		return returnFiles;

	}

}
