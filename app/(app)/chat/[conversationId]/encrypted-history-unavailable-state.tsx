type EncryptedHistoryUnavailableStateProps = {
  accessState:
    | 'history-unavailable-on-this-device'
    | 'policy-blocked'
    | 'readable'
    | 'temporary-local-read-failure';
  compact: boolean;
  continuationCount?: number;
  debugBucket?: string | null;
  diagnostic?: string | null;
  debugLabel?: string | null;
  historyState?: string | null;
  note?: string | null;
  title: string;
};

export function EncryptedHistoryUnavailableState({
  accessState,
  compact,
  continuationCount = 0,
  debugBucket = null,
  diagnostic = null,
  debugLabel = null,
  historyState = 'present',
  note = null,
  title,
}: EncryptedHistoryUnavailableStateProps) {
  const isHistoricalUnavailable =
    accessState === 'history-unavailable-on-this-device' ||
    accessState === 'policy-blocked';

  return (
    <div
      className={
        compact
          ? 'message-encryption-state message-encryption-state-compact message-encryption-state-continuation'
          : 'message-encryption-state'
      }
      data-dm-e2ee-access-state={accessState}
      data-dm-e2ee-debug-bucket={debugBucket ?? undefined}
      data-dm-e2ee-diagnostic={diagnostic ?? undefined}
      data-dm-e2ee-history-state={historyState ?? undefined}
      title={compact && debugLabel ? debugLabel : undefined}
    >
      <div
        className={
          continuationCount > 0 ? 'message-encryption-title-row' : undefined
        }
      >
        <p
          className={
            isHistoricalUnavailable
              ? compact
                ? 'message-encryption-title message-encryption-title-compact'
                : 'message-encryption-title'
              : 'message-body'
          }
        >
          {title}
        </p>
        {continuationCount > 0 ? (
          <span className="message-encryption-count-pill">
            +{continuationCount}
          </span>
        ) : null}
      </div>
      {note && !compact ? <p className="message-encryption-note">{note}</p> : null}
      {debugLabel && !compact ? (
        <p className="message-encryption-debug-label">{debugLabel}</p>
      ) : null}
    </div>
  );
}
