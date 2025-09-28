import Template from "../templating.js";

export default async function ( node, args ) {

	try {
		const type = args._[0] ?? 'default';
		const templateContents = Template.getTemplateContents( type );
		if ( ! templateContents ) {
			return '<!-- Error rendering template: ' + type + ' -->';
		}
		const template = new Template( { templateContents, type } );
		const rendered = await template.render(node);
		return rendered;
	} catch( e ) {
		return '<!-- Error rendering template: ' + e + ' -->';
	}

};
