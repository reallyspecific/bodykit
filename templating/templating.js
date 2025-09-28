import path from "path";
import {
	existsSync as fileExists,
	readFileSync as readFile,
	readdirSync as readDir,
} from "fs";
import parseAttrs from "attributes-parser";
import {globalSettings} from "../util/settings.js";
import tagProcessors from './tags.js';
import {makeSlug,getVar} from "../util/formatting.js";


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
			throw ReferenceError( `Could not retrieve [${slug}] template` );
		}

		return new Template( { templateContents: template.contents, slug } );

	}

	async render( node, compiler = null ) {

		let renderedContents = this.templateContents + '';

		const tagMatch = /\{@([a-z]+)(.*?)(\/?)}/gi

		const matches = [];
		let tag;
		while( ( tag = tagMatch.exec( renderedContents ) ) !== null ) {
			matches.push( {
				index: tag.index,
				file: path.relative( globalSettings.destOut, node.filePath ),
				replaces: tag[0],
				tag: tag[1],
				attrs: parseAttrs( tag[2] ),
				isClosed: tag[3] === '/',
			} );
		}
		for( let i = matches.length - 1; i >= 0; i-- ) {
			const match = matches[i];
			if ( ! match.isClosed ) {
				const closingTag = renderedContents.indexOf( '{/}', match.index + match.replaces.length );
				if ( closingTag === -1 ) {
					throw SyntaxError( `Unclosed tag: ${match.replaces} at ${match.file}:${match.index}` );
				}
				const alreadyClosed = matches.filter( match => match.closingIndex === closingTag + 3 );
				if ( alreadyClosed.length > 0 ) {
					throw SyntaxError( `Unclosed tag: ${match.replaces} at ${match.file}:${match.index}` );
				}
				match.closingIndex = closingTag + 3;
				match.content = renderedContents.slice( match.index + match.match.length, closingTag );
				match.replaces = renderedContents.slice( match.index, closingTag + 3 );
			}
		}

		for ( const tagMatch of matches ) {

			const renderedTag = await this.processTag( tagMatch, node, compiler );

			renderedContents = renderedContents.replace( tagMatch.replaces, renderedTag );

		}

		renderedContents = this.processShortTags( renderedContents, node, compiler );

		return renderedContents;

	}

	async processTag( tag, node, compiler = null ) {

		try {
			const processor = tagProcessors[tag.tag] ?? false;
			if ( ! processor ) {
				throw SyntaxError( `Unknown tag: ${tag.tag}` );
			}
			const replacement = await processor( node, tag, compiler, this );
			if ( typeof replacement === 'string' ) {
				return replacement;
			}
			return false;
		} catch ( error ) {
			throw error;
		}

	}

	processShortTags( contents, node, compiler = null ) {


		const shortTagMatch = /@@([a-z-_.:]+)/gi;
		let processed = contents + '';
		let shorttag;
		while( ( shorttag = shortTagMatch.exec( processed ) ) !== null ) {
			const properties = shorttag[1].split(':');
			const varType = properties.shift();
			const varName = properties.shift();
			const replacement = getVar( varType, varName, { format: properties[0] ?? null }, node );
			processed = processed.replace( shorttag[0], replacement );
		}

		return processed;

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
