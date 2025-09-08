import {rmSync as rm, rmdirSync as rmDir, readdirSync as readDir, existsSync as exists } from "fs";
import {Minimatch} from "minimatch";
import {globSync as glob} from "glob";
import path from "path";

export function matchPatterns( filePath, matchers, matchAny = true ) {
	if (Array.isArray(matchers)) {
		for (let matcher of matchers) {
			if (!(matcher instanceof Minimatch)) {
				matcher = new Minimatch(matcher);
			}
			if (matchAny && matcher.match(filePath)) {
				return true;
			}
			if (!matchAny && !matcher.match(filePath)) {
				return false;
			}
		}
		return !matchAny;
	}
	if ( matchers instanceof Minimatch ) {
		return matchers.match(filePath);
	}
	return false;
}

export function cleanFolder( what, destOut ) {
	if ( ! exists( destOut ) ) {
		return;
	}
	if ( what === true ) {
		rm( destOut, { recursive: true } );
		return;
	}
	const paths = [];
	const exclude = [];
	if ( what && typeof what === 'string' ) {
		what = [ what ];
	}
	if ( what && Array.isArray( what ) ) {
		for ( const pattern of what ) {
			const match = new Minimatch( pattern.startsWith( '!' ) ? pattern.substring(1) : pattern );
			if ( pattern.startsWith('!') ) {
				exclude.push( match );
			} else {
				paths.push( match );
			}
		}
	}
	if ( ! paths.length ) {
		paths.push( new Minimatch( '*' ) );
	}

	const selectiveDelete = ( dir ) => {
		const files = readDir( path.join( destOut, dir ), { withFileTypes:true } );
		let dirEmpty = true;
		for ( const file of files ) {
			if ( ! matchPatterns( file.name, paths ) && ! matchPatterns( path.join( dir, file.name ), paths ) ) {
				dirEmpty = false;
				continue;
			}
			if ( matchPatterns( file.name, exclude ) || matchPatterns( path.join( dir, file.name ), exclude )  ) {
				dirEmpty = false;
				continue;
			}
			if ( file.isDirectory() ) {
				const subdirEmpty = selectiveDelete( path.join( dir, file.name ) );
				if ( subdirEmpty ) {
					rm( path.join( destOut, dir, file.name ), { recursive: true } );
				} else {
					dirEmpty = false;
				}
				continue;
			}
			rm( path.join( destOut, dir, file.name ) );
		}
		return dirEmpty;
	}

	selectiveDelete( './' );

	return;
}
