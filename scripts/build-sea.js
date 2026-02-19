const { execSync } = require('child_process');
const { cpSync, mkdirSync, existsSync, writeFileSync } = require('fs');
const { resolve } = require('path');

const outDir = resolve(__dirname, '..', 'out');
const blobFile = resolve(__dirname, '..', 'sea-prep.blob');
const exeFile = resolve(outDir, 'insta-launcher.exe');

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}

const nodePath = process.execPath;
cpSync(nodePath, exeFile);

console.log('Copied Node.js to', exeFile);

if (process.platform === 'win32') {
  console.log('Removing signature from executable...');
  try {
    execSync(`signtool remove /s "${exeFile}"`, { stdio: 'inherit' });
  } catch {
    console.log('SignTool not found, skipping signature removal');
  }
}

console.log('Injecting SEA blob...');
execSync(`npx postject "${exeFile}" NODE_SEA_BLOB "${blobFile}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --overwrite`, {
  stdio: 'inherit'
});

console.log('Copying node_modules...');
const nodeModulesDest = resolve(outDir, 'node_modules');
if (!existsSync(nodeModulesDest)) {
  mkdirSync(nodeModulesDest, { recursive: true });
}

const modulesToCopy = ['playwright', 'playwright-core', 'chalk', 'ora', 'cli-spinners', 'cli-cursor', 'restore-cursor', 'log-symbols', 'strip-ansi', 'ansi-regex', 'is-unicode-supported', 'color-convert', 'color-name', 'supports-color', 'has-flag'];
const nodeModulesSrc = resolve(__dirname, '..', 'node_modules');

for (const mod of modulesToCopy) {
  const src = resolve(nodeModulesSrc, mod);
  const dest = resolve(nodeModulesDest, mod);
  if (existsSync(src) && !existsSync(dest)) {
    console.log(`Copying ${mod}...`);
    cpSync(src, dest, { recursive: true });
  }
}

console.log('SEA executable created:', exeFile);
console.log('Distribute the "out" folder with the executable');
