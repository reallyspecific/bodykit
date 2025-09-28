import {stripHtml} from "string-strip-html";
import markdownit from "markdown-it";
import {getSetting} from "./settings.js";
import phpDate from "php-date";

export function makeSlug( str ) {

	str = str.toLowerCase();
	str = str.replaceAll( /[\s_.\/]/g, '-' );
	str = str.replaceAll( /[^a-z0-9-]/g, '' );

	while ( str.includes( '--' ) ) {
		str = str.replaceAll( '--', '-' );
	}

	return str;
}

export function makeTitleFromSlug( slug ) {
	return toTitleCase( slug.replaceAll( '-', ' ' ) );
}

export function toTitleCase( str, exceptions ) {

	if ( ! str ) {
		return '';
	}

	if ( ! exceptions ) {
		exceptions = [ 'of', 'the', 'and' ];
	}

	return str.toLowerCase().split(' ').map( ( word, i ) => {
		return exceptions.includes( word ) &&
		i !== 0 ? word : word.charAt(0).toUpperCase().concat( word.substr(1) );
	}).join(' ');

}

export function findUniqueCharacters( str ) {
	return [ ...str ].reduce( ( acc, curr ) => {
		return acc.includes( curr ) ? acc : acc + curr;
	}, "" );
}

export function makeExcerpt(content) {

	const cleaned = stripHtml( markdownit().render(content) ).result;
	const truncated = cleaned.split('\n')[0].slice(0, 200);
	if ( cleaned.length > 200 ) {
		return truncated + '&hellip;'
	}
	return truncated;

}

export function getVar( type, name, attrs, node ) {
	let value = null;
	let format = 'string';
	if ( type === 'meta' ) {
		value = node.meta?.[name] ?? null;
		switch( name ) {
			case 'date':
			case 'time':
				value = new Date( value ?? node.mtime );
				format = name;
				break;
		}
	}
	if ( type === 'node' ) {
		value = node[name] ?? null;
	}
	if ( type === 'global' ) {
		switch( name ) {
			case 'now':
				format = 'date';
				value = new Date();
				break;
			case 'url':
				value = getSetting('rootUrl');
				break;
		}
	}

	switch( format ) {
		case 'time':
		case 'date':
			if ( !! attrs.format ) {
				value = phpDate( attrs.format, value );
			} else {
				value = format === 'time'
					? value?.toLocaleTimeString( undefined, { hour: 'numeric', minute: 'numeric' } )
					: value?.toLocaleDateString( undefined, { year: 'numeric', month: 'long', day: 'numeric' } );
			}
			break;
	}

	if ( ! value && attrs.default ) {
		return attrs.default;
	}

	return value ?? '';

}

export function parseVars( stringTemplate, node, args = {} ) {

	let replacement = stringTemplate + '';
	for( const match of stringTemplate.matchAll( /\$([a-z]*)?/g ) ) {
		let value = null;
		switch ( match[1] ) {
			case 'now':
				value = new Date();
				break;
			default:
				value = node[ match[1] ] ?? node.meta?.[ match[1] ] ?? args[ `default[${match[1]}]` ] ?? null;
				break;
		}
		if ( value === null ) {
			continue;
		}
		if ( args._.includes('year') ) {
			value = value.getFullYear();
		}
		if ( args._.includes('longdate') ) {
			value = new Date( value ).toLocaleDateString( getSetting('locale'), { year: 'numeric', month: 'long', day: 'numeric' } );
		}
		replacement = replacement.replace( match[0], value );
	}

	return replacement;

}

export function buildHTMLTag( tagName, attrs, innerText = null ) {

	if ( typeof attrs === 'object' && ! Array.isArray( attrs ) ) {
		const keys = Object.keys(attrs).filter( key => attrs[key] !== null );
		attrs = keys.map( key => `${key}="${attrs[key]}"` );
	}

	let tagAttrs = attrs.length > 0 ? ' ' + attrs.join(' ') : '';


	let replacement = `<${tagName}${tagAttrs}>`;
	if ( typeof innerText === 'string' ) {
		replacement += innerText + `</${tagName}>`;
	}

	return replacement;
}

