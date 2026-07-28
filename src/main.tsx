import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
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
// classic scripts are. A synchronous throw from this render call would be
// exactly the kind of error that could go unheard that way. Catching it here
// and stashing it on `window` gives the watchdog a second channel that does
// not depend on the browser's event dispatch at all.
try {
  const container = document.getElementById('root');
  if (!container) throw new Error('Root element #root is missing from index.html');

  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (error) {
  (window as typeof window & { __SPLASH_BOOT_ERROR__?: unknown }).__SPLASH_BOOT_ERROR__ = error;
  throw error; // Still let it reach window.onerror on browsers where that works.
}
