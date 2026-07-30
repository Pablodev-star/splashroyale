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
 * The third attempt inlined everything into one self-contained `index.html`.
 * That looked like it worked, and the blank page kept coming back anyway.
 *
 * ## The misdiagnosis, since it cost three deploys
 *
 * A watchdog probe reported `Module script size in DOM: 0 characters`, which
 * was read as "the engine received a 945 kB inline script and discarded its
 * contents" — an inline size limit. That was wrong. The probe measured
 * `el.textContent.length` without checking `el.src`, and for an *external*
 * script tag that is always 0. It was never evidence about inlining at all.
 *
 * A later probe, which reports the bundle URL instead, gave the real answer:
 *
 *     Bundle: /src/main.tsx  — FAILED TO LOAD
 *
 * `/src/main.tsx` is the dev entry. It appears in exactly one document: the
 * untransformed source template, which no build has ever produced. The device
 * was running a shell cached from when the site served the repository root,
 * asking for a file that has never been deployed — and every earlier report
 * fits that too, including "script tags on page: 2", which is what the source
 * template has. The failure was never about the bundle's shape. It was always
 * one stale document, and the app's own cache hints cannot evict it: meta
 * `Cache-Control` is not a real caching directive, and Pages serves static
 * files with no way to set response headers.
 *
 * ## What this does, and why it is still the right shape
 *
 * The bundle is an external file with a **stable filename** — `app.js`, never
 * content-hashed — plus a `?v=` build hash on the reference.
 *
 * - A cached `index.html` of any vintage asks for `./app.js`, which always
 *   exists, so the hashed-asset 404 is impossible rather than unlikely.
 * - More importantly, a fixed name is what makes a broken shell *repairable*.
 *   The watchdog in index.html can name the bundle without knowing the build,
 *   so when a shell's own entry script 404s it injects the real one and the
 *   app boots. Content-hashed names would make that impossible: the stale
 *   document could not know what to ask for.
 * - The `?v=` hash busts HTTP caches on each deploy, and a stale query is
 *   harmless — a static server ignores it and serves the current file.
 *
 * Do not reintroduce hashed filenames, and do not re-inline the bundle: the
 * recovery path in index.html depends on `./app.js` being a real, fixed URL
 * sitting next to whatever shell the browser happens to hold. CI enforces
 * both, and that the watchdog's name for the bundle still matches this one.
 *
 * ## Why app.js and app.css are also committed at the repository root
 *
 * Pages' source is "Deploy from a branch", which the GitHub API confirms
 * (`build_type: legacy`). That means every push publishes the site twice: a
 * legacy build of the *repository root*, and this workflow's `dist/`. The last
 * one to finish wins, so one commit serves a working game or a blank page
 * depending on a race — the whole bug, and the reason four fixes each seemed
 * to work for a while.
 *
 * The setting lives outside the repository, so the repository is made to work
 * under either publisher: the built bundle is committed at the root, where a
 * legacy build serves it. The root `index.html` there is this source template,
 * so its own entry (`/src/main.tsx`) fails — 404 on the real site, MIME
 * rejection where the file is served — and the watchdog injects `./app.js`,
 * which is now present. Verified by serving only git-tracked root files: boots
 * in ~0.5s, fully playable.
 *
 * This is scaffolding around a misconfiguration, not a design. Once Pages'
 * source is "GitHub Actions", `app.js`, `app.css` and `.nojekyll` can all be
 * deleted from the root; the deploy says so when it sees the setting fixed.
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
