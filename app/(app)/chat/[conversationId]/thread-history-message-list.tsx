'use client';

import type { AppLanguage } from '@/modules/i18n/client';
import { ThreadHistoryRenderList } from './thread-history-render-list';
import {
  ThreadMessageRow,
  getEncryptedHistoryHintForMessage,
  shouldRenderPendingOwnEncryptedCommitTransition,
} from './thread-message-row';
import type {
  ActiveImagePreview,
  ThreadHistoryState,
  TimelineRenderItem,
} from './thread-history-types';
import type { DmThreadClientDiagnostics } from './dm-thread-client-diagnostics';

type ThreadHistoryMessageListProps = {
  activeDeleteMessageId: string | null;
  activeEditMessageId: string | null;
  activeSpaceId: string;
  conversationId: string;
  conversationKind: 'dm' | 'group';
  currentUserId: string;
  emptyLabel: string;
  historyState: ThreadHistoryState;
  language: AppLanguage;
  latestVisibleMessageSeq: number | null;
  onOpenImagePreview: (preview: ActiveImagePreview) => void;
  otherParticipantReadSeq: number | null;
  otherParticipantUserId: string | null;
  pendingEncryptedCommitTransitionMessageIds: Set<string>;
  senderNames: Map<string, string>;
  threadClientDiagnostics: DmThreadClientDiagnostics;
  timelineRenderItems: TimelineRenderItem[];
};

export function ThreadHistoryMessageList({
  activeDeleteMessageId,
  activeEditMessageId,
  activeSpaceId,
  conversationId,
  conversationKind,
  currentUserId,
  emptyLabel,
  historyState,
  language,
  latestVisibleMessageSeq,
  onOpenImagePreview,
  otherParticipantReadSeq,
  otherParticipantUserId,
  pendingEncryptedCommitTransitionMessageIds,
  senderNames,
  threadClientDiagnostics,
  timelineRenderItems,
}: ThreadHistoryMessageListProps) {
  return (
    <ThreadHistoryRenderList
      emptyLabel={emptyLabel}
      items={timelineRenderItems}
      renderMessage={(item) => {
        const encryptedEnvelope =
          historyState.encryptedEnvelopesByMessage.get(item.message.id) ?? null;
        const encryptedHistoryHint = getEncryptedHistoryHintForMessage({
          envelope: encryptedEnvelope,
          hint:
            historyState.encryptedHistoryHintsByMessage.get(item.message.id) ??
            null,
          message: item.message,
        });

        return (
          <ThreadMessageRow
            key={item.message.id}
            activeDeleteMessageId={activeDeleteMessageId}
            activeEditMessageId={activeEditMessageId}
            activeSpaceId={activeSpaceId}
            attachmentsByMessage={historyState.attachmentsByMessage}
            compactHistoricalUnavailable={item.compactHistoricalUnavailable}
            conversationId={conversationId}
            conversationKind={conversationKind}
            currentUserId={currentUserId}
            encryptedEnvelopesByMessage={historyState.encryptedEnvelopesByMessage}
            encryptedHistoryHintsByMessage={historyState.encryptedHistoryHintsByMessage}
            historicalUnavailableContinuationCount={
              item.historicalUnavailableContinuationCount
            }
            isPendingEncryptedCommitTransition={shouldRenderPendingOwnEncryptedCommitTransition(
              {
                currentUserId,
                envelope: encryptedEnvelope,
                historyHint: encryptedHistoryHint,
                message: item.message,
                pendingMessageIds: pendingEncryptedCommitTransitionMessageIds,
              },
            )}
            isClusteredWithNext={item.isClusteredWithNext}
            isClusteredWithPrevious={item.isClusteredWithPrevious}
            language={language}
            latestVisibleMessageSeq={latestVisibleMessageSeq}
            message={item.message}
            messagesById={historyState.messagesById}
            onOpenImagePreview={onOpenImagePreview}
            otherParticipantReadSeq={otherParticipantReadSeq}
            otherParticipantUserId={otherParticipantUserId}
            reactionsByMessage={historyState.reactionsByMessage}
            senderNames={senderNames}
            threadClientDiagnostics={threadClientDiagnostics}
          />
        );
      }}
    />
  );
}
