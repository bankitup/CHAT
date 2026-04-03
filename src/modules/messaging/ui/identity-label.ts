type IdentityLabelRecord = {
  displayName: string | null;
};

export function getIdentityLabel(
  identity: IdentityLabelRecord | null | undefined,
  fallbackLabel: string,
) {
  return identity?.displayName?.trim() || fallbackLabel;
}
