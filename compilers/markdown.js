import path from "path";
import {
	lstatSync as fileStat,
	readFileSync as readFile
} from "fs";

import {makeExcerpt, makeSlug, makeTitleFromSlug} from "../util/formatting.js";
import Template from "../templating/templating.js";
import Compiler from "../util/compiler.js";
import {Minimatch} from "minimatch";

export default class MarkdownCompiler extends Compiler {

	static reload = true;
	static type = 'md';

	copy = [ '*.ico', '*.gif', '*.jpg', '*.jpeg', '*.webp', '*.png', '*.svg' ];
	useFilenames = false;

	clean = ['*.html'];

	filenamePattern = ( { basename } ) => {
		if ( this.useFilenames || basename === 'index' ) {
			return '[path]/[name].html';
		} else {
			return '[path]/[name]/index.html';
		}
	}

	constructor( buildOptions, props ) {
		super( buildOptions, props );
		this.copy.forEach( (pattern, index) => {
			this.copy[index] = new Minimatch( pattern );
		} );
	}


	async compile( props = {} ) {
		const collected = await this.walkDirectory( {
			in: '',
			build: this.build.bind(this),
		} );
		collected.forEach( writeable => {
			this.write( [ writeable ] );
		} );
		return this.collection;
	}

	async build( props ) {

		const node = await MarkdownCompiler.parseFile( props.in );
		const built = {
			...props,
			contents: node,
		}

		this.collection.add( built );

		return [ built ];

	}


	async write( compiled ) {
		const toWrite = [];
		for ( const props of compiled ) {
			if (props.error) {
				toWrite.push(props);
				continue;
			}

			if (props.ext !== '.md' && this.match(props.filename, this.copy)) {
				toWrite.push({...props, copy: true});
				continue;
			}
			if (props.ext === '.md') {
				try {
					const template = Template.new( props.contents?.type ?? 'page' );
					props.contents = await template.render( { ...props.contents }, props, this );
					toWrite.push(props);
				} catch (error) {
					toWrite.push( {
						filename: props.filename,
						error: {
							type: 'TemplateError',
							message: error.message,
							stack: error.stack,
						}
					} );
				}

			}
		}
		return await super.write( toWrite );
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
