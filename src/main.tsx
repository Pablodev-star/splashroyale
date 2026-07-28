import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';

// Belt-and-suspenders for the blank-page watchdog in index.html.
//
// That watchdog relies on the `error`/`unhandledrejection` window events, which
// is normally sufficient — but a real device reported the exact "app never
// mounted, no error captured" symptom this was built to catch, on iOS Safari,
// with the previously-known causes (stale multi-file cache, unescaped
// `</script>` truncation) both ruled out by inspecting the deployed build
// directly. One real gap remains: WebKit has a documented history of not
// reliably reporting module-script errors through those events the way
// classic scripts are. A synchronous throw during module evaluation would be
// exactly the kind of error that could go unheard that way — and ES modules
// evaluate all static imports to completion before any code in this file
// runs, so a plain `import { App } from '@/App'` at the top would put the
// entire render tree outside any try/catch this file could write. Routing it
// through a dynamic import instead defers that evaluation into this promise
// chain, so a throw anywhere in App's dependency graph lands in the catch
// below instead of escaping unseen (verified against a minimal reproduction
// of this project's single-file build: a dynamically-imported module that
// throws at the top level surfaces as a catchable rejection here, not an
// uncaught exception).
async function boot() {
  try {
    const container = document.getElementById('root');
    if (!container) throw new Error('Root element #root is missing from index.html');

    const { App } = await import('@/App');

    createRoot(container).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (error) {
    (window as typeof window & { __SPLASH_BOOT_ERROR__?: unknown }).__SPLASH_BOOT_ERROR__ = error;
    throw error; // Still let it reach window.onerror/unhandledrejection where that works.
  }
}

void boot();
