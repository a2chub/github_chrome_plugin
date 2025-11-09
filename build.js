const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// distディレクトリをクリーンアップ
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
}

// distディレクトリを作成
fs.mkdirSync('dist', { recursive: true });

// ビルド設定
const buildOptions = {
  bundle: true,
  minify: false,
  sourcemap: true,
  target: 'es2020',
  format: 'iife', // Immediately Invoked Function Expression
  platform: 'browser',
};

// Background Script (Service Worker)
esbuild.build({
  ...buildOptions,
  entryPoints: ['src/background/service-worker.ts'],
  outfile: 'dist/background/service-worker.js',
}).catch(() => process.exit(1));

// Content Script
esbuild.build({
  ...buildOptions,
  entryPoints: ['src/content/content-script.ts'],
  outfile: 'dist/content/content-script.js',
}).catch(() => process.exit(1));

// Options Page Script
esbuild.build({
  ...buildOptions,
  entryPoints: ['src/options/options.ts'],
  outfile: 'dist/options/options.js',
}).catch(() => process.exit(1));

// manifest.json、HTML、CSS、assetsをコピー
console.log('Copying static files...');

// manifest.json
fs.copyFileSync('manifest.json', 'dist/manifest.json');

// options
fs.mkdirSync('dist/options', { recursive: true });
fs.copyFileSync('src/options/options.html', 'dist/options/options.html');
fs.copyFileSync('src/options/options.css', 'dist/options/options.css');

// assets
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir('assets', 'dist/assets');

console.log('Build completed!');

