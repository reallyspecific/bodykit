import browserslist from 'browserslist';
import { bundle, browserslistToTargets } from 'lightningcss';
import esbuild from 'esbuild';

import util from './util.js';

import fs from 'fs';
import path from 'path';

import { subset } from '@web-alchemy/fonttools';

async function recurseDirectoryForCompile( props ) {

	const sourcePath = path.join( props.sourceIn, props.subfolder ?? '' );
	const outputPath = path.join( props.destOut, props.subfolder ?? '' );

	if ( ! fs.existsSync( sourcePath ) ) {
		return;
	}

	if ( fs.existsSync( outputPath ) && sourcePath !== outputPath ) {
		fs.rmSync( outputPath, { recursive: true } );
	}
	if ( ! fs.existsSync( outputPath ) ) {
		fs.mkdirSync( outputPath, { recursive: true } );
	}

	for (const file of fs.readdirSync(sourcePath)) {

		if ( [ '.', '_', '~' ].includes( file.substring( 0, 1 ) ) ) {
			continue;
		}
		if ( [ '~' ].includes( file.substring( file.length - 1 ) ) ) {
			continue;
		}

		const fileStats = fs.lstatSync( path.join( sourcePath, file ) );
		if ( fileStats.isDirectory() ) {
			await recurseDirectoryForCompile( {
				...props,
				subfolder: path.join( props.subfolder, file ),
			} );
			continue;
		}

		if ( path.basename( file, path.extname( file ) ).endsWith( '.min' ) ) {
			continue;
		}

		if ( props.allowedExtensions && ! props.allowedExtensions.includes( path.extname( file ) ) ) {
			continue;
		}

		const compiledFiles = await props.callback( {
			filePath: path.join( sourcePath, file ),
			fileName: file,
			outputPath,
		} );

		if ( compiledFiles ) {
			compiledFiles.forEach( compiled => {
				if ( compiled.error ) {

					switch( compiled.error.type ) {
						case 'ParserError':
						case 'SyntaxError':
							console.log( `\x1b[31m${compiled.fileName}: ${compiled.error.message}\r\n    in ${compiled.error.path} (${compiled.error.line}:${compiled.error.column})\x1b[0m` );
							break;
						default:
							console.log( `\x1b[31m${compiled.fileName}: ${JSON.stringify(compiled.error, null,4 ) }\x1b[0m` );
					}
					return;
				}
				fs.writeFileSync( path.join( outputPath, compiled.filename ), compiled.contents );
			} );
		}

	}

}


const _cssDelarationToString = ( declaration ) => {
	if ( declaration.value.type === 'length-percentage' ) {
		return `${declaration.property}: ${declaration.value.value.value.value}${declaration.value.value.value.unit ?? ''}`;
	}
	return `${declaration.property}: ${declaration.value.value.value.value}`;

	/*
	queryProps.push( {
		type: "feature",
		value: {
			type: "range",
			operator: 'greater-than-equal',
			feature: feature,
			value: breakpoints[from][property].value
		}
	} );*/
}

const _cssBundleRuleQuery = ( rule, breakpoints, container = null ) => {

	let rules = [];
	let ruleString = rule.prelude.value.map(prop => prop.value.value).join('');
	if (ruleString.includes(' is ')) {
		[ container, ruleString ] = ruleString.split(' is ').map( prop => prop.trim() );
	}
	if (ruleString.includes('through')) {
		const [from, to] = ruleString.split('through').map(prop => prop.trim());
		if (!from || !to) {
			throw new Error(
				`Invalid @query rule: Must follow format "<breakpoint> through <breakpoint>"`,
				{cause: rule.loc},
				rule.loc.source_index,
				rule.loc.line
			);
		}
		if (!breakpoints.get(from)) {
			throw new Error(
				`Invalid @query rule: Breakpoint "${from}" does not exist`,
				{cause: rule.loc},
				rule.loc.source_index,
				rule.loc.line
			)
		}
		if (!breakpoints.get(to)) {
			throw new Error(
				`Invalid @query rule: Breakpoint "${to}" does not exist`,
				{cause: rule.loc},
				rule.loc.source_index,
				rule.loc.line
			)
		}
		const queryProps = [];
		for ( let property in breakpoints.get(from) ) {
			if (property.startsWith('min-')) {
				queryProps.push( _cssDelarationToString( declaration ) );
			}
		}
		for ( let declaration in breakpoints.get(to) ) {
			if (property.startsWith('max-')) {
				queryProps.push( _cssDelarationToString( declaration ) );
			}
		}
		if (queryProps.length) {
			rules.push(queryProps);
		}
	} else {
		const breaks = ruleString.split(',');
		breaks.forEach(breakPoint => {
			if (!breakpoints.get(breakPoint)) {
				throw new SyntaxError(
					`Invalid @query rule: Breakpoint "${breakPoint}" does not exist`,
					{cause: rule.loc},
					rule.loc.source_index,
					rule.loc.line
				)
			}
			const props = [];
			for ( let declaration of breakpoints.get(breakPoint) ) {
				if ( [ 'length-percentage'].includes( declaration.value.type ) ) {
					props.push( _cssDelarationToString( declaration ) );
				}
			}
			if (props.length) {
				rules.push(props);
			}
		});
	}

	if (rules.length === 0) {
		return rule.body;
	}

	let conditions = [];
	rules.forEach( ruleGroup => {
		conditions.push( `(${ruleGroup.join( ' and ' )})` );
	} );
	const conditionString = `(${conditions.join( ') or (' )})`;

	const returnValue = {
		type: container ? 'container' : 'media',
		value: {
			rules: rule.body.value,
			loc: rule.loc,
		}
	};
	if ( ! container ) {
		returnValue.value.query = {
			mediaQueries: [ {
				raw: conditionString
			} ]
		};
	} else {
		returnValue.value.name = container;
		returnValue.value.condition = {
			raw: conditionString
		};
		return {
			raw: `
				@container ${container} (${conditionString}) {
					${rule.body.toString()}
				}
			`
		}
	}

	return returnValue;


}

