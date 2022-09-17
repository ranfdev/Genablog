# Genablog

Static site generator with GTK4 UI

## Features
- Included markdown editor
- Theme selector
- Website preview
- Export to static html

# Build
```sh
npm install
npx rollup -c rollup.config.js
gjs -m build/bundle.mjs
```