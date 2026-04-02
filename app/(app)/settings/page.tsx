export default function SettingsPage() {
  return (
    <section className="card stack">
      <p className="eyebrow">App</p>
      <h1>Settings</h1>
      <p className="muted">
        This authenticated placeholder is reserved for account and application
        settings that belong to the web shell.
      </p>
      <p className="muted">
        Product-specific configuration can grow here without leaking into the
        reusable messaging core.
      </p>
    </section>
  );
}
