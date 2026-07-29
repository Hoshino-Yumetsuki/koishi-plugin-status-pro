import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { container, image, text as textNode } from '@takumi-rs/helpers';
import { Renderer, initSync } from '@takumi-rs/wasm';
import type { SystemInfo } from '../neko/utils';

const CANVAS_W = 963;
const CANVAS_H = 1872;
const CONTENT_X = 64;
const CONTENT_RIGHT = CANVAS_W - 64;
const TITLE_Y = 636;
const DASHBOARD_TEXT_X = CONTENT_X + 132;
const INFO_VALUE_X = CONTENT_X + 215;
const INFO_ROW_HEIGHT = 72;
const MAIN_COLOR = '#54adff';
const INFO_COLOR = '#b7a89e';
const DASHBOARD_COLORS = [MAIN_COLOR, '#ffb3cc', '#fcaa93', '#b7a89e'] as const;

let wasmInitialized = false;
let fontsPromise: Promise<Uint8Array[]> | null = null;

export async function renderStatusImage(systemInfo: SystemInfo): Promise<Buffer> {
  ensureWasmInit();

  const renderer = new Renderer({
    fonts: await loadFonts()
  });

  const children = [];
  const background = await readAsset('image', 'neko.png');
  const marker = await readAsset('image', 'marker.png');
  renderer.putPersistentImage({ src: 'background', data: background });
  renderer.putPersistentImage({ src: 'marker', data: marker });

  children.push(
    image({
      src: 'background',
      style: { position: 'absolute', left: 0, top: 0, width: CANVAS_W, height: CANVAS_H }
    })
  );

  children.push(
    container({
      style: {
        position: 'absolute',
        left: CONTENT_X,
        top: TITLE_Y,
        width: CONTENT_RIGHT - CONTENT_X - 90,
        height: 62,
        overflow: 'hidden'
      },
      children: [
        textNode(ellipsize(systemInfo.name, CONTENT_RIGHT - CONTENT_X - 90, 50), {
          fontSize: 50,
          color: MAIN_COLOR,
          fontFamily: 'HachiMaruPop'
        })
      ]
    })
  );

  children.push(
    image({
      src: 'marker',
      style: {
        position: 'absolute',
        left: Math.min(
          CONTENT_X + estimateTextW(systemInfo.name, 50) + 20,
          CONTENT_RIGHT - 58
        ),
        top: TITLE_Y,
        height: 58
      }
    })
  );

  const dashboardY = TITLE_Y + 152;
  for (let index = 0; index < systemInfo.dashboard.length; index++) {
    const item = systemInfo.dashboard[index];
    const y = dashboardY + index * 152;
    const color = DASHBOARD_COLORS[index] ?? INFO_COLOR;
    const progress = Math.max(0, Math.min(1, item.progress));

    children.push(
      container({
        style: {
          position: 'absolute',
          left: CONTENT_X,
          top: y,
          width: 102,
          height: 102,
          borderRadius: 51,
          borderWidth: 12,
          borderColor: color
        }
      })
    );

    children.push(
      container({
        style: {
          position: 'absolute',
          left: CONTENT_X + 16,
          top: y + 45,
          width: 70 * progress,
          height: 12,
          backgroundColor: color,
          borderRadius: 6
        }
      })
    );

    children.push(
      container({
        style: {
          position: 'absolute',
          left: DASHBOARD_TEXT_X,
          top: y + 30,
          width: CONTENT_RIGHT - DASHBOARD_TEXT_X,
          height: 72,
          overflow: 'hidden'
        },
        children: [
          textNode(wrapText(item.title, CONTENT_RIGHT - DASHBOARD_TEXT_X, 45, 2), {
            fontSize: 45,
            color,
            fontFamily: 'Gugi'
          })
        ]
      })
    );
  }

  const informationY = dashboardY + systemInfo.dashboard.length * 152 + 75;
  for (let index = 0; index < systemInfo.information.length; index++) {
    const item = systemInfo.information[index];
    const y = informationY + index * INFO_ROW_HEIGHT;
    const valueWidth = CONTENT_RIGHT - INFO_VALUE_X;

    children.push(
      container({
        style: { position: 'absolute', left: CONTENT_X + 30, top: y },
        children: [textNode(item.key, { fontSize: 28, color: INFO_COLOR, fontFamily: 'Gugi' })]
      })
    );

    children.push(
      container({
        style: {
          position: 'absolute',
          left: INFO_VALUE_X,
          top: y,
          width: valueWidth,
          height: INFO_ROW_HEIGHT,
          overflow: 'hidden'
        },
        children: [
          textNode(wrapText(item.value, valueWidth, 28, 2), {
            fontSize: 28,
            color: INFO_COLOR,
            fontFamily: 'Gugi'
          })
        ]
      })
    );
  }

  children.push(
    container({
      style: {
        position: 'absolute',
        left: CONTENT_X + 360,
        top: informationY + systemInfo.information.length * INFO_ROW_HEIGHT + 24
      },
      children: [
        textNode(systemInfo.footer, { fontSize: 22, color: INFO_COLOR, fontFamily: 'HachiMaruPop' })
      ]
    })
  );

  const root = container({
    children,
    style: {
      position: 'relative',
      width: CANVAS_W,
      height: CANVAS_H,
      display: 'block',
      backgroundColor: '#ffffff'
    }
  });

  return Buffer.from(renderer.render(root, { width: CANVAS_W, height: CANVAS_H, format: 'png' }));
}

function ensureWasmInit(): void {
  if (wasmInitialized) return;

  const require = createRequire(import.meta.url);
  const wasmPath = require.resolve('@takumi-rs/wasm/takumi_wasm_bg.wasm');
  initSync({ module: readFileSync(wasmPath) });
  wasmInitialized = true;
}

async function loadFonts(): Promise<Uint8Array[]> {
  fontsPromise ??= Promise.all([
    readAsset('font', 'HachiMaruPop-Regular.ttf'),
    readAsset('font', 'Gugi-Regular.ttf')
  ]);
  return fontsPromise;
}

async function readAsset(...paths: string[]): Promise<Uint8Array> {
  return new Uint8Array(await readFile(join(assetRoot(), ...paths)));
}

function assetRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), 'assets');
}

function wrapText(str: string, maxWidth: number, fontSize: number, maxLines: number): string {
  const lines: string[] = [];
  let line = '';

  for (const word of str.split(/(\s+)/)) {
    if (estimateTextW(line + word, fontSize) <= maxWidth) {
      line += word;
      continue;
    }

    if (line) lines.push(line.trimEnd());
    line = '';
    for (const ch of word) {
      if (estimateTextW(line + ch, fontSize) > maxWidth && line) {
        lines.push(line);
        line = '';
      }
      line += ch;
    }
  }
  if (line) lines.push(line.trimEnd());

  if (lines.length <= maxLines) return lines.join('\n');
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = ellipsize(kept[maxLines - 1], maxWidth, fontSize);
  return kept.join('\n');
}

function ellipsize(str: string, maxWidth: number, fontSize: number): string {
  if (estimateTextW(str, fontSize) <= maxWidth) return str;

  let result = '';
  for (const ch of str) {
    if (estimateTextW(result + ch + '…', fontSize) > maxWidth) break;
    result += ch;
  }
  return result + '…';
}

function estimateTextW(str: string, fontSize: number): number {
  let width = 0;
  for (const ch of str) {
    width += ch.charCodeAt(0) > 255 ? fontSize : fontSize * 0.62;
  }
  return width;
}
