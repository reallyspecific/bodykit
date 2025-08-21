import Template from "../templating.js";
import { makeSlug } from "../../util/formatting.js";
import markdownit from "markdown-it";

export default async function ( node, args ) {

	if ( args.template ) {
		const type = args.template;
		const template = Template.getTemplate( makeSlug( type ) );
		if ( ! template ) {
			return `<!-- Could not find template: ${type} -->\n${node.sourceContents}`;
		}
		const templater = new Template( { templateContents: template.contents, type } );
		return await templater.render(node);

	}

	const contents = markdownit({html:true}).render( node.sourceContents );

	const responseTemplate = new Template( { templateContents: contents, type: 'content' } );

	return await responseTemplate.render(node);

};
