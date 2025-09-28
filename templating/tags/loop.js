import Template from "../templating.js";

export default async function ( node, args ) {

	if ( ! args.template || ! args.type ) {
		return false;
	}

	const filteredContent = Template.search( node.collection, {
		type:  args.type,
		sort:  args.sort || 'timestamp',
		order: args.order || 'desc',
		limit: 10
	} );

	const template = await Template.new( args.template, false );
	if ( ! template ) {
		return false;
	}

	let compiled = '';
	for( const loopNode of filteredContent ) {
		const rendered = await template.render(loopNode);
		if ( !! rendered ) {
			compiled += rendered;
		}
	}

	return compiled;

};
