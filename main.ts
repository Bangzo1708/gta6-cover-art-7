// Neon Coast Cover Studio — a gta6-cover-art-01 entry (Node 22, standard library
// only). The app is this directory's app/ folder: plain static files a desktop
// browser loads offline (app/index.html and its ES modules, two OFL fonts under
// app/fonts/, four AI-made sample photos under app/samples/, no network request).
// The program hands it in: it copies app/ and screenshots/ from beside this file
// to /output and writes /output/dossier.json with the vendored make.fun library.
//
// The output directory itself is NOT this program's to remove. In the grader
// /output is a mount point owned by root and this program runs as an
// unprivileged user, so deleting it fails with EPERM (that is what killed the
// previous round's grade run). This program therefore only creates the
// directory if it is missing, and clears just the three entries it owns inside
// it — app/, screenshots/ and dossier.json — before writing them fresh.
// It never calls rmSync on the output directory itself.
//
// Serve it locally with a static server over app/, then open index.html.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Create the output directory when it is missing; never remove it.
mkdirSync(out, { recursive: true });

// Clear only the three entries this program owns inside the output directory,
// so a second run over the same directory writes exactly the same bytes.
for (const owned of ['app', 'screenshots', 'dossier.json']) {
  rmSync(join(out, owned), { recursive: true, force: true });
}
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of app
// files, in all, or a path under app/ over 1000 bytes: app/ counts beside
// /output's own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);

// Confirm the handover landed: count what was written and say so on one line,
// so a grade log shows the program finished instead of failing silently.
function countFiles(dir) {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    n += entry.isDirectory() ? countFiles(join(dir, entry.name)) : 1;
  }
  return n;
}
const appFiles = countFiles(join(out, 'app'));
const shotFiles = readdirSync(join(out, 'screenshots')).length;
const dossierBytes = statSync(join(out, 'dossier.json')).size;
console.log(`neon-coast: wrote app/ (${appFiles} files), screenshots/ (${shotFiles} files), dossier.json (${dossierBytes} bytes) to ${out}`);
