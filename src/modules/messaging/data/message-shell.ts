export type MessageInsertPayloadInput = {
  messageId: string;
  conversationId: string;
  senderId: string;
  replyToMessageId?: string | null;
  kind?: 'text' | 'attachment' | 'voice';
  clientId: string;
  body?: string | null;
  contentMode?: 'plaintext' | 'dm_e2ee_v1';
  senderDeviceId?: string | null;
};

export function buildMessageInsertPayload(input: MessageInsertPayloadInput) {
  const payload: Record<string, unknown> = {
    id: input.messageId,
    conversation_id: input.conversationId,
    sender_id: input.senderId,
    reply_to_message_id: input.replyToMessageId ?? null,
    kind: input.kind ?? 'text',
    client_id: input.clientId,
    body:
      input.contentMode === 'dm_e2ee_v1'
        ? null
        : input.body?.trim() || null,
  };

  if (input.senderDeviceId) {
    payload.sender_device_id = input.senderDeviceId;
  }

  if (input.contentMode) {
    payload.content_mode = input.contentMode;
  }

  return payload;
}
