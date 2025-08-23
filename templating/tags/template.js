import Template from "../templating.js";
import { makeSlug } from "../../util/formatting.js";

export default async function ( node, tag, compiler ) {

	const type = tag.attrs.name;
	const template = Template.getTemplate( makeSlug( type ), false );
	if ( ! template ) {
		throw SyntaxError( `Could not find template: ${type} at: ${tag.file}:${tag.index}` );
	}
	const templater = new Template( { templateContents: template.contents, type } );
	const rendered = await templater.render( node, compiler );
	return rendered;

};
