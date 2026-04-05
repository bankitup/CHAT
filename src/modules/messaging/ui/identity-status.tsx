type IdentityStatusRecord = {
  statusEmoji?: string | null;
  statusText?: string | null;
};

type IdentityStatusInlineProps = {
  className?: string;
  identity?: IdentityStatusRecord | null;
  statusEmoji?: string | null;
  statusText?: string | null;
};

function joinClassNames(values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function normalizeStatusPart(value: string | null | undefined) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function hasIdentityStatus(identity?: IdentityStatusRecord | null) {
  return Boolean(
    normalizeStatusPart(identity?.statusEmoji) ||
      normalizeStatusPart(identity?.statusText),
  );
}

export function IdentityStatusInline({
  className,
  identity,
  statusEmoji,
  statusText,
}: IdentityStatusInlineProps) {
  const normalizedEmoji =
    normalizeStatusPart(statusEmoji) ?? normalizeStatusPart(identity?.statusEmoji);
  const normalizedText =
    normalizeStatusPart(statusText) ?? normalizeStatusPart(identity?.statusText);

  if (!normalizedEmoji && !normalizedText) {
    return null;
  }

  return (
    <span className={joinClassNames(['identity-status-inline', className])}>
      {normalizedEmoji ? (
        <span aria-hidden="true" className="identity-status-emoji">
          {normalizedEmoji}
        </span>
      ) : null}
      {normalizedText ? (
        <span className="identity-status-text">{normalizedText}</span>
      ) : null}
    </span>
  );
}
