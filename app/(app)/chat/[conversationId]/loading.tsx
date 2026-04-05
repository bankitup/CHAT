export default function ChatConversationLoading() {
  return (
    <section className="stack chat-screen route-loading-chat" aria-label="Loading chat">
      <section className="stack chat-header-stack">
        <div className="back-arrow-link conversation-back route-loading-button" />
        <section className="card chat-header-card route-loading-chat-header">
          <div className="route-loading-avatar route-loading-avatar-lg" />
          <div className="stack route-loading-copy route-loading-chat-copy">
            <div className="route-loading-line route-loading-line-row-title" />
            <div className="route-loading-line route-loading-line-row-body" />
          </div>
        </section>
      </section>

      <section className="chat-main">
        <section className="message-thread route-loading-chat-thread">
          <div className="message-day-separator">
            <span className="message-day-label route-loading-pill" />
          </div>
          <div className="message-row">
            <div className="message-card">
              <div className="message-bubble route-loading-bubble route-loading-bubble-wide" />
            </div>
          </div>
          <div className="message-row message-row-own">
            <div className="message-card message-card-own">
              <div className="message-bubble message-bubble-own route-loading-bubble route-loading-bubble-own" />
            </div>
          </div>
          <div className="message-row">
            <div className="message-card">
              <div className="message-bubble route-loading-bubble route-loading-bubble-mid" />
            </div>
          </div>
        </section>

        <section className="stack composer-card">
          <div className="composer-input-shell route-loading-composer">
            <div className="attachment-trigger route-loading-button-sm" />
            <div className="route-loading-line route-loading-line-input" />
            <div className="composer-action-cluster">
              <div className="composer-button composer-button-mic route-loading-button-sm" />
              <div className="composer-button composer-button-icon route-loading-button-sm" />
            </div>
          </div>
        </section>
      </section>
    </section>
  );
}
