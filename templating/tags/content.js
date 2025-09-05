import Template from "../templating.js";
import { makeSlug } from "../../util/formatting.js";
import markdownit from "markdown-it";

export default async function ( tag, node, props ) {

	if ( tag.attrs.template ) {
		const type = tag.attrs.template;
		const template = Template.getTemplate( makeSlug( type ) );
		if ( ! template ) {
			throw SyntaxError( `Could not find template: ${type} at: ${tag.file}:${tag.index}` );
		}
		const templater = new Template( { templateContents: template.contents, type } );
		return await templater.render( node, props );

	}

	const responseTemplate = new Template( { templateContents: node.sourceContents, type: 'content' } );

	const contents = await responseTemplate.render( node, props );

	return markdownit({html:true}).render( contents );

};
