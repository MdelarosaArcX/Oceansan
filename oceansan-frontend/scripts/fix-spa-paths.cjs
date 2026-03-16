const fs = require('fs');
const path = require('path');

const distIndex = path.join(__dirname, '..', 'dist', 'spa', 'index.html');

if (!fs.existsSync(distIndex)) {
  console.warn('[fix-spa-paths] dist/spa/index.html not found');
  process.exit(0);
}

let html = fs.readFileSync(distIndex, 'utf8');

html = html
  .replace(/(src|href)="\/assets\//g, '$1="./assets/')
  .replace(/(src|href)="\/logo\.jpeg"/g, '$1="./logo.jpeg"');

fs.writeFileSync(distIndex, html);
console.log('[fix-spa-paths] Updated asset paths in dist/spa/index.html');
