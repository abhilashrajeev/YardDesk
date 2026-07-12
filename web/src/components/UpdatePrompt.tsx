import { useRegisterSW } from 'virtual:pwa-register/react';

const CHECK_INTERVAL_MS = 60_000;

/**
 * Installed/standalone PWAs have no browser chrome — no address bar, no refresh
 * button, no pull-to-refresh — so there's no obvious way to pick up a new deploy.
 * This surfaces it explicitly instead of leaving people stuck on a stale build.
 *
 * A registered service worker only re-checks for an update on browser-driven
 * events (navigation, etc.) — an installed PWA left open in the background can
 * go a long time without one of those, so we also poll `registration.update()`
 * on a timer while the app is open.
 */
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => registration.update(), CHECK_INTERVAL_MS);
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 100,
        maxWidth: 420,
        margin: '0 auto',
        background: 'var(--side-1)',
        color: '#fff',
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--shadow-lg)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <span style={{ fontSize: 13.5 }}>A new version is available.</span>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          type="button"
          className="btn gray sm"
          onClick={() => setNeedRefresh(false)}
        >
          Later
        </button>
        <button
          type="button"
          className="btn gold sm"
          onClick={() => updateServiceWorker(true)}
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
