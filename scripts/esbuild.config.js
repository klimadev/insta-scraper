const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  outfile: 'dist/index.js',
  format: 'cjs',
  target: 'node20',
  external: [
    'electron',
    'chromium-bidi'
  ],
  define: {
    'process.env.NODE_PATH': '""'
  },
  plugins: [{
    name: 'ignore-assets',
    setup(build) {
      build.onResolve({ filter: /\.(png|jpg|jpeg|gif|svg)$/ }, args => ({
        path: args.path,
        namespace: 'file'
      }));
      build.onLoad({ filter: /\.(png|jpg|jpeg|gif|svg)$/, namespace: 'file' }, () => ({
        contents: '',
        loader: 'file'
      }));
    }
  }]
}).then(() => {
  console.log('Build complete');
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
