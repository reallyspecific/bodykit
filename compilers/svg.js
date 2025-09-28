import path from "path";
import { readFileSync } from "fs";
import { optimize } from "svgo";

import Compiler from "../util/compiler.js";

export default class SVGCompiler extends Compiler {

	static reload = false;
	static type = 'svg';

	include = [ '*.svg' ];

	clean = [ '*.svg', '*.svg.map' ];

	async build( props ) {

		try {

			const optimized = optimize(
				readFileSync(props.in, 'utf8'),
				{
					path: props.in,
					minify: true,
					...this.options
				}
			);

			const returned = {
				...props,
			};
			this.collection.add(returned);

			return [{
				...returned,
				contents: optimized.data,
			}];

		} catch ( error ) {

			return [{
				...props,
				error
			}];

		}

	}

}
