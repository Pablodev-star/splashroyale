import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import '@/index.css';

type BootWindow = typeof window & {
  __SPLASH_BOOT_ERROR__?: unknown;
  __SPLASH_BOOT_STAGE__?: string;
};

// Marks that this module actually started executing, separately from
// whether it later threw. If a future report ever shows this was never set,
// the module script itself didn't run at all (parse failure, something
// stripping it before it reached the engine) — a different failure than
// anything below, and no try/catch anywhere in this file could have caught
// it, since execution never reached this file's own code.
(window as BootWindow).__SPLASH_BOOT_STAGE__ = 'module-evaluating';

// Belt-and-suspenders for the blank-page watchdog in index.html.
//
// That watchdog relies on the `error`/`unhandledrejection` window events, which
// is normally sufficient — but a real device reported the exact "app never
// mounted, no error captured" symptom this was built to catch, on iOS Safari,
// with the previously-known causes (stale multi-file cache, unescaped
// `</script>` truncation) both ruled out by inspecting the deployed build
// directly, and a second device (iPad) reproduced it again after that fix
// shipped. Two real gaps remain:
//
// 1. WebKit has a documented history of not reliably reporting module-script
//    errors through those events the way classic scripts are. ES modules
//    also evaluate all static imports to completion before any code in this
//    file runs, so a plain `import { App } from '@/App'` at the top would
//    put the entire render tree outside any try/catch this file could
//    write. Routing it through a dynamic import instead defers that
//    evaluation into this promise chain, so a throw anywhere in App's
//    dependency graph lands in the catch below instead of escaping unseen
//    (verified against a minimal reproduction of this project's single-file
//    build: a dynamically-imported module that throws at the top level
//    surfaces as a catchable rejection here, not an uncaught exception).
//
// 2. React's concurrent root doesn't commit the initial render synchronously
//    on its own — it schedules the work through the `Scheduler` package,
//    which yields back to the browser between units via `MessageChannel`
//    (falling back to `setTimeout`). If that hand-off never fires — which
//    can happen depending on how a page is embedded or throttled — #root
//    stays empty forever with nothing thrown and nothing to catch: exactly
//    this symptom, and invisible to both mechanisms above since nothing
//    actually failed, it's just perpetually pending. `flushSync` forces the
//    one-time boot commit through synchronously instead of trusting that
//    hand-off, at the cost flushSync normally warns against, which is worth
//    paying exactly once here.
async function boot() {
  (window as BootWindow).__SPLASH_BOOT_STAGE__ = 'boot-started';
  try {
    const container = document.getElementById('root');
    if (!container) throw new Error('Root element #root is missing from index.html');

    (window as BootWindow).__SPLASH_BOOT_STAGE__ = 'importing-app';
    const { App } = await import('@/App');

    (window as BootWindow).__SPLASH_BOOT_STAGE__ = 'rendering';
    flushSync(() => {
      createRoot(container).render(
        <StrictMode>
          <App />
        </StrictMode>,
      );
    });
    (window as BootWindow).__SPLASH_BOOT_STAGE__ = 'rendered';
  } catch (error) {
    (window as BootWindow).__SPLASH_BOOT_ERROR__ = error;
    (window as BootWindow).__SPLASH_BOOT_STAGE__ = 'errored';
    throw error; // Still let it reach window.onerror/unhandledrejection where that works.
  }
}

void boot();
