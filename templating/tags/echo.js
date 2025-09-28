import {getVar} from "../../util/formatting.js";

export default async function ( tag, node ) {

	let type = 'global';
	let name = tag.attrs.global ?? null;
	if ( !! tag.attrs.meta ) {
		type = 'meta';
		name = tag.attrs.meta;
	}
	if ( !! tag.attrs.node ) {
		type = 'node';
		name = tag.attrs.node;
	}
	if ( name === null ) {
		return '';
	}
	const value = getVar( type, name, tag.attrs, node );

	return value ?? '';

};
