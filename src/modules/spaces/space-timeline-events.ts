import 'server-only';

import type {
  KeepCozyOperationalObjectRef,
  KeepCozySpaceTimelineEvent,
  KeepCozySpaceTimelineEventRowDraft,
  KeepCozySpaceTimelineEventSummaryPayloadDraft,
} from './types';

export type SpaceTimelineEventWriteInput = {
  spaceId: string;
  conversationId?: string | null;
  messageId?: string | null;
  primaryOperationalObjectRef?: KeepCozyOperationalObjectRef | null;
  actorUserId?: string | null;
  eventType: KeepCozySpaceTimelineEvent['eventType'];
  sourceKind: KeepCozySpaceTimelineEvent['sourceKind'];
  occurredAt?: string;
  summaryPayload?: KeepCozySpaceTimelineEventSummaryPayloadDraft;
  createdAt?: string;
};

export type SpaceTimelineEventInsertRow = Omit<
  KeepCozySpaceTimelineEventRowDraft,
  'id' | 'created_at'
> & {
  id?: string;
  created_at?: string;
};

export const KEEP_COZY_SPACE_TIMELINE_EVENT_EMISSION_GUARDRAILS = [
  'Do not emit committed space timeline rows for ordinary message sends by default.',
  'Do not emit timeline rows for transient UI, transport, playback, or diagnostics state.',
  'Do not emit timeline rows before the underlying operational write has committed.',
  'Do not use the timeline helper as an access-policy engine.',
  'Do not mirror all chat activity into space history by default.',
] as const;

function getNowIsoString() {
  return new Date().toISOString();
}

function normalizeOptionalIdentifier(value: string | null | undefined) {
  const normalized = value?.trim() ?? '';
  return normalized.length > 0 ? normalized : null;
}

function parseTimestamp(value: string | null | undefined) {
  const normalized = normalizeOptionalIdentifier(value);

  if (!normalized) {
    return null;
  }

  const timestamp = Date.parse(normalized);

  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid timestamp: ${normalized}`);
  }

  return new Date(timestamp).toISOString();
}

function normalizeSummaryPayload(
  input: KeepCozySpaceTimelineEventSummaryPayloadDraft | undefined,
) {
  if (input === undefined) {
    return {} as KeepCozySpaceTimelineEventSummaryPayloadDraft;
  }

  if (input === null || Array.isArray(input) || typeof input !== 'object') {
    throw new Error(
      'Space timeline summary payload must be a plain object.',
    );
  }

  return input;
}

/**
 * Build the first-pass timeline event row payload from the logical contract
 * shape.
 *
 * This is intentionally a low-level helper only.
 *
 * Important:
 *
 * - it does not perform access checks
 * - it does not write to the database
 * - it does not decide whether an event is eligible for committed space
 *   history; later access-checked emitters must decide that first
 */
export function buildSpaceTimelineEventRow(
  input: SpaceTimelineEventWriteInput,
): SpaceTimelineEventInsertRow {
  const spaceId = normalizeOptionalIdentifier(input.spaceId);
  const occurredAt = parseTimestamp(input.occurredAt) ?? getNowIsoString();
  const createdAt = parseTimestamp(input.createdAt);
  const summaryPayload = normalizeSummaryPayload(input.summaryPayload);

  if (!spaceId) {
    throw new Error('Space timeline event requires spaceId.');
  }

  return {
    space_id: spaceId,
    conversation_id: normalizeOptionalIdentifier(input.conversationId),
    message_id: normalizeOptionalIdentifier(input.messageId),
    operational_object_type: input.primaryOperationalObjectRef?.kind ?? null,
    operational_object_id:
      normalizeOptionalIdentifier(input.primaryOperationalObjectRef?.id) ?? null,
    actor_user_id: normalizeOptionalIdentifier(input.actorUserId),
    event_type: input.eventType,
    source_kind: input.sourceKind,
    occurred_at: occurredAt,
    summary_payload: summaryPayload,
    created_at: createdAt ?? undefined,
  };
}
