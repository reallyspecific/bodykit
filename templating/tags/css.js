

import path from 'path';
import { URL } from 'url';
import {buildHTMLTag, makeSlug} from "../../util/formatting.js";
import {globalSettings} from "../../util/settings.js";

export default async function ( node, args ) {


	if ( ! args._ || args._.length < 1 ) {
		return false;
	}

	const assetPath = path.join( '_assets/css', args._[0] );
	const assetSlug = makeSlug( args._[0] );

	const assetUrl = new URL( assetPath, globalSettings.rootUrl );

	const attrs = [
		' type="text/css"',
		' rel="stylesheet"',
		` href="${assetUrl.toString()}"`,
		` id="${assetSlug}"`
	];

	return buildHTMLTag( 'link', attrs );

};
