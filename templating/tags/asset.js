
import { lstatSync as fileStat } from 'fs';
import path from 'path';
import { URL } from 'url';
import {buildHTMLTag, makeSlug} from "../../util/formatting.js";
import {globalSettings} from "../../util/settings.js";
import Compiler from "../../util/compiler.js";

export default async function ( tag ) {

	if ( ! tag.attrs.type ) {
		throw SyntaxError( `Missing type for @asset tag at ${tag.file}:${tag.index}` );
	}

	let version = null, url = null, path = null;

	if ( !! tag.attrs.name ) {
		const compiler = Compiler.get(tag.attrs.type);
		if ( compiler.collection ) {
			const asset = compiler.collection.find( asset => asset.basename === tag.attrs.name || asset.filepath === tag.attrs.name );
			if ( asset ) {
				path = asset.filepath;
				version = Date.parse( asset.stat.mtime ).toString(36);
				url = asset.url;
			}
		} else {
			path = compiler.out( path.dirname( tag.attrs.name ), tag.basename( tag.attrs.name, type ), type );
			const file = fileStat( path.join( compiler.destOut, path ) );
			url = compiler.url( path );
			if ( file.isFile() ) {
				version = Date.parse( file.mtime ).toString(36);
			} else if ( ! tag.optional ) {
				return '';
			}
		}
	}

	const assetSlug = makeSlug( path );

	if ( tag.attrs.type === 'css' ) {
		const attrs = {
			type: 'text/css',
			rel: 'stylesheet',
			href: url.toString(),
			id: assetSlug,
		}
		return buildHTMLTag( 'link', attrs );
	} else if ( tag.attrs.type === 'js' ) {
		const attrs = {
			type: 'text/javascript',
			src: url.toString(),
			id: assetSlug,
		};
		return buildHTMLTag( 'script', attrs, '/* empty */' );
	} else if ( tag.attrs.type === 'image' ) {
		const imgAttrs = {
			src: url.toString(),
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
		const img = buildHTMLTag( 'img', imgAttrs );
		return buildHTMLTag( 'figure', figureAttrs, img );
	}

};
