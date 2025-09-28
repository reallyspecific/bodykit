import Template from "../templating.js";
import { makeSlug } from "../../util/formatting.js";

export default async function ( node, args, compiler ) {

	try {
		const type = args._[0] ?? 'default';
		const template = Template.getTemplate( makeSlug( type ), false );
		if ( ! template ) {
			return '<!-- Could not find template: ' + type + ' -->';
		}
		const templater = new Template( { templateContents: template.contents, type } );
		const rendered = await templater.render( node, compiler );
		return rendered;
	} catch( e ) {
		return '<!-- Error rendering template: ' + e + ' -->';
	}

};
