import { cp, mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const root = process.cwd();
const wasmSource = resolve(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const wasmTarget = resolve(root, 'public/mediapipe/wasm');
const modelTarget = resolve(root, 'public/models/face_landmarker.task');
const modelUrl = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

async function exists(path) { try { await stat(path); return true; } catch { return false; } }

try {
  await mkdir(wasmTarget, { recursive: true });
  await cp(wasmSource, wasmTarget, { recursive: true, force: true });
  console.log('[DRISHTI] MediaPipe WASM copied to public/mediapipe/wasm');
} catch (error) {
  console.warn('[DRISHTI] Could not copy MediaPipe WASM; runtime CDN fallback remains enabled.', error?.message || error);
}

try {
  if (!(await exists(modelTarget))) {
    await mkdir(dirname(modelTarget), { recursive: true });
    const response = await fetch(modelUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    await writeFile(modelTarget, bytes);
    console.log(`[DRISHTI] Face landmarker model cached locally (${Math.round(bytes.byteLength / 1024)} KiB)`);
  }
} catch (error) {
  console.warn('[DRISHTI] Could not cache face-landmarker model; runtime Google model fallback remains enabled.', error?.message || error);
}
