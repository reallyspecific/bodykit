import {parseVars} from "../../util/formatting.js";

export default async function ( node, args ) {

	const stringTemplate = args._[0];
	if ( ! stringTemplate ) {
		return false;
	}

	return parseVars( stringTemplate, node, args );

};
