# Vendored @resvg/resvg-wasm 2.6.2

Unmodified `index.mjs` and `index_bg.wasm` from the npm package
[`@resvg/resvg-wasm@2.6.2`](https://www.npmjs.com/package/@resvg/resvg-wasm)
(source: https://github.com/yisibl/resvg-js, license MPL-2.0, full text in
`LICENSE-MPL-2.0.txt`).

Vendored instead of installed because this site deploys buildless: Pages
Functions bundle relative imports, and the package's devDependencies are not
installed in production. Used only by `src/share-card-png.js` to rasterize the
first-party Case File Card SVG into the PNG served for social link previews.

Update by replacing both files from the same npm version and re-running
`node --test tests/share-card.test.mjs` and `npm run test:workers`.
