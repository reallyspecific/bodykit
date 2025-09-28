import path from "path";
import {
	existsSync as fileExists,
	readFileSync as readFile,
	readdirSync as readDir,
} from "fs";
import minimistString from "minimist-string";
import {globalSettings} from "../util/settings.js";
import tagProcessors from './tags.js';
import markdownit from "markdown-it";
import {makeSlug} from "../util/formatting.js";

export default class Template {

	static templates = null;

	constructor( props ) {
		this.templateContents = props.templateContents;
		this.type = props.type ?? 'default';

		if ( ! Template.templates ) {
			Template.collectTemplates();
		}
	}

	static collectTemplates() {
		Template.templates = {};
		const templatePath = globalSettings.sourceIn;
		const files = readDir( templatePath, { encoding: 'utf-8', recursive: true } );
		files.forEach( file => {
			if ( file.endsWith( '.html' ) ) {
				const absPath = path.join( templatePath, file );
				const relPath = path.relative( templatePath, absPath );
				const name = relPath.replace( 'templates/', '' ).replace('.html','');
				const slug = makeSlug( name );
				Template.templates[slug] = {
					name,
					path: relPath,
					source: absPath,
					contents: Template.getTemplateContents( relPath ),
				};
			}
		}
		)
	}

	static getTemplate( slug, useDefault = true ) {
		if ( ! Template.templates ) {
			Template.collectTemplates();
		}
		const template = Template.templates[slug];
		if ( ! template && useDefault ) {
			return Template.templates.default;
		}
		return template;
	}

	static getTemplateContents( relPath ) {
		const templatePath = path.join( globalSettings.sourceIn, relPath );
		if ( ! fileExists( templatePath ) ) {
			return false;
		}
		return readFile( templatePath, { encoding: 'utf-8' } );
	}

	static async new( slug, useDefault = true ) {

		if ( ! Template.templates ) {
			Template.collectTemplates();
		}
		let template = Template.getTemplate( slug, useDefault );
		if ( ! template ) {
			throw ReferenceError( `Could not retrieve "${slug}" template` );
		}

		return new Template( { templateContents: template.contents, slug } );

	}

	async render( node, compiler = null ) {

		let renderedContents = this.templateContents + '';

		const matched = renderedContents.matchAll( /<!--%\s(.*?)\s*-->/gi );

		for ( const tagMatch of matched ) {

			const [ tag, tagContent ] = tagMatch;
			const args = minimistString( tagContent );
			const name = args._.shift().toLowerCase();
			args.name = name;

			const renderedTag = await this.processTag( name, args, node, compiler );

			renderedContents = renderedContents.replaceAll( tag, renderedTag );

		}

		markdownit({html:true}).render( renderedContents );

		// minify here probably

		return renderedContents;

	}

	async processTag( tagName, tagArgs, node, compiler = null ) {

		try {
			const processor = tagProcessors[tagName] ?? tagProcessors.tag;
			const replacement = await processor( node, tagArgs, compiler, this );
			if ( typeof replacement === 'string' ) {
				return replacement;
			}
			return false;
		} catch ( error ) {
			throw error;
		}

	}

	static search( contentDb, args ) {

		if ( ! contentDb || ! args ) {
			return [];
		}

		const type   = args.type ?? 'any',
			sort   = args.sort ?? 'timestamp',
			order  = args.order ?? 'desc',
			limit  = args.limit ?? 10,
			page   = args.page ?? 1,
			search = args.keywords ?? false;

		const results = contentDb.filter( item => {
			if ( item.type === '@asset' ) {
				return false;
			}
			const typeMatch   = type === 'any' || item.type === type ;
			const searchMatch = ! search || item.content.includes( search ) || item.title.includes( search ) || item.tags.includes( search );

			return typeMatch && searchMatch;
		} );

		results.sort( ( a, b ) => {
			if ( order === 'desc' ) {
				return b[sort] - a[sort];
			} else {
				return a[sort] - b[sort];
			}
		} );

		if ( limit > 0 && page ) {
			return results.slice( ( page - 1 ) * limit, page * limit );
		}

		return results;

	}

}