export async function css( sourceIn, destOut, props ) {

	const targets = browserslistToTargets( browserslist( props.targetBrowsers || '>= 1%' ) );

	return await recurseDirectoryForCompile( {
		sourceIn,
		destOut,
		subfolder: sourceIn === destOut ? '' : 'css',
		allowedExtensions: [ '.css' ],
		callback: async ( { fileName, filePath } ) => {

			let mixins = new Map();
			let queryRules = new Map();

			const customAtRules = {
				mixin: {
					prelude: '<custom-ident>',
					body: 'style-block',
				},
				apply: {
					prelude: '<custom-ident>'
				},
				destination: {
					prelude: '<custom-ident>',
					body: 'style-block',
				},
				// still not working erggggg
				/*queryRules: {
					prelude: '<custom-ident>',
					body: 'declaration-list',
				},
				query: {
					prelude: '*',
					body: 'style-block',
				}*/
			};
			const visitors = {
				Rule: {
					custom: {
						mixin(rule) {
							mixins.set(rule.prelude.value, rule.body.value);
							return [];
						},
						apply(rule) {
							return mixins.get(rule.prelude.value);
						},
						destination(rule) {
							if ( fileName === rule.prelude.value + '.css' ) {
								return rule.body.value;
							}
							return [];
						},
						/*
						queryRules(rule) {
							queryRules.set(rule.prelude.value, rule.body.value.declarations);
							return [];
						},
						query(rule) {
							return _cssBundleRuleQuery( rule, queryRules, props?.cssOptions?.rootContainer ?? false );
						},
						*/
					}
				}
			};
			if ( props.cssOptions.env ) {
				visitors.EnvironmentVariable = {};
				for ( let propertyName in props.cssOptions.env ) {
					visitors.EnvironmentVariable[`--${propertyName}`] = () => {
						return props.cssOptions.env[propertyName];
					}
				}
			}

			try {

				const results = bundle({
					filename: filePath,
					minify: props.mode === 'production',
					sourceMap: true,
					targets,
					nesting: true,
					...props.cssOptions.compilerArgs || [],
					customAtRules,
					//errorRecovery: true,
					visitor: visitors
				});

				const cssFileName = path.basename( fileName, path.extname( fileName ) ) + '.min.css';

				return [ {
					filename: cssFileName,
					contents: results.code,
				},{
					filename: cssFileName + '.map',
					contents: results.map,
				} ];

			} catch( error ) {

				return [{
					fileName,
					error: {
						type: error.data?.type ?? error.name,
						line: error.loc?.line ?? error.cause?.line ?? null,
						column: error.loc?.column ?? error.cause?.column ?? null,
						path: `.${error.fileName?.replace( sourceIn, '' ) ?? ''}`,
						message: error.message,
						stack: error.stack ?? null,
					}
				}];

			}

		}
	} );

}

export async function js( sourceIn, destOut, props ) {

	return recurseDirectoryForCompile( {
		sourceIn,
		destOut,
		subfolder: sourceIn === destOut ? '' : 'js',
		allowedExtensions: [ '.js' ],
		callback: async ( { filePath, outputPath } ) => {

			const build = await esbuild.build( {
				bundle: true,
				entryPoints: [ filePath ],
				minify: true,
				sourcemap: true,
				write: false,
				outdir: outputPath,
				outExtension: { '.js': '.min.js' },
				...props?.jsOptions.compilerArgs || []
			} );

			const returnFiles = [];

			build.outputFiles.forEach( file => {
				returnFiles.push( {
					filename: path.basename( file.path ),
					contents: file.contents,
				} );
			} );

			return returnFiles;

		}
	} );

}

export function fonts( sourceIn, destOut, props ) {

	return recurseDirectoryForCompile( {
		sourceIn,
		destOut,
		subfolder: sourceIn === destOut ? '' : 'fonts',
		allowedExtensions: [ '.otf', '.ttf' ],
		callback: async ( { filePath } ) => {

			const inputFileBuffer = await fs.promises.readFile( filePath );

			const outputFileBuffer = await subset( inputFileBuffer, {
				'unicodes': props?.fontOptions?.unicodes ?? 'U+0000-007F,U+00A0-00FF',
				'flavor':   props?.fontOptions?.outputType ?? 'woff2',
			} );

			return [ {
				filename: path.basename( filePath, path.extname( filePath ) ) + '.woff2',
				contents: outputFileBuffer
			} ];

		}
	} );



}

export function all( sourceIn, destOut, props ) {

	const promises = [];

	promises.push( css( sourceIn, destOut, props ) );
	promises.push( js( sourceIn, destOut, props ) );
	promises.push( fonts( sourceIn, destOut, props ) );

	util.bumpVersion( destOut );

	return Promise.all( promises );

}

export default { css, js, fonts, all };