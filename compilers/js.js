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
			returnFiles.push( {
				filename: path.basename( file.path ),
				contents: file.contents,
			} );
		} );

		return returnFiles;

	}

}
