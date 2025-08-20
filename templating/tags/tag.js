import {buildHTMLTag, parseVars} from "../../util/formatting.js";

export default async function ( node, args ) {

	if ( ! args._ || args._.length < 1 ) {
		return false;
	}

	const attrs = [];

	for( let key in args ) {
		if ( key === '_' ) {
			continue;
		}
		const value = parseVars( args[key], node, args );
		if ( key.substring(0, 4) === 'attr') {
			const attrName = key.substring(5,key.length - 1).toLowerCase();
			attrs.push(` ${attrName}="${value.replaceAll('"', '\"')}"`);
			continue;
		}
		args[key] = value;
	}

	const rendered = buildHTMLTag( args._[0], attrs, args?.innerText ?? null );

	return rendered;

};
