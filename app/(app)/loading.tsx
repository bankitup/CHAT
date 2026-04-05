export default function AppLoading() {
  return (
    <section className="stack route-loading-screen" aria-label="Loading">
      <section className="card route-loading-hero">
        <div className="route-loading-line route-loading-line-title" />
        <div className="route-loading-line route-loading-line-subtitle" />
      </section>

      <section className="stack route-loading-list">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="card route-loading-row">
            <div className="route-loading-avatar" />
            <div className="stack route-loading-copy">
              <div className="route-loading-line route-loading-line-row-title" />
              <div className="route-loading-line route-loading-line-row-body" />
            </div>
          </div>
        ))}
      </section>
    </section>
  );
}
