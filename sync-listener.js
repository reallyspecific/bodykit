( ( settings ) => {

	const socket = io( `http://localhost:${settings.socket || 3001}` );

	socket.on( 'disconnect', () => {
		console.log( 'received disconnect request' );
		socket.disconnect();
	} );

	socket.on( 'reload', () => {
		console.log( 'received reload request' );
		window.location.reload();
	} );

	socket.on( 'refresh css', changedFiles => {
		console.log( 'received css refresh request' );
		const styles = document.querySelectorAll( 'link[rel="stylesheet"]' );
		styles.forEach( link => {
			changedFiles.forEach( file => {
				if ( link.href.includes( file ) ) {
					link.href = link.href + '?v=' + Date.now();
				}
			} );
		} );
	} );

} )( syncParams );




