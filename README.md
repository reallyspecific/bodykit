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

This exposes the bodykit binary in your project's node_modules/.bin.

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
  Input directory to process. Allows glob patterns. Example: 
  `--in=./src`

- `--out=<path>` (optional, default is value of `--in`)  
  Output directory for built files. Allows glob patterns. Example: 
  `--out=./dist`

- `--build=[all|css|js|fonts|md]` (optional, default is `all`)
  Build supported asset types in one pass. This will recurse the 
  `--in` directory and compile specified assets using the same
  structure in the `--out` folder. If no `--out` is specified, 
  compiled files will be built in the same location as their
  source.

- `--exclude=<pattern>` (optional)
  Exclude files and directories from processing using glob patterns,
  comma separated in CLI or an array within a JSON config file.
  Supports multiple patterns when used in configuration. Files matching
  any exclude pattern will be skipped during compilation. Allows glob  
  patterns, default is `**/node_modules/**`. Can be set within compiler 
  config options to apply to specific compiler types.
  Example: `--exclude="temp/**"`

- `--ignore=<pattern>` (optional)
  Exclude filename patterns from being compiled, comma separated in CLI 
  or an array within a JSON config file. Can be set within compiler
  config options to apply to specific compiler types. Default is 
  `._*,*.map,*.min.*,*~`
  Example: `--exclude="temp/**"`

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

- Exclude specific files or directories:
```shell script
bodykit --build=all --in=src --out=dist --exclude="temp/**"
```

## File Exclusion

Bodykit provides flexible file exclusion capabilities through glob patterns. Files and directories can be excluded from processing using the `--exclude` parameter or configuration settings.

### CLI Usage

Use the `--exclude` flag to exclude files from a single pattern:

```shell script
bash
# Exclude all files in any temp directory
bodykit --build=all --exclude="**/temp/**" --in=src --out=dist

# Exclude specific file types
bodykit --build=all --exclude="**/*.backup" --in=src --out=dist

# Exclude directories by name
bodykit --build=all --exclude="node_modules/**" --in=src --out=dist
```

### Configuration File

For more complex exclusion rules, use the package.json configuration:

```json
{
  "config": {
    "bodykit": {
      "exclude": [
        "**/temp/**",
        "**/*.backup",
        "**/node_modules/**",
        "drafts/**"
      ]
    }
  }
}
```

### Asset-Specific Exclusions

You can also configure exclusions for specific asset types:

```json
{
  "config": {
    "bodykit": {
      "exclude": "**/global-exclude/**",
      "js": {
        "exclude": "assets/js/excluded/**"
      },
      "css": {
        "exclude": [
          "**/*.draft.css",
          "temp/**"
        ]
      }
    }
  }
}
```

### Exclusion Pattern Examples

- `**/temp/**` - Excludes all temp directories and their contents
- `**/*.backup` - Excludes all .backup files
- `drafts/**` - Excludes everything in the drafts directory
- `**/exclude/*` - Excludes files directly in any exclude directory
- `test-*/**` - Excludes directories starting with "test-"

### How Exclusions Work

1. **Global exclusions** apply to all file processing
2. **Asset-specific exclusions** apply only when processing that asset type
3. **Patterns are cumulative** - files matching any exclusion pattern are skipped
4. **Built-in exclusions** automatically skip:
   - Files starting with `.` or `_`
   - Files ending with `~`
   - Files ending with `.min` (before extension)

