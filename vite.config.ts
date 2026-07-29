import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Relative base so the static build works both locally and under the GitHub
 * Pages project sub-path (/<repo>/) without extra configuration.
 *
 * ## The blank page, and why the build is shaped this way
 *
 * The original failure: Vite content-hashes asset filenames, and each Pages
 * deploy replaces the previous build's files outright, so a browser holding a
 * cached `index.html` from an earlier deploy requested JS and CSS that no
 * longer existed. Both 404'd, nothing ran, and the page rendered plain white
 * with no error anywhere.
 *
 * Two attempts at that did not hold: `Cache-Control` meta tags (not honoured
 * as real caching directives, and Pages serves static files with no way to set
 * response headers) and copying the previous deploy's assets forward in CI
 * (the fetch failed silently on the runner and preserved nothing).
 *
 * The third attempt inlined everything into one self-contained `index.html`,
 * which did fix it — there are no cross-file versions to mismatch when there
 * is only one file. **It then created a second blank page of its own**, which
 * is what this configuration exists to answer.
 *
 * As the game grew, so did that single inline `<script>`: ~890 kB when the
 * page last worked, ~945 kB when it broke. A device reported the app dead
 * again, and the watchdog's diagnostic said something very specific:
 *
 *     Module script size in DOM: 0 characters
 *     Script tags on page: 2
 *
 * The script *element* existed and was empty. The watchdog that printed that
 * lives at the very end of the document — byte ~1,006,000 of ~1,014,000 — and
 * it ran, so the browser had received the whole file. A complete document,
 * both script tags parsed, and the 945 kB of program between them discarded.
 * That is an engine limit on how much text one inline script may hold, and no
 * amount of inlining discipline gets around it: the file only grows.
 *
 * ## What this does instead
 *
 * The bundle goes back to being an external file, but with a **stable
 * filename** — `app.js`, never content-hashed — plus a `?v=` build hash on the
 * reference. That fixes both failures at once:
 *
 * - Nothing is inlined, so no script element is anywhere near an engine limit.
 * - A cached `index.html` from any earlier deploy asks for `./app.js`, which
 *   always exists, because the name never changes. The 404 that caused the
 *   original blank page is now impossible rather than merely unlikely.
 * - The `?v=` hash still busts HTTP caches on every deploy, and a stale query
 *   is harmless: a static server ignores it and serves the current file.
 *
 * The one thing lost is the "whatever HTML you have is a whole working app"
 * guarantee. What replaces it is weaker but sufficient: whatever HTML you
 * have, the file it asks for is there. A cached shell paired with a newer
 * `app.js` still boots, because the shell is a `<div id="root">` and two
 * script tags — it carries no version-specific contract with the bundle.
 */

/** Stable asset names. The whole fix rests on these never being hashed. */
const ENTRY_JS = 'app.js';
const ENTRY_CSS = 'app.css';

/**
 * Stamps `?v=<hash>` onto the bundle references in the built HTML.
 *
 * Runs in `writeBundle`, once the real files are on disk, so the hash is of
 * the bytes actually shipped rather than of an intermediate Rollup chunk.
 */
function versionAssets() {
  return {
    name: 'version-assets',
    writeBundle(options: { dir?: string }) {
      const dir = options.dir ?? 'dist';
      const htmlPath = `${dir}/index.html`;
      let html = readFileSync(htmlPath, 'utf-8');

      for (const asset of [ENTRY_JS, ENTRY_CSS]) {
        let contents: Buffer;
        try {
          contents = readFileSync(`${dir}/${asset}`);
        } catch {
          continue; // No CSS emitted, say — nothing to stamp.
        }
        const hash = createHash('sha256').update(contents).digest('hex').slice(0, 10);
        // Only the exact unversioned reference, so re-running is a no-op.
        html = html.replaceAll(`./${asset}"`, `./${asset}?v=${hash}"`);
      }

      writeFileSync(htmlPath, html);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), versionAssets()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // One CSS file rather than per-chunk sheets, so there is a single stable
    // name to reference.
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        // `main.tsx` reaches the app through a dynamic import, which is what
        // lets a top-level throw anywhere in the tree be caught and reported.
        // Left alone that would emit a second, content-hashed chunk — exactly
        // the hashed-filename 404 this is built to avoid — so the graph is
        // folded into the one entry. Rollup still wraps the dynamically
        // imported module in a deferred thunk, so the error boundary survives.
        inlineDynamicImports: true,
        entryFileNames: ENTRY_JS,
        assetFileNames: (info) =>
          info.names?.some((name) => name.endsWith('.css')) ? ENTRY_CSS : '[name][extname]',
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
