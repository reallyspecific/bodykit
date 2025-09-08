
import { lstatSync as fileStat } from 'fs';
import path from 'path';
import {buildHTMLTag, makeSlug} from "../../util/formatting.js";
import Compiler from "../../util/compiler.js";

export default async function ( tag ) {

	if ( ! tag.attrs.type ) {
		throw SyntaxError( `Missing type for @asset tag at ${tag.file}:${tag.index}` );
	}

	let url = null, filepath = null;

	if ( !! tag.attrs.name ) {
		const compiler = Compiler.get(tag.attrs.type);
		if ( compiler.collection ) {
			const asset = compiler.collection.values().find(asset => asset.basename === tag.attrs.name || asset.filepath === tag.attrs.name);
			if (asset) {
				filepath = asset.filepath;
				url = asset.url;
				url.searchParams.set('v', Date.parse(asset.stat.mtime).toString(36));
			}
		}
		if ( ! filepath ) {
			filepath = compiler.out( path.dirname( tag.attrs.name ), path.basename( tag.attrs.name, tag.attrs.type ), '.' + tag.attrs.type );
			try {
				const file = fileStat(path.join(compiler.destOut, filepath));
				url = compiler.url(filepath);
				if (file.isFile()) {
					url.searchParams.set('v', Date.parse(file.mtime).toString(36));
				}
			} catch( error ) {
				filepath = null;
			}
		}
	}

	if ( filepath === null ) {
		if ( tag.attrs.optional ) {
			return '';
		}
		throw SyntaxError( `Could not find asset: ${tag.attrs.name} at ${tag.file}:${tag.index}` );
	}

	const assetSlug = makeSlug( path.basename( filepath ) );

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
