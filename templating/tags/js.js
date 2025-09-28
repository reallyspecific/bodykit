
import path from 'path';
import { URL } from 'url';
import {globalSettings} from "../../util/settings.js";
import {buildHTMLTag, makeSlug} from "../../util/formatting.js";
import {lstatSync as fileStat} from "fs";

export default async function ( node, args, compiler, templater ) {

	if ( ! args._ || args._.length < 1 ) {
		return false;
	}

	let assetPath = args._[0];
	let assetSlug = makeSlug( args._[0] );
	let version = compiler.assetVersion;

	if ( compiler ) {
		const jsCollection = compiler.compilers['js']?.collection ?? [];
		const asset = jsCollection.find( asset => asset.filename === assetPath + '.min.js' );
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
		' type="text/javascript"',
		` src="${assetUrl.toString()}"`,
		` id="${assetSlug}"`
	];

	return buildHTMLTag( 'script', attrs, '' );

};
