import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { defineConfig } from 'rolldown';
import { dts } from 'rolldown-plugin-dts';
import pkg from './package.json' with { type: 'json' };

const external = new RegExp(
  `^(node:|${[
    ...Object.keys(pkg.peerDependencies ?? {}),
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {})
  ].join('|')})`
);

const config = {
  input: './src/index.ts'
};

const copyAssetsPlugin = {
  name: 'copy-assets',
  buildEnd() {
    copyDir('./src/assets', './lib/assets');
  }
};

function copyDir(src, dest) {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });

  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
      continue;
    }

    mkdirSync(dirname(destPath), { recursive: true });
    copyFileSync(srcPath, destPath);
  }
}

export default defineConfig([
  {
    ...config,
    output: [{ file: 'lib/index.mjs', format: 'es', minify: true }],
    external,
    plugins: [copyAssetsPlugin]
  },
  {
    ...config,
    output: [{ file: 'lib/index.cjs', format: 'cjs', minify: true }],
    external
  },
  {
    ...config,
    output: [{ dir: 'lib', format: 'es' }],
    external,
    plugins: [dts({ emitDtsOnly: true })]
  }
]);
