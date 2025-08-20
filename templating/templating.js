import path from "path";
import { existsSync as fileExists, readFileSync as readFile } from "fs";
import minimistString from "minimist-string";
import {globalSettings} from "../util/settings.js";
import tagProcessors from './tags.js';
import markdownit from "markdown-it";

export default class Template {

	constructor( props ) {
		this.templateContents = props.templateContents;
		this.type = props.type ?? 'default';
	}

	static getTemplateContents( type ) {
		const templatePath = path.join( globalSettings.sourceIn, '_templates', `${type}.html` );
		if ( ! fileExists( templatePath ) ) {
			return false;
		}
		return readFile( templatePath, { encoding: 'utf-8' } );
	}

	static async new( type, useDefault = true ) {

		const sourceIn = globalSettings.sourceIn;

		let template = this.getTemplateContents( type );
		if ( ! template ) {
			if ( ! useDefault ) {
				throw ReferenceError(`Template "${type}" does not exist`);
			}
			template = this.getTemplateContents( 'default' );
		}

		if ( ! template ) {
			throw Error( `Could not retrieve "${type}" template or default.html: ${error.message}` );
		}

		return new Template( { templateContents: template, type } );

	}

	async render( node ) {

		let renderedContents = this.templateContents + '';

		const matched = renderedContents.matchAll( /<!--%\s(.*?)\s*-->/gi );

		for ( const tagMatch of matched ) {

			const [ tag, tagContent ] = tagMatch;
			const args = minimistString( tagContent );
			const name = args._.shift().toLowerCase();
			args.name = name;

			const renderedTag = await Template.processTag( name, args, node );

			renderedContents = renderedContents.replaceAll( tag, renderedTag );

		}

		markdownit().render( renderedContents );

		// minify here probably

		return renderedContents;

	}

	static async processTag( tagName, tagArgs, node ) {

		try {
			const processor = tagProcessors[tagName] ?? tagProcessors.tag;
			const replacement = await processor( node, tagArgs );
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
