type IdentityLabelRecord = {
  displayName?: string | null;
  username?: string | null;
  email?: string | null;
  emailLocalPart?: string | null;
};

function trimOrNull(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';
  return trimmed || null;
}

function getEmailLocalPart(value: string | null | undefined) {
  const email = trimOrNull(value);

  if (!email || !email.includes('@')) {
    return null;
  }

  const [localPart] = email.split('@');
  return trimOrNull(localPart);
}

export function resolvePublicIdentityLabel(
  identity: IdentityLabelRecord | null | undefined,
  unknownUserLabel: string,
) {
  return (
    trimOrNull(identity?.displayName) ||
    trimOrNull(identity?.username) ||
    trimOrNull(identity?.emailLocalPart) ||
    getEmailLocalPart(identity?.email) ||
    trimOrNull(unknownUserLabel) ||
    'Unknown user'
  );
}

export function getIdentityLabel(
  identity: IdentityLabelRecord | null | undefined,
  fallbackLabel: string,
) {
  return resolvePublicIdentityLabel(identity, fallbackLabel);
}
