
import { lstatSync as fileStat } from 'fs';
import path from 'path';
import { URL } from 'url';
import {buildHTMLTag, makeSlug} from "../../util/formatting.js";
import {globalSettings} from "../../util/settings.js";

export default async function ( node, tag, compiler ) {

	if ( ! tag.attrs.type ) {
		throw SyntaxError( `Missing type for @asset tag at ${tag.file}:${tag.index}` );
	}

	let version = compiler.assetVersion.toString(36);

	let assetPath = tag.attrs.path ?? tag.attrs.name;

	if ( compiler && !! tag.attrs.name ) {
		const cssCollection = compiler.compilers[tag.attrs.type]?.collection ?? [];
		const asset = cssCollection.find( asset => asset.filename === tag.attrs.name + `.min.${tag.attrs.type}` );
		if ( asset ) {
			version = Date.parse( fileStat( asset.destPath ).mtime ).toString(36);
			assetPath = asset.relPath;
		}
		if ( !! tag.optional ) {
			return '';
		}
	}

	const assetUrl = new URL( assetPath, globalSettings.rootUrl );

	assetUrl.searchParams.set( 'v', tag.attrs.version ?? version );

	const assetSlug = makeSlug( assetPath );

	if ( tag.attrs.type === 'css' ) {
		const attrs = {
			type: 'text/css',
			rel: 'stylesheet',
			href: assetUrl.toString(),
			id: assetSlug,
		}
		return buildHTMLTag('link', attrs);
	} else if ( tag.attrs.type === 'js' ) {
		const attrs = {
			type: 'text/javascript',
			src: assetUrl.toString(),
			id: assetSlug,
		};
		return buildHTMLTag('script', attrs, '/* empty */');
	} else if ( tag.attrs.type === 'image' ) {
		const imgAttrs = {
			src: assetUrl.toString(),
			alt: tag.attrs.alt ?? '',
			title: tag.attrs.title ?? '',
			width: tag.attrs.width ?? '',
			height: tag.attrs.height ?? ''
		}
		const figureAttrs = {
			...tag.attrs,
			alt: null,
			title: null,
			width: null,
			height: null,
		}
		const img = buildHTMLTag('img', imgAttrs );
		return buildHTMLTag('figure', figureAttrs, img );
	}

};
