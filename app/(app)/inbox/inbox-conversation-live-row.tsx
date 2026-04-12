'use client';

import Link from 'next/link';
import { memo, useSyncExternalStore } from 'react';
import { getInboxDisplayPreviewText } from '@/modules/messaging/e2ee/inbox-policy';
import type { InboxPreviewDisplayMode } from '@/modules/messaging/inbox/preferences';
import {
  getInboxConversationSummarySnapshot,
  subscribeToInboxConversationSummary,
  type InboxConversationLiveSummary,
} from '@/modules/messaging/realtime/inbox-summary-store';
import { EncryptedDmInboxPreview } from './encrypted-dm-inbox-preview';
import styles from './inbox-conversation-row-contract.module.css';
import {
  areInboxMetaLabelsEqual,
  areInboxParticipantListsEqual,
  formatInboxRecency,
  formatInboxTimestamp,
  formatInboxUnreadBadgeCount,
  InboxConversationAvatarVisual,
  InboxConversationTitleVisual,
  joinClassNames,
} from './inbox-conversation-row-shared';

type InboxConversationLiveRowProps = {
  activeSpaceId: string | null;
  currentUserId: string;
  initialSummary: InboxConversationLiveSummary;
  isPrimaryChatsView: boolean;
  isArchivedView: boolean;
  previewMode: InboxPreviewDisplayMode;
  item: {
    conversationId: string;
    groupAvatarPath: string | null;
    isGroupConversation: boolean;
    metaLabels: Array<{
      label: string;
      tone: 'default' | 'archived';
    }>;
    participants: Array<{
      userId: string;
      displayName: string | null;
      avatarPath?: string | null;
    }>;
    title: string;
  };
  language: 'en' | 'ru';
  labels: {
    audio: string;
    attachment: string;
    deletedMessage: string;
    encryptedMessage: string;
    file: string;
    group: string;
    image: string;
    newMessage: string;
    newEncryptedMessage: string;
    noActivityYet: string;
    unreadAria: string;
    voiceMessage: string;
    yesterday: string;
  };
  restoreAction?: ((formData: FormData) => void | Promise<void>) | null;
  restoreLabel?: string;
  shouldPrefetch?: boolean;
};

function areInboxConversationSummariesEqual(
  previous: InboxConversationLiveSummary,
  next: InboxConversationLiveSummary,
) {
  return (
    previous.conversationId === next.conversationId &&
    previous.createdAt === next.createdAt &&
    previous.hiddenAt === next.hiddenAt &&
    previous.lastMessageAt === next.lastMessageAt &&
    previous.lastReadAt === next.lastReadAt &&
    previous.lastReadMessageSeq === next.lastReadMessageSeq &&
    previous.latestMessageAttachmentKind === next.latestMessageAttachmentKind &&
    previous.latestMessageBody === next.latestMessageBody &&
    previous.latestMessageContentMode === next.latestMessageContentMode &&
    previous.latestMessageDeletedAt === next.latestMessageDeletedAt &&
    previous.latestMessageId === next.latestMessageId &&
    previous.latestMessageKind === next.latestMessageKind &&
    previous.latestMessageSenderId === next.latestMessageSenderId &&
    previous.latestMessageSeq === next.latestMessageSeq &&
    previous.removed === next.removed &&
    previous.unreadCount === next.unreadCount
  );
}

