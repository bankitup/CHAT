export type VisibilityMembershipRow = {
  conversation_id: string;
  hidden_at?: string | null;
};

export type VisibilityLookupRow = {
  conversation_id: string;
  hidden_at: string | null;
};

export function isHiddenAtVisibilityRuntimeError(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (!normalizedMessage.includes('hidden_at')) {
    return false;
  }

  return (
    normalizedMessage.includes('column') ||
    normalizedMessage.includes('field') ||
    normalizedMessage.includes('schema cache')
  );
}

export function applyConversationVisibility(
  rows: VisibilityMembershipRow[],
  archived: boolean,
  visibilityRows?: VisibilityLookupRow[] | null,
) {
  if (!visibilityRows) {
    return archived
      ? ([] as VisibilityMembershipRow[])
      : rows.map((row) => ({
          ...row,
          hidden_at: row.hidden_at ?? null,
        }));
  }

  const hiddenAtByConversationId = new Map(
    visibilityRows.map((row) => [row.conversation_id, row.hidden_at ?? null]),
  );

  return rows
    .filter((row) => {
      const hiddenAt = hiddenAtByConversationId.get(row.conversation_id) ?? null;
      return archived ? Boolean(hiddenAt) : !hiddenAt;
    })
    .map((row) => ({
      ...row,
      hidden_at: hiddenAtByConversationId.get(row.conversation_id) ?? null,
    }));
}
