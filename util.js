import path from 'path';
import fs from 'fs';
import { parseArgs } from 'node:util';

export const globalSettings = {
	build:     'all',
	watch:     false,
	run:       false,
	sourceIn:  path.join( process.cwd(), 'source' ),
	destOut:   path.join( process.cwd(), 'dist' ),
	replace:   false,
	rootUrl:   '',
	filenames: false,
	locale:    'en-US'
};

export function updateGlobalSetting( key, value ) {
	globalSettings[key] = value;
}

export function parseSettings( cwd ) {

	const { values } = parseArgs( {
		options: {
			config: {
				type:  'string',
				short: 'c'
			},
			build: {
				type:  'string',
				short: 'b'
			},
			watch: {
				type:  'boolean',
			},
			run: {
				type:  'boolean',
			},
			in: {
				type:  'string',
				short: 'i'
			},
			out: {
				type:  'string',
				short: 'o'
			},
			replace: {
				type:  'boolean',
				short: 'r'
			},
			url: {
				type:  'string',
				short: 'u'
			},
			host: {
				type:  'string',
				short: 'h'
			},
			socket: {
				type:  'string',
				short: 's'
			},
			port: {
				type:  'string',
				short: 'p'
			},
			targetBrowsers: {
				type:  'string'
			},
			debug: {
				type:  'boolean',
				short: 'd'
			}
		},
		tokens: true
	} );

	// check for config file and use as fallback defaults

	for( let key in values ) {
		if ( typeof values[key] === 'string' && values[key].startsWith( '=' ) ) {
			values[key] = values[key].slice( 1 );
		}
	}

	const packageFile = fs.readFileSync( path.join( process.cwd(), 'package.json' ) );
	if ( packageFile ) {
		const packageSettings = JSON.parse( packageFile );
		if ( packageSettings && ( packageSettings.config?.bodykit ?? false ) ) {
			for ( let key in packageSettings.config.bodykit ) {
				values[key] = packageSettings.config.bodykit[ key ];
			}
		}
	}

	const newSettings = {
		build:          values.build || null,
		watch:          values.run || values.watch || null,
		run:            values.run || null,
		sourceIn:       path.join( cwd, values.in || 'source' ),
		destOut:        path.join( cwd, values.out || values.in || 'dist' ),
		replace:        values.replace || null,
		rootUrl:        values.url || null,
		filenames:      values.filenames || null,
		host:           values.host || null,
		port:           values.port || 3000,
		socket:         values.port || 3001,
		targetBrowsers: values.targetBrowsers || null,
		cssOptions:     values.css || [],
		jsOptions:      values.js || [],
		fontOptions:    values.font || [],
		mode:           values.debug ? 'debug' : 'production',
	};

	for ( const key in newSettings ) {
		if ( newSettings[key] !== null ) {
			updateGlobalSetting( key, newSettings[key] );
		}
	}

	return globalSettings;

}

/**
 * Creates a PHP file returning the current timestamp as a version number.
 */
export function bumpVersion( destOut ) {

	if ( ! destOut ) {
		destOut = globalSettings.destOut;
	}

	const versionFile = path.join( destOut, 'version.php' );
	const versionCode = `<?php\nreturn '1.0.${Date.now()}';\n`;

	if ( fs.existsSync( path.join( destOut, 'package.json' ) ) ) {
		const packageJson = JSON.parse( fs.readFileSync( path.join( destOut, 'package.json' ) ) );
		if ( packageJson.version ) {
			const version = packageJson.version.split( '.' );
			if ( version.length > 2 ) {
				version[ version.length - 1 ] = Date.now();
			} else {
				version.push( Date.now() );
			}
			packageJson.version = version.join( '.' );
		}
		fs.writeFileSync( path.join( destOut, 'package.json' ), JSON.stringify( packageJson, null, 2 ) );
	}

	fs.writeFileSync( versionFile, versionCode );

}

export default {
	bumpVersion,
	parseSettings
}