( ( settings ) => {

	const socket = io( settings.socketHost );

	socket.on( 'disconnect', () => {
		console.log( 'received disconnect request' );
		socket.disconnect();
	} );

	socket.on( 'reload', () => {
		console.log( 'received reload request' );
		window.location.reload();
	} );

	socket.on( 'refresh', changedFiles => {
		console.log( 'received refresh request' );
		const styles = document.querySelectorAll( 'link[rel="stylesheet"]' );
		styles.forEach( link => {
			const URL = new URL( link.href );
			URL.searchParams.set('v', Date.now());
			link.href = URL.toString();
		} );
	} );

} )( syncParams );




