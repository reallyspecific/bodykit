import path from "path";
import {
	readdirSync as readDir,
	lstatSync as fileStat,
	readFileSync as readFile
} from "fs";

import {makeExcerpt, makeSlug, makeTitleFromSlug} from "../util/formatting.js";
import {globalSettings} from "../util/settings.js";
import Template from "../templating/templating.js";
import {URL} from "url";
import {Compiler} from "../util/compiler.js";

export default class MarkdownCompiler extends Compiler {

	fileExtension = 'html';
	allowedExtensions = [ '.md' ];

	constructor( props ) {
		super( props );
		this.collection = [];
		this.assetVersion = props.assetVersion ?? null;
		this.compilers = props.compilers;
	}

	async build( { filePath } ) {

		const node = this.collection.find( node => node.filePath === filePath );
		if ( ! node ) {
			return [{
				filePath,
				error: {
					type: 'NotFoundError',
					message: 'Could not find file',
				}
			}];
		}

		if ( node.type === '@asset' ) {
			return node;
		}

		const baseName = path.basename( node.path, path.extname( node.path ) );
		if ( ( this.buildOptions?.useFilenames ?? false ) || baseName === 'index' ) {
			node.path = path.join( path.dirname( node.path ), baseName ) + '.html';
		} else {
			node.path = path.join( path.dirname( node.path ), baseName, 'index.html' );
		}
		node.url.pathname = node.path;

		return node;

	}

	async write( compiled, outputPath ) {
		if ( compiled.type === '@asset' && compiled.copy === false ) {
			return;
		}
		if ( ! compiled.error && compiled.type !== '@asset' && ! Array.isArray( compiled ) ) {
			try {
				const template = await Template.new(compiled.type || 'page');
				compiled.collection = this.collection;
				compiled.contents = await template.render( compiled, this );
				// todo: minify html here
				compiled = {
					filename: compiled.path,
					contents: compiled.contents,
				};
			} catch( error ) {
				console.error( error );
				compiled.error = {
					type: 'TemplateError',
					message: error.message,
					stack: error.stack,
				}
			}
		}

		await super.write( compiled, outputPath );
	}

	async compile( props= {} ) {
		try {
			this.collection = await this.collect('./');
		} catch( error ) {
			await this.write( {
				fileName: 'content',
				error: {
					type: error.name,
					message: error.message,
					stack: error.stack,
				}
			} );
			return;
		}
		for ( const node of this.collection ) {
			const fileNode = await this.build( {
				filePath: path.join( this.sourceIn, node.path ),
				collection: this.collection
			} );
			await this.write( fileNode, path.join( props?.destOut ?? this.destOut, props?.subfolder ?? '' ) );
		}
	}

	async collect( relDir = './' ) {

		let collection = [];

		const files = readDir( path.join( this.sourceIn, relDir ) );

		for ( const file of files ) {

			const basename = path.basename(file);
			if ( basename.startsWith('.') || basename.startsWith('_') || basename.startsWith('~') ) {
				continue;
			}

			const relPath = path.join(relDir, file);
			const sourceFile = path.join(this.sourceIn, relDir, file);
			const fileUrl = new URL(relPath, globalSettings.rootUrl);
			const fileProps = fileStat(sourceFile);

			if ( fileProps.isDirectory() ) {

				collection = [
					...collection,
					...await this.collect(relPath),
				];

			} else if (path.extname(file) === '.md') {

				const node = await MarkdownCompiler.parseFile(sourceFile);

				collection.push({
					type: node.type ?? 'page',
					path: relPath,
					filePath: path.join(this.sourceIn, relPath),
					url: fileUrl,
					...node,
				});

			} else {
				collection.push({
					type: '@asset',
					path: relPath,
					filename: file,
					filePath: path.join(this.sourceIn, relPath),
					destPath: path.join(this.destOut, relPath),
					url: fileUrl,
					copy: (
						this.buildOptions?.copyAssets ?? [ '.ico', '.gif', '.jpg', '.jpeg', '.webp', '.png', '.svg' ]
				 	).includes( path.extname(file) ),
					version: this.assetVersion ?? fileProps.mtime,
				});
			}

		}

		return collection;

	}

	static async parseFile( filePath ) {

		const source = readFile( filePath, 'utf8' );
		if ( ! source ) {
			throw new Error( `Could not read file: ${filePath}` );
		}

		const metaSplitPosition = RegExp(/^----\s*$/sm).exec(source);
		if (!metaSplitPosition) {
			return {};
		}

		const metaMatter = source.slice(0, metaSplitPosition.index).split('\n');
		const meta = {};

		metaMatter.forEach(line => {
			const split = line.split(':');
			const key = split.shift();
			const value = split.join(':');
			if (key && value && key.length > 0 && value.length > 0) {
				meta[key.trim()] = value.trim();
			}
		});

		const contents = source.slice(metaSplitPosition.index + metaSplitPosition[0].length).trim();

		return {
			source,
			sourceMeta: meta,
			sourceContents: contents,
			version: Date.parse(meta.datetime ?? fileStat(filePath).mtime ),
			type: meta.type || 'page',
			slug: makeSlug( path.basename(filePath) ),
			title: meta.title || makeTitleFromSlug( makeSlug( path.basename( filePath, path.extname(filePath) ) ) ),
			tags: meta.tags ? meta.tags.split(',').map(tag => tag.trim()) : [],
			excerpt: meta.excerpt || makeExcerpt(contents),
		}

	}

}
