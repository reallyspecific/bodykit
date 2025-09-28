
import { lstatSync as fileStat } from 'fs';
import path from 'path';
import { URL } from 'url';
import {buildHTMLTag, makeSlug} from "../../util/formatting.js";
import {globalSettings} from "../../util/settings.js";

export default async function ( node, args, compiler, templater ) {


	if ( ! args._ || args._.length < 1 ) {
		return false;
	}

	let assetPath = args._[0];
	let assetSlug = makeSlug( args._[0] );
	let version = compiler.assetVersion.toString(36);

	if ( compiler ) {
		const cssCollection = compiler.compilers['css']?.collection ?? [];
		const asset = cssCollection.find( asset => asset.filename === assetPath + '.min.css' );
		if ( asset ) {
			version = Date.parse( fileStat( asset.destPath ).mtime ).toString(36);
			assetPath = asset.relPath;
		}
		if ( ! asset && args._.includes('optional') ) {
			return '';
		}
	}

	const assetUrl = new URL( assetPath, globalSettings.rootUrl );

	assetUrl.searchParams.set( 'v', version );

	const attrs = [
		' type="text/css"',
		' rel="stylesheet"',
		` href="${assetUrl.toString()}"`,
		` id="${assetSlug}"`
	];

	return buildHTMLTag( 'link', attrs );

};
