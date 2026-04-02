import { NotificationReadinessPanel } from './notification-readiness';

export default function SettingsPage() {
  return (
    <section className="stack settings-screen">
      <section className="card stack settings-card">
        <p className="eyebrow">App</p>
        <h1>Settings</h1>
        <p className="muted">
          Keep lightweight application preferences here without pushing
          product-shell settings into the reusable messaging core.
        </p>
      </section>

      <NotificationReadinessPanel />

      <section className="card stack settings-card">
        <p className="eyebrow">Push readiness</p>
        <h2 className="section-title">What this first pass prepares</h2>
        <p className="muted">
          The app now has a clean notifications surface, permission awareness,
          and service worker registration readiness. Live push delivery and
          subscription storage are intentionally still deferred.
        </p>
      </section>
    </section>
  );
}
