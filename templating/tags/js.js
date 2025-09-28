
import path from 'path';
import { URL } from 'url';
import {globalSettings} from "../../util/settings.js";
import {buildHTMLTag, makeSlug} from "../../util/formatting.js";

export default async function ( node, args ) {

	if ( ! args._ || args._.length < 1 ) {
		return false;
	}

	const assetPath = path.join( '_assets/js', args._[0] );
	const assetSlug = makeSlug( args._[0] );

	const assetUrl = new URL( assetPath, globalSettings.rootUrl );

	const attrs = [
		' type="text/javascript"',
		` src="${assetUrl.toString()}"`,
		` id="${assetSlug}"`
	];

	return buildHTMLTag( 'script', attrs, '' );

};
