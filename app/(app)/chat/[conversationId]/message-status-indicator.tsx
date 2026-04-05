type MessageStatusIndicatorProps = {
  label: string;
  status: 'pending' | 'sent' | 'delivered' | 'seen' | null | undefined | string;
};

function normalizeMessageStatus(
  status: MessageStatusIndicatorProps['status'],
) {
  if (status === 'pending') {
    return 'pending' as const;
  }

  if (status === 'delivered' || status === 'seen') {
    return status;
  }

  return 'sent' as const;
}

export function MessageStatusIndicator({
  label,
  status,
}: MessageStatusIndicatorProps) {
  if (
    process.env.NEXT_PUBLIC_CHAT_DEBUG_MESSAGE_STATUS === '1' &&
    status !== null &&
    status !== undefined &&
    status !== 'pending' &&
    status !== 'sent' &&
    status !== 'delivered' &&
    status !== 'seen'
  ) {
    console.info('[message-status]', 'fallback:invalid-status-prop', {
      label,
      rawStatus: status,
      resolvedStatus: 'sent',
    });
  }

  const normalizedStatus = normalizeMessageStatus(status);

  if (normalizedStatus === 'pending') {
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

  const isDoubleCheck =
    normalizedStatus === 'delivered' || normalizedStatus === 'seen';

  return (
    <span
      aria-label={label}
      className={`message-status message-status-telegram message-status-telegram-${normalizedStatus}`}
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
