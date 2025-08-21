# Bodykit CLI

A small, fast CLI for building web assets without a ton of overhead or frameworks. Bodykit can bundle JavaScript, transform and minify CSS, and minify HTML. It is designed to be easy to drop into an existing project and automate common build tasks.

- License: GPLv3
- Package: @reallyspecific/bodykit
- Binary: bodykit

## Requirements

- A recent Node.js v18 or higher
- Yarn for package management (recommended)

## Installation

Install as a dev dependency in your project:

```shell script
bash
yarn add -D @reallyspecific/bodykit
```

This exposes the bodykit binary in your project’s node_modules/.bin.

## Quick start

Build everything in one go:

```shell script
bash
bodykit --build=all --in=./src --out=./dist
```


Watch for changes and rebuild automatically:

```shell script
bash
bodykit --watch --in=./src
```


Tip: Add scripts to your package.json for convenience.

```json
{
  "scripts": {
    "build": "bodykit --build=all --in=src --out=dist",
    "watch": "bodykit --watch --in=src"
  }
}
```


Run them with:

```shell script
bash
yarn build
# or
yarn watch
```

## CLI usage

Common flags:

- `--in=<path>`  
  Input directory to process. Example: `--in=./src`

- `--out=<path>` (optional, default is value of `--in`)  
  Output directory for built files. Example: `--out=./dist`

- `--build=[all|css|js|fonts|md]` (optional, default is `all`)
  Build supported asset types in one pass. This will recurse the 
  `--in` directory and compile specified assets using the same
  structure in the `--out` folder. If no `--out` is specified, 
  compiled files will be built in the same location as their
  source.

- --watch  
  Start file watching and incremental rebuilds.

- --serve=<path>
  Startup a local webserver with <path> as the server root. Must
  be used with watch for now, and page will soft/hard reload when
  assets are recompiled.

  Defaults to `https://localhost:8080`, this can be changed using 
  the `--host` and `--port` parameters

- --help  
  Print the CLI help with the full list of supported flags for your installed version.

Examples:

- Build to a clean directory:
```shell script
bodykit --build=all --in=src --out=dist
```

- Watch only a specific input folder:
```shell script
bodykit --watch --in=src/site
```

## What Bodykit handles

Bodykit ships with a pragmatic toolchain, so you can expect:

- JavaScript bundling and optimization (esbuild)
- CSS transformation/minification (Lightning CSS)
- HTML minification
- Optional Markdown-to-HTML workflows if you incorporate Markdown sources

Exact behavior depends on your project layout and flags. Use --help to see the capabilities supported by your installed version.

## Browsers support

Bodykit respects your project’s Browserslist configuration. Add one to package.json or a .browserslistrc to control CSS/JS transforms:

```json
{
  "browserslist": [
    "defaults",
    "maintained node versions"
  ]
}
```