The exclusion system uses [minimatch](https://github.com/isaacs/minimatch) for pattern matching, supporting standard glob syntax.

## What Bodykit handles

Bodykit ships with a pragmatic toolchain, so you can expect:

- JavaScript bundling and optimization (esbuild)
- CSS transformation/minification (Lightning CSS)
- HTML minification
- Optional Markdown-to-HTML workflows if you incorporate Markdown sources

Exact behavior depends on your project layout and flags. Use --help to see the capabilities supported by your installed version.

## Browsers support

Bodykit respects your project's Browserslist configuration. Add one to package.json or a .browserslistrc to control CSS/JS transforms:

```json
{
  "browserslist": [
    "defaults",
    "maintained node versions"
  ]
}
```

## Templating

# Bodykit Templating Engine

Bodykit includes a flexible templating engine that supports two types of template tags: **{@} template tags** for complex operations and **@@ shorttags** for simple variable interpolation.

## {@} Template Tags

Template tags use curly braces with an @ symbol and provide advanced functionality like content inclusion, asset management, and loops.

### Basic Syntax

```html
{@tagname attribute="value" /}
```

For tags with content:

```html
{@tagname attribute="value"}
  content here
{/}
```

### Available Template Tags

#### {@asset}

Generates HTML tags for CSS and JavaScript assets with automatic versioning.

**Required attributes:**
- `type` - Asset type: `"css"` or `"js"`

**Optional attributes:**
- `name` - Asset name (looks for compiled assets)
- `path` - Direct asset path
- `version` - Custom version parameter
- `optional` - If true, won't throw error if asset missing

**Examples:**

```html
{@asset type="css" name="default" /}
<!-- Outputs: <link type="text/css" rel="stylesheet" href="/path/to/default.min.css?v=abc123" id="default-css"> -->

{@asset type="js" path="/scripts/app.js" /}
<!-- Outputs: <script type="text/javascript" src="/scripts/app.js?v=abc123" id="app-js">/* empty */</script> -->

{@asset type="css" name="theme" optional="true" /}
<!-- Won't error if theme.min.css doesn't exist -->
```

#### {@content}

Renders content using a specified template or processes the current node's content through Markdown.

**Optional attributes:**
- `template` - Template to use for rendering

**Examples:**

```html
{@content template="page/body" /}
<!-- Renders current content using the page/body template -->

{@content /}
<!-- Renders current node's content through Markdown processor -->
```

#### {@template}

Includes another template by name.

**Required attributes:**
- `name` - Template name to include

**Example:**

```html
{@template name="head-global" /}
<!-- Includes the head-global template -->
```

#### {@loop}

Iterates over content items with filtering and templating.

**Optional attributes:**
- `type` - Content type to filter by
- `max` - Maximum number of items
- `template` - Template to use for each item

**Example:**

```html
{@loop type="blog" max="3" template="blog-excerpt" /}
<!-- Loops through up to 3 blog items, rendering each with blog-excerpt template -->
```

#### {@echo}

Outputs dynamic content or variables.

**Example:**

```html
{@echo content="Hello World" /}
```

### Template Tag Error Handling

Template tags provide detailed error messages with file locations:

```html
<!-- This will throw: Missing type for @asset tag at index.html:15 -->
{@asset name="styles" /}

<!-- This will throw: Could not find template: missing-template at index.html:23 -->
{@content template="missing-template" /}
```

## @@ Shorttags

Shorttags provide a concise way to insert variables and formatted content using double @ symbols.

### Basic Syntax

```html
@@type:variable:format
```

- `type` - Variable type (e.g., page, site, meta)
- `variable` - Variable name
- `format` - Optional formatting (e.g., date format)

### Examples

```html
<!-- Page/node variables -->
@@node:url

<!-- Global variables -->
@@global:url

<!-- Meta variables of currently parsed node -->
@@meta:description
@@meta:keywords
@@meta:title
@@meta:slug
@@meta:timestamp:Y-m-d
```


### Common Use Cases

**Page metadata:**
```html
<title>@@meta:title - Website Title</title>
<meta name="description" content="@@meta:description">
```


**Formatted dates:**
```html
<time datetime="@@meta:timestamp:c">{@echo meta="timestamp" format="F j, Y" /}</time>
```


**Content variables:**
```html
<h1>@@meta:title</h1>
<p>Published on {@echo meta="timestamp" format="F j, Y" /}</p>
```


## Template File Organization

Templates are automatically collected from your source directory:

```
src/
├── templates/
│   ├── default.html        # Main page template
│   ├── head-global.html    # Global head includes
│   └── page/
│       └── body.html       # Page body template
└── content/
    └── index.md
```


### Template Resolution

Templates are referenced by their path relative to the `templates/` directory:

- `templates/head-global.html` → `{@template name="head-global" /}`
- `templates/page/body.html` → `{@content template="page/body" /}`

### Default Template

If a specific template isn't found, the system falls back to `templates/default.html`.

## Complete Example

See **test/assets/in** for a complete usage example.
