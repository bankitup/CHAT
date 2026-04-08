import 'server-only';

import { getRequestSupabaseServerClient } from '@/lib/request-context/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  KeepCozyOperationalObjectRef,
  KeepCozyThreadCompanionMetadata,
  KeepCozyThreadCompanionMetadataRowDraft,
} from '@/modules/spaces/types';
import {
  KEEP_COZY_THREAD_COMPANION_METADATA_DEFAULTS_DRAFT,
  KEEP_COZY_THREAD_COMPANION_METADATA_TABLE_NAME_DRAFT,
} from '@/modules/spaces/types';

type ConversationCompanionMetadataClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

const CONVERSATION_COMPANION_METADATA_SELECT =
  'conversation_id, space_id, thread_type, audience_mode, status, operational_object_type, operational_object_id, thread_owner_user_id, operator_visible_by_policy, external_access_requires_assignment, opened_at, closed_at, visibility_scope_notes, created_at, updated_at';

export type ConversationCompanionMetadataWriteInput = {
  conversationId: string;
  spaceId: string;
  threadType: KeepCozyThreadCompanionMetadata['threadType'];
  audienceMode: KeepCozyThreadCompanionMetadata['audienceMode'];
  status?: KeepCozyThreadCompanionMetadata['status'];
  primaryOperationalObjectRef?: KeepCozyOperationalObjectRef | null;
  threadOwnerUserId?: string | null;
  operatorVisibleByPolicy?: boolean;
  externalAccessRequiresAssignment?: boolean;
  openedAt?: string | null;
  closedAt?: string | null;
  visibilityScopeNotes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ConversationCompanionMetadataUpsertRow = Omit<
  KeepCozyThreadCompanionMetadataRowDraft,
  'created_at' | 'updated_at'
> & {
  created_at?: string;
  updated_at?: string;
};

function getNowIsoString() {
  return new Date().toISOString();
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim() ?? '';
  return normalized.length > 0 ? normalized : null;
}

function parseOptionalTimestamp(value: string | null | undefined) {
  const normalized = normalizeOptionalText(value);

  if (!normalized) {
    return null;
  }

  const timestamp = Date.parse(normalized);

  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid timestamp: ${normalized}`);
  }

  return new Date(timestamp).toISOString();
}

function isMissingRelationErrorMessage(message: string, relationName: string) {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes('relation') &&
    normalizedMessage.includes(relationName.toLowerCase())
  );
}

export function isConversationCompanionMetadataSchemaCacheErrorMessage(
  message: string,
) {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes(
      KEEP_COZY_THREAD_COMPANION_METADATA_TABLE_NAME_DRAFT.toLowerCase(),
    ) &&
    (normalizedMessage.includes('schema cache') ||
      normalizedMessage.includes('could not find the table') ||
      normalizedMessage.includes('relation') ||
      normalizedMessage.includes('column'))
  );
}

function createConversationCompanionMetadataSchemaRequirementError(
  details: string,
) {
  return new Error(
    `${details} Apply /Users/danya/IOS - Apps/CHAT/docs/sql/2026-04-07-conversation-companion-metadata-foundation.sql first.`,
  );
}

function normalizeConversationCompanionMetadataRowDraft(
  row: KeepCozyThreadCompanionMetadataRowDraft,
): KeepCozyThreadCompanionMetadata {
  const operationalObjectType = row.operational_object_type;
  const operationalObjectId = normalizeOptionalText(row.operational_object_id);

  return {
    conversationId: row.conversation_id,
    spaceId: row.space_id,
    threadType: row.thread_type,
    audienceMode: row.audience_mode,
    status: row.status,
    primaryOperationalObjectRef:
      operationalObjectType && operationalObjectId
        ? {
            kind: operationalObjectType,
            id: operationalObjectId,
          }
        : null,
    threadOwnerUserId: normalizeOptionalText(row.thread_owner_user_id),
    operatorVisibleByPolicy:
      row.operator_visible_by_policy ??
      KEEP_COZY_THREAD_COMPANION_METADATA_DEFAULTS_DRAFT.operator_visible_by_policy,
    externalAccessRequiresAssignment:
      row.external_access_requires_assignment ??
      KEEP_COZY_THREAD_COMPANION_METADATA_DEFAULTS_DRAFT.external_access_requires_assignment,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    visibilityScopeNotes: normalizeOptionalText(row.visibility_scope_notes),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Build the first-pass companion metadata row payload from the logical
 * contract shape.
 *
 * This is a low-level helper only. It does not perform conversation access
 * checks or verify that a referenced operational object exists yet.
 */
export function buildConversationCompanionMetadataRow(
  input: ConversationCompanionMetadataWriteInput,
): ConversationCompanionMetadataUpsertRow {
  const conversationId = normalizeOptionalText(input.conversationId);
  const spaceId = normalizeOptionalText(input.spaceId);
  const openedAt = parseOptionalTimestamp(input.openedAt);
  const closedAt = parseOptionalTimestamp(input.closedAt);
  const status =
    input.status ?? KEEP_COZY_THREAD_COMPANION_METADATA_DEFAULTS_DRAFT.status;
  const createdAt = parseOptionalTimestamp(input.createdAt);
  const updatedAt = parseOptionalTimestamp(input.updatedAt) ?? getNowIsoString();

  if (!conversationId) {
    throw new Error('Conversation companion metadata requires conversationId.');
  }

  if (!spaceId) {
    throw new Error('Conversation companion metadata requires spaceId.');
  }

  if (
    closedAt &&
    status !== 'resolved' &&
    status !== 'closed'
  ) {
    throw new Error(
      'Conversation companion metadata closedAt requires status resolved or closed.',
    );
  }

  if (openedAt && closedAt && Date.parse(openedAt) > Date.parse(closedAt)) {
    throw new Error(
      'Conversation companion metadata openedAt must be less than or equal to closedAt.',
    );
  }

  return {
    conversation_id: conversationId,
    space_id: spaceId,
    thread_type: input.threadType,
    audience_mode: input.audienceMode,
    status,
    operational_object_type:
      input.primaryOperationalObjectRef?.kind ?? null,
    operational_object_id:
      normalizeOptionalText(input.primaryOperationalObjectRef?.id) ?? null,
    thread_owner_user_id: normalizeOptionalText(input.threadOwnerUserId),
    operator_visible_by_policy:
      input.operatorVisibleByPolicy ??
      KEEP_COZY_THREAD_COMPANION_METADATA_DEFAULTS_DRAFT.operator_visible_by_policy,
    external_access_requires_assignment:
      input.externalAccessRequiresAssignment ??
      KEEP_COZY_THREAD_COMPANION_METADATA_DEFAULTS_DRAFT.external_access_requires_assignment,
    opened_at: openedAt,
    closed_at: closedAt,
    visibility_scope_notes: normalizeOptionalText(input.visibilityScopeNotes),
    created_at: createdAt ?? undefined,
    updated_at: updatedAt,
  };
}

async function getConversationCompanionMetadataReadClient(
  client?: ConversationCompanionMetadataClient,
) {
  return client ?? (await createSupabaseServerClient());
}

async function getConversationCompanionMetadataWriteClient(
  client?: ConversationCompanionMetadataClient,
) {
  return client ?? (await getRequestSupabaseServerClient());
}

/**
 * Low-level row loader for future conversation-level metadata reads.
 *
 * Important:
 *
 * - this helper does not check whether the caller is allowed to see the
 *   conversation
 * - later access-checked wrappers should call this only after existing
 *   conversation visibility checks succeed
 * - later policy-aware wrappers may interpret audience/operator/assignment
 *   inputs, but that interpretation must stay outside this raw table adapter
 */
export async function getConversationCompanionMetadataByConversationIdsWithoutAccessCheck(
  input: {
    conversationIds: string[];
    client?: ConversationCompanionMetadataClient;
  },
) {
  const conversationIds = Array.from(
    new Set(input.conversationIds.map((value) => value.trim()).filter(Boolean)),
  );

  if (conversationIds.length === 0) {
    return new Map<string, KeepCozyThreadCompanionMetadata>();
  }

  const client = await getConversationCompanionMetadataReadClient(input.client);
  const { data, error } = await client
    .from(KEEP_COZY_THREAD_COMPANION_METADATA_TABLE_NAME_DRAFT)
    .select(CONVERSATION_COMPANION_METADATA_SELECT)
    .in('conversation_id', conversationIds);

  if (error) {
    if (
      isMissingRelationErrorMessage(
        error.message,
        KEEP_COZY_THREAD_COMPANION_METADATA_TABLE_NAME_DRAFT,
      ) ||
      isConversationCompanionMetadataSchemaCacheErrorMessage(error.message)
    ) {
      throw createConversationCompanionMetadataSchemaRequirementError(
        'Conversation companion metadata reads require the additive companion metadata schema.',
      );
    }

    throw new Error(error.message);
  }

  const rows = (data ?? []) as KeepCozyThreadCompanionMetadataRowDraft[];

  return new Map(
    rows.map((row) => [
      row.conversation_id,
      normalizeConversationCompanionMetadataRowDraft(row),
    ]),
  );
}

export async function getConversationCompanionMetadataWithoutAccessCheck(input: {
  conversationId: string;
  client?: ConversationCompanionMetadataClient;
}) {
  const normalizedConversationId = input.conversationId.trim();
  const metadataByConversationId =
    await getConversationCompanionMetadataByConversationIdsWithoutAccessCheck({
      conversationIds: [normalizedConversationId],
      client: input.client,
    });

  return metadataByConversationId.get(normalizedConversationId) ?? null;
}

/**
 * Low-level upsert helper for future operational-thread write flows.
 *
 * Important:
 *
 * - this helper does not check whether the caller is allowed to create or edit
 *   the conversation
 * - this helper does not verify that a referenced operational object already
 *   exists in a first-class domain table
 * - later access-checked wrappers should call this only after conversation
 *   ownership/visibility has already been validated
 * - later policy-aware wrappers must decide whether the write is allowed; this
 *   helper should stay a low-level persistence boundary only
 */
export async function upsertConversationCompanionMetadataWithoutAccessCheck(
  input: {
    metadata: ConversationCompanionMetadataWriteInput;
    client?: ConversationCompanionMetadataClient;
  },
) {
  const client = await getConversationCompanionMetadataWriteClient(input.client);
  const row = buildConversationCompanionMetadataRow(input.metadata);
  const { data, error } = await client
    .from(KEEP_COZY_THREAD_COMPANION_METADATA_TABLE_NAME_DRAFT)
    .upsert(row, {
      onConflict: 'conversation_id',
    })
    .select(CONVERSATION_COMPANION_METADATA_SELECT)
    .single();

  if (error) {
    if (
      isMissingRelationErrorMessage(
        error.message,
        KEEP_COZY_THREAD_COMPANION_METADATA_TABLE_NAME_DRAFT,
      ) ||
      isConversationCompanionMetadataSchemaCacheErrorMessage(error.message)
    ) {
      throw createConversationCompanionMetadataSchemaRequirementError(
        'Conversation companion metadata writes require the additive companion metadata schema.',
      );
    }

    throw new Error(error.message);
  }

  return normalizeConversationCompanionMetadataRowDraft(
    data as KeepCozyThreadCompanionMetadataRowDraft,
  );
}
