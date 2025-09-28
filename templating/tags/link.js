
import path from 'path';
import {globalSettings} from "../../util/settings.js";
import {buildHTMLTag, parseVars} from "../../util/formatting.js";

export default async function ( node, args ) {

	const attrs = [];

	if ( ! args.url && node.url ) {
		attrs.push( ` href="${node.url}"` );
	}

	if ( args.url ) {
		let url = parseVars( args.url, node, args );
		if ( url.substring(0, 1) === '/' ) {
			url = path.join( globalSettings.rootUrl, url );
		}
		attrs.push( ` href="${url}"` );
	}

	return buildHTMLTag( 'a', attrs, parseVars( args.label, node, args ) );

};