function InboxConversationLiveRowComponent({
  activeSpaceId,
  currentUserId,
  initialSummary,
  isArchivedView,
  isPrimaryChatsView,
  previewMode,
  item,
  language,
  labels,
  restoreAction,
  restoreLabel,
  shouldPrefetch = false,
}: InboxConversationLiveRowProps) {
  const liveSummary = useSyncExternalStore(
    (listener) =>
      subscribeToInboxConversationSummary(item.conversationId, listener),
    () => getInboxConversationSummarySnapshot(item.conversationId, initialSummary),
    () => initialSummary,
  );

  if (liveSummary.removed) {
    return null;
  }

  const isHidden = Boolean(liveSummary.hiddenAt);

  if (isArchivedView ? !isHidden : isHidden) {
    return null;
  }

  const preview = getInboxDisplayPreviewText(
    {
      lastMessageAt: liveSummary.lastMessageAt,
      latestMessageAttachmentKind: liveSummary.latestMessageAttachmentKind,
      latestMessageBody: liveSummary.latestMessageBody,
      latestMessageContentMode: liveSummary.latestMessageContentMode,
      latestMessageDeletedAt: liveSummary.latestMessageDeletedAt,
      latestMessageKind: liveSummary.latestMessageKind,
      unreadCount: liveSummary.unreadCount,
    },
    {
      audio: labels.audio,
      attachment: labels.attachment,
      deletedMessage: labels.deletedMessage,
      encryptedMessage: labels.encryptedMessage,
      file: labels.file,
      image: labels.image,
      newMessage: labels.newMessage,
      newEncryptedMessage: labels.newEncryptedMessage,
      voiceMessage: labels.voiceMessage,
    },
    previewMode,
  );
  const hasUnread = liveSummary.unreadCount > 0;
  const previewClassName =
    hasUnread
      ? isPrimaryChatsView
        ? 'muted conversation-preview conversation-preview-unread conversation-preview-dm'
        : 'muted conversation-preview conversation-preview-unread'
      : isPrimaryChatsView
        ? 'muted conversation-preview conversation-preview-dm'
        : 'muted conversation-preview';
  const lastActivityAt = liveSummary.lastMessageAt ?? liveSummary.createdAt;
  const recencyLabel = formatInboxRecency(
    lastActivityAt,
    language,
    labels.yesterday,
  );
  const timestampLabel = formatInboxTimestamp(
    lastActivityAt,
    language,
    labels.noActivityYet,
  );
  const unreadBadgeCount = formatInboxUnreadBadgeCount(liveSummary.unreadCount);
  const chatHref =
    activeSpaceId?.trim()
      ? `/chat/${item.conversationId}?space=${encodeURIComponent(activeSpaceId)}`
      : `/chat/${item.conversationId}`;
  const diagnosticsEnabled =
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_CHAT_DEBUG_INBOX_NAV === '1';

  const logNavigationDiagnostics = (
    stage: string,
    details?: Record<string, unknown>,
  ) => {
    if (!diagnosticsEnabled) {
      return;
    }

    if (details) {
      console.info('[inbox-nav]', stage, details);
      return;
    }

    console.info('[inbox-nav]', stage);
  };

  return (
    <article
      className={joinClassNames(
        hasUnread
          ? isPrimaryChatsView
            ? 'conversation-card conversation-card-unread conversation-card-minimal conversation-card-dm'
            : 'conversation-card conversation-card-unread conversation-card-minimal'
          : isPrimaryChatsView
            ? 'conversation-card conversation-card-minimal conversation-card-dm'
            : 'conversation-card conversation-card-minimal',
        styles.card,
      )}
    >
      <div
        className={joinClassNames(
          isArchivedView
            ? isPrimaryChatsView
              ? 'conversation-row conversation-row-with-action conversation-row-dm'
              : 'conversation-row conversation-row-with-action'
            : isPrimaryChatsView
              ? 'conversation-row conversation-row-dm'
              : 'conversation-row',
          styles.row,
          isPrimaryChatsView ? styles.rowDm : null,
          isArchivedView ? styles.rowWithAction : null,
        )}
      >
        <Link
          className={joinClassNames(
            isPrimaryChatsView
              ? 'conversation-row-link conversation-row-link-dm'
              : 'conversation-row-link',
            styles.link,
            isPrimaryChatsView ? styles.linkDm : null,
          )}
          href={chatHref}
          onClick={(event) => {
            if (
              event.defaultPrevented ||
              event.button !== 0 ||
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
            event.altKey
            ) {
              logNavigationDiagnostics('row:navigation-bypassed', {
                conversationId: item.conversationId,
                defaultPrevented: event.defaultPrevented,
                href: chatHref,
                reason: 'modified-or-nonprimary-click',
              });
              return;
            }

            logNavigationDiagnostics('row:navigation-attempt', {
              conversationId: item.conversationId,
              href: chatHref,
              isGroupConversation: item.isGroupConversation,
            });
          }}
          prefetch={shouldPrefetch}
        >
          <div className={styles.avatarSlot}>
            <InboxConversationAvatarVisual
              groupAvatarPath={item.groupAvatarPath}
              isGroupConversation={item.isGroupConversation}
              isPrimaryChatsView={isPrimaryChatsView}
              participant={item.participants[0] ?? null}
              title={item.title}
            />
          </div>

          <div
            className={joinClassNames(
              isPrimaryChatsView
                ? 'stack conversation-card-copy conversation-card-copy-dm'
                : 'stack conversation-card-copy',
              styles.copy,
              isPrimaryChatsView ? styles.copyDm : null,
            )}
          >
            <div
              className={joinClassNames(
                isPrimaryChatsView
                  ? 'stack conversation-main-copy conversation-main-copy-dm'
                  : 'stack conversation-main-copy',
                styles.mainCopy,
                isPrimaryChatsView ? styles.mainCopyDm : null,
              )}
            >
              <div
                className={joinClassNames(
                  isPrimaryChatsView
                    ? 'conversation-title-row conversation-title-row-dm'
                    : 'conversation-title-row',
                  styles.titleRow,
                  isPrimaryChatsView ? styles.titleRowDm : null,
                )}
              >
                <InboxConversationTitleVisual
                  className={styles.title}
                  hasUnread={hasUnread}
                  isPrimaryChatsView={isPrimaryChatsView}
                  title={item.title}
                />
                <div
                  className={joinClassNames(
                    'conversation-title-meta',
                    styles.titleMeta,
                  )}
                >
                  <span
                    className={joinClassNames(
                      hasUnread
                        ? 'conversation-recency conversation-recency-unread'
                        : 'conversation-recency',
                      styles.recency,
                    )}
                    title={timestampLabel}
                  >
                    {recencyLabel}
                  </span>
                  {hasUnread && unreadBadgeCount ? (
                    <span
                      className={joinClassNames(
                        'conversation-unread-badge',
                        styles.unreadBadge,
                      )}
                      aria-label={labels.unreadAria}
                    >
                      {unreadBadgeCount}
                    </span>
                  ) : null}
                </div>
              </div>
              {preview ? (
                <EncryptedDmInboxPreview
                  className={joinClassNames(
                    previewClassName,
                    styles.preview,
                  )}
                  conversationId={item.conversationId}
                  currentUserId={currentUserId}
                  fallbackPreview={preview}
                  latestMessageContentMode={liveSummary.latestMessageContentMode}
                  latestMessageDeletedAt={liveSummary.latestMessageDeletedAt}
                  latestMessageId={liveSummary.latestMessageId}
                />
              ) : (
                <p
                  aria-hidden="true"
                  className={joinClassNames(
                    previewClassName,
                    'conversation-preview-placeholder',
                    styles.preview,
                    styles.previewPlaceholder,
                  )}
                >
                  {'\u00a0'}
                </p>
              )}
            </div>

            {item.metaLabels.length > 0 ? (
              <div
                className={joinClassNames(
                  isPrimaryChatsView
                    ? 'conversation-footer conversation-footer-dm'
                    : 'conversation-footer',
                  styles.footer,
                  isPrimaryChatsView ? styles.footerDm : null,
                )}
              >
                <div
                  className={joinClassNames(
                    'conversation-footer-meta',
                    styles.footerMeta,
                  )}
                >
                  {item.metaLabels.map((metaLabel) => (
                    <span
                      key={metaLabel.label}
                      className={
                        metaLabel.tone === 'archived'
                          ? 'conversation-kind-label conversation-kind-label-archived'
                          : 'conversation-kind-label'
                      }
                    >
                      {metaLabel.label}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Link>
        {isArchivedView && restoreAction && restoreLabel ? (
          <form action={restoreAction}>
            <input name="conversationId" type="hidden" value={item.conversationId} />
            <input name="spaceId" type="hidden" value={activeSpaceId ?? ''} />
            <button
              className="button button-compact button-secondary conversation-restore-button"
              type="submit"
            >
              {restoreLabel}
            </button>
          </form>
        ) : null}
      </div>
    </article>
  );
}

export const InboxConversationLiveRow = memo(
  InboxConversationLiveRowComponent,
  (previous, next) =>
    previous.activeSpaceId === next.activeSpaceId &&
    previous.currentUserId === next.currentUserId &&
    areInboxConversationSummariesEqual(previous.initialSummary, next.initialSummary) &&
    previous.isArchivedView === next.isArchivedView &&
    previous.isPrimaryChatsView === next.isPrimaryChatsView &&
    previous.item.conversationId === next.item.conversationId &&
    previous.item.groupAvatarPath === next.item.groupAvatarPath &&
    previous.item.isGroupConversation === next.item.isGroupConversation &&
    previous.item.title === next.item.title &&
    areInboxMetaLabelsEqual(previous.item.metaLabels, next.item.metaLabels) &&
    areInboxParticipantListsEqual(previous.item.participants, next.item.participants) &&
    previous.language === next.language &&
    previous.labels === next.labels &&
    previous.restoreAction === next.restoreAction &&
    previous.restoreLabel === next.restoreLabel,
);
