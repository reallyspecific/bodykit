import path from "path";

import {browserslistToTargets, bundle} from "lightningcss";
import browserslist from "browserslist";

import {Compiler} from "../util/compiler.js";
import {globalSettings} from "../util/settings.js";

export default class CSSCompiler extends Compiler {

	fileExtension = 'css';
	allowedExtensions = ['.css'];

	constructor( props ) {
		super( props );
		this.targets = browserslistToTargets( browserslist( this.buildOptions.browserslist ?? 'last 2 versions' ) );
	}

	async build( { fileName, filePath, buildOptions } ) {

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
				}
			}
		};
		if ( buildOptions?.env ?? false ) {
			visitors.EnvironmentVariable = {};
			for ( let propertyName in buildOptions.env ) {
				visitors.EnvironmentVariable[`--${propertyName}`] = () => {
					return buildOptions.env[propertyName];
				}
			}
		}

		try {

			const results = bundle({
				filename: filePath,
				minify: globalSettings.env === 'production',
				sourceMap: true,
				targets: this.targets,
				...( buildOptions?.compilerArgs ?? {} ),
				customAtRules,
				//errorRecovery: true,
				visitor: visitors
			});

			const cssFileName = path.basename( fileName, path.extname( fileName ) ) + '.min.css';

			const relPath = path.relative( this.sourceIn, path.dirname( filePath ) );

			this.collection.push( {
				filePath: filePath,
				destPath: path.join( this.destOut, relPath, cssFileName ),
				relPath: path.join( relPath, cssFileName ),
				filename: cssFileName,
			} );

			return [ {
				destPath: path.join( this.destOut, relPath, cssFileName ),
				filePath: filePath,
				relPath: path.join( relPath, cssFileName ),
				filename: cssFileName,
				contents: results.code,
			},{
				filePath: filePath,
				destPath: path.join( this.destOut, relPath, cssFileName ) + '.map',
				relPath: path.join( relPath, cssFileName ) + '.map',
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
					path: `.${error.fileName?.replace( this.sourceIn, '' ) ?? ''}`,
					message: error.message,
					stack: error.stack ?? null,
				}
			}];

		}

	}

	_declarationToString( declaration ) {
		if ( declaration.value.type === 'length-percentage' ) {
			return `${declaration.property}: ${declaration.value.value.value.value}${declaration.value.value.value.unit ?? ''}`;
		}
		return `${declaration.property}: ${declaration.value.value.value.value}`;
	}

	_cssBundleRuleQuery( rule, breakpoints, container = null ) {

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
				if ( property.startsWith('min-') ) {
					queryProps.push( this._declarationToString( declaration ) );
				}
			}
			for ( let declaration in breakpoints.get(to) ) {
				if ( property.startsWith('max-') ) {
					queryProps.push( this._declarationToString( declaration ) );
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
						props.push( this._delarationToString( declaration ) );
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

}
