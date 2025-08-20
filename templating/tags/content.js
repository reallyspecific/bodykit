import Template from "../templating.js";

export default async function ( node, args ) {

	if ( args.template ) {
		const type = args.template;
		const templateContents = Template.getTemplateContents( type );
		if ( ! templateContents ) {
			return '<!-- Error rendering template: ' + type + ' -->' + node.sourceContents;
		}
		const template = new Template( { templateContents, type } );
		return await template.render(node);

	}

	const responseTemplate = new Template( { templateContents: node.sourceContents, type: 'content' } );

	return await responseTemplate.render(node);

};
