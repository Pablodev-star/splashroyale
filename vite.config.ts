import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Relative base so the static build works both locally and under the GitHub
 * Pages project sub-path (/<repo>/) without extra configuration.
 *
 * The build is inlined into a single `index.html` (`viteSingleFile`) to kill a
 * recurring blank-page failure for good. Vite content-hashes asset filenames and
 * each Pages deploy replaces the previous build's files outright, so a browser
 * holding a cached `index.html` from an earlier deploy requested JS/CSS that no
 * longer existed. Both 404'd, nothing ran, and the page rendered plain white
 * with no error anywhere — indistinguishable from the site being down.
 *
 * Two earlier attempts did not hold: `Cache-Control` meta tags (not honoured as
 * real caching directives, and Pages serves static files with no way to set
 * response headers) and copying the previous deploy's assets forward in CI (the
 * fetch failed silently on the runner and preserved nothing). With one
 * self-contained file there are no cross-file versions to mismatch: whatever
 * HTML a browser has, cached or fresh, is a complete working app.
 *
 * The trade is losing separately-cacheable JS/CSS — every change re-downloads
 * the whole bundle (~100 kB gzipped). For a static game that size, worth it.
 */
/**
 * Vite always emits `crossorigin` on the entry `<script type="module">`,
 * meaningful only for a script fetched from a `src` URL. Once viteSingleFile
 * inlines that entry's code directly into the tag, the attribute is left on
 * a script with no URL for cross-origin semantics to apply to — a
 * combination the spec leaves undefined and that testing here can't rule out
 * as a WebKit-specific quirk, since only a Chromium engine is available in
 * this environment. Strip it so the shipped tag is unambiguous: a plain
 * inline module script, nothing more.
 */
function stripInlineModuleCrossorigin() {
  return {
    name: 'strip-inline-module-crossorigin',
    // viteSingleFile does its inlining in generateBundle, after
    // transformIndexHtml has already run and baked in `src="..."` — the
    // attribute only becomes dangling once that src disappears. writeBundle
    // runs once the final HTML has been written to disk, so this rewrites
    // the actual shipped file rather than an intermediate one.
    writeBundle(options: { dir?: string }) {
      const dir = options.dir ?? 'dist';
      const htmlPath = `${dir}/index.html`;
      const html = readFileSync(htmlPath, 'utf-8');
      const stripped = html.replace(/<script type="module" crossorigin>/g, '<script type="module">');
      if (stripped !== html) writeFileSync(htmlPath, stripped);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), viteSingleFile(), stripInlineModuleCrossorigin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
