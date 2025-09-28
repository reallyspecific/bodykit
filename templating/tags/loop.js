import Template from "../templating.js";

export default async function ( tag, node ) {

	if ( ! tag.attrs.template || ! tag.attrs.type ) {
		throw SyntaxError( `Loop tag requires a "template" and "type" attribute` );
	}

	const filteredContent = Template.search( node.collection, {
		type:  tag.attrs.type,
		sort:  tag.attrs.sort || 'timestamp',
		order: tag.attrs.order || 'desc',
		limit: tag.attrs.limit || 10,
		page:  tag.attrs.page || 1,
	} );

	const template = await Template.new( tag.attrs.template, false );
	if ( ! template ) {
		throw SyntaxError( `Could not find template: ${tag.attrs.template} at: ${tag.file}:${tag.index}` );
	}

	let compiled = '';
	for( const loopNode of filteredContent ) {
		const rendered = await template.render( loopNode );
		if ( !! rendered ) {
			compiled += rendered;
		}
	}

	return compiled;

};
