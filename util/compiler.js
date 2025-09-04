import path from "path";
import {
	existsSync as fileExists,
	mkdirSync as mkdir,
	writeFileSync as writeFile,
	readdirSync as readDir,
	rmSync as rm,
	copyFileSync as copyFile,
	lstatSync as fileStat,
} from "fs";
import { Minimatch } from "minimatch";
import {globalSettings} from "./settings.js";

process.on('uncaughtException', function (err) {
	console.error('Caught exception: ', err);
});

export class Compiler {

	fileExtension = '';
	allowedExtensions = [];
	buildOptions = {};
	sourceIn = globalSettings.sourceIn;
	destOut = globalSettings.destOut;
	collection = [];

	constructor(props) {
		const {sourceIn, destOut, buildOptions} = props;
		sourceIn && (this.sourceIn = sourceIn);
		destOut && (this.destOut = destOut);
		this.buildOptions = buildOptions;
		this.collection = [];
		this.excludedFolders = globalSettings?.exclude ?? [];
		if ( buildOptions?.exclude ?? null ) {
			if ( typeof buildOptions.exclude === 'string' ) {
				this.excludedFolders.push( buildOptions.exclude );
			} else if ( Array.isArray( buildOptions.exclude ) ) {
				this.excludedFolders = this.excludedFolders.concat( buildOptions.exclude );
			}
			delete this.buildOptions.exclude;
		}
	}

	async build(props) {
		return false;
	}

	async compile(props = {}) {

		return this.recurseDirectory({
			sourceIn: this.sourceIn,
			destOut: this.destOut,
			buildOptions: this.buildOptions,
			allowedExtensions: this.allowedExtensions,
			buildCallback: this.build.bind(this),
			writeCallback: this.write.bind(this),
		});

	}

	async write(compiled, outputPath) {

		if ( ! Array.isArray( compiled ) ) {
			compiled = [compiled];
		}

		for ( const file of compiled ) {

			if (file.error) {
				switch (file.error.type) {
					case 'ParserError':
					case 'SyntaxError':
						console.log(`\x1b[31m${file.fileName}: ${file.error.message}\r\n    in ${file.error.path} (${file.error.line}:${file.error.column})\x1b[0m`);
						break;
					default:
						console.log(`\x1b[31m${file.fileName}: ${JSON.stringify(file.error, null, 4)}\x1b[0m`);
				}
				return;
			}

			if (file.copy) {
				if (!fileExists(path.dirname(file.destPath))) {
					mkdir(path.dirname(path.join(file.destPath), {recursive: true}));
				}
				copyFile( file.filePath, file.destPath );
			} else {
				if (!fileExists(path.dirname(path.join(outputPath,file.filename)))) {
					mkdir(path.dirname(path.join(outputPath,file.filename)), {recursive: true});
				}
				writeFile(path.join(outputPath, file.filename), file.contents, { encoding:'utf8' });
			}

		}

	}

	async recurseDirectory(props) {

		const relPath    = props.subfolder ?? ''
		const sourcePath = path.join(props.sourceIn, relPath);
		const outputPath = path.join(props.destOut, relPath);

		const exists = fileExists(sourcePath);
		if ( ! exists ) {
			return [];
		}

		const files = readDir(sourcePath);

		const minimatched = [];
		this.excludedFolders.forEach( match => {
			minimatched.push( new Minimatch(match) );
		} );

		for (const file of files) {

			if (['.', '~'].includes(file.substring(0, 1))) {
				continue;
			}
			if (['~'].includes(file.substring(file.length - 1))) {
				continue;
			}
			let relFile = path.join(relPath, file);
			let fail = false;
			for( const minimatch of minimatched ) {
				if (minimatch.match(relFile)) {
					fail = true;
					break;
				}
			}
			if ( fail ) {
				continue;
			}

			const currentPath = path.join(sourcePath, file);
			const fileStats = fileStat(currentPath);
			if (fileStats.isDirectory()) {
				await this.recurseDirectory({
					...props,
					destPath: outputPath,
					subfolder: path.join(relPath, file),
				});
				continue;
			}
			if (file.startsWith('_')) {
				continue;
			}

			if (path.basename(file, path.extname(file)).endsWith('.min')) {
				continue;
			}

			if (props.allowedExtensions && !props.allowedExtensions.includes(path.extname(file))) {
				continue;
			}

			const compiledFiles = await props.buildCallback({
				filePath: path.join(sourcePath, file),
				fileName: file,
				outputUrl: path.join(props.subfolder ?? '', path.basename(file)),
				outputPath,
				buildOptions: props.buildOptions,
			});

			if (compiledFiles) {
				compiledFiles.forEach(compiled => props.writeCallback(compiled, outputPath));
			}

		}

	}

}
