import path from "path";
import esbuild from "esbuild";
import { nodeExternalsPlugin } from "esbuild-node-externals";

import Compiler from "../util/compiler.js";

export default class JSCompiler extends Compiler {

	static reload = true;
	static type = 'js';

	include = [ '*.js', '*.mjs' ];

	clean = [ '*.js', '*.js.map' ];

	async build( props ) {

		const build = await esbuild.build( {
			bundle: true,
			entryPoints: [ props.in ],
			minify: true,
			sourcemap: 'external',
			write: false,
			outdir: path.dirname( props.out ),
            publicPath: path.join( this.publicOut, path.dirname( props.out ) ),
            outExtension: { '.js': '.min.js' },
            //plugins: [nodeExternalsPlugin()],
            format: path.extname( props.in ) === '.mjs' ? 'esm' : 'cjs',
			...this.options
		} );

		const returnFiles = [];
        const debugOutput = new Map();
		build.outputFiles.forEach( file => {
			const filename = path.basename( file.path );
			const returned = {
				...props,
				filename: filename,
				out: file.path,
			};
			this.collection.add( returned );
            if ( path.extname( file.path ) === '.map' && this.publicOut ) {
                let sourcemap = Buffer.from( file.contents ).toString('utf8');
                if ( sourcemap ) {
                    sourcemap = JSON.parse( sourcemap );
                    sourcemap.sources.forEach( ( source, index ) => {
                        let normalizedPath = path.normalize( path.join( path.dirname( file.path ), source ) );
                        let rootIndex = normalizedPath.indexOf( this.publicOut );
                        if ( rootIndex > -1 ) {
                            normalizedPath = path.join( '/', normalizedPath.substring( rootIndex ) );
                        }
                        sourcemap.sources[index] = normalizedPath;
                    } );
                    file.contents = JSON.stringify( sourcemap );
                }

            }
			returnFiles.push( {
				...returned,
				contents: file.contents,
			} );
		} );

		return returnFiles;

	}

}
