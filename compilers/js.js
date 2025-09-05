import path from "path";
import esbuild from "esbuild";

import Compiler from "../util/compiler.js";

export default class JSCompiler extends Compiler {

	static type = 'js';

	include = [ '*.js' ];
	filename = '[path]/[name].min.js';

	async build( props ) {

		const build = await esbuild.build( {
			bundle: true,
			entryPoints: [ props.in ],
			minify: true,
			sourcemap: true,
			write: false,
			outdir: path.dirname( props.out ),
			outExtension: { '.js': '.min.js' },
			...this.options
		} );

		const returnFiles = [];

		build.outputFiles.forEach( file => {
			const filename = path.basename( file.path );
			const returned = {
				...props,
				filename: filename,
				out: file.path,
			};
			this.collection.push( returned );
			returnFiles.push( {
				...returned,
				contents: file.contents,
			} );
		} );

		return returnFiles;

	}

}
