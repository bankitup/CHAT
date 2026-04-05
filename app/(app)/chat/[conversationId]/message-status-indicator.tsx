type MessageStatusIndicatorProps = {
  label: string;
  status: 'pending' | 'sent' | 'delivered' | 'seen';
};

export function MessageStatusIndicator({
  label,
  status,
}: MessageStatusIndicatorProps) {
  if (status === 'pending') {
    return (
      <span
        aria-label={label}
        className="message-status message-status-telegram message-status-telegram-pending"
      >
        <span aria-hidden="true" className="message-status-spinner" />
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  const isDoubleCheck = status === 'delivered' || status === 'seen';

  return (
    <span
      aria-label={label}
      className={`message-status message-status-telegram message-status-telegram-${status}`}
    >
      <span
        aria-hidden="true"
        className={
          isDoubleCheck
            ? 'message-status-checks message-status-checks-double'
            : 'message-status-checks'
        }
      >
        <span className="message-status-check">✓</span>
        {isDoubleCheck ? <span className="message-status-check">✓</span> : null}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
