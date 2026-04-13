'use client';

import Link from 'next/link';
import styles from './inbox-conversation-row-contract.module.css';
import {
  formatInboxRecency,
  formatInboxTimestamp,
  formatInboxUnreadBadgeCount,
  InboxConversationAvatarVisual,
  InboxConversationTitleVisual,
  joinClassNames,
  type InboxConversationRowMetaLabel,
  type InboxConversationRowParticipant,
} from './inbox-conversation-row-shared';

type InboxConversationStaticRowProps = {
  activeSpaceId: string | null;
  currentUserId: string;
  initialSummary: {
    conversationId: string;
    createdAt: string | null;
    hiddenAt: string | null;
    lastMessageAt: string | null;
    unreadCount: number;
  };
  isArchivedView: boolean;
  isPrimaryChatsView: boolean;
  item: {
    conversationId: string;
    groupAvatarPath: string | null;
    hasUnread: boolean;
    isGroupConversation: boolean;
    metaLabels: InboxConversationRowMetaLabel[];
    participants: InboxConversationRowParticipant[];
    preview: string | null;
    title: string;
  };
  language: 'en' | 'ru';
  labels: {
    noActivityYet: string;
    unreadAria: string;
    yesterday: string;
  };
  restoreAction?: ((formData: FormData) => void | Promise<void>) | null;
  restoreLabel?: string;
  shouldPrefetch?: boolean;
};

export function InboxConversationStaticRow({
  activeSpaceId,
  currentUserId,
  initialSummary,
  isArchivedView,
  isPrimaryChatsView,
  item,
  language,
  labels,
  restoreAction,
  restoreLabel,
  shouldPrefetch = false,
}: InboxConversationStaticRowProps) {
  void currentUserId;

  const previewClassName =
    item.hasUnread
      ? isPrimaryChatsView
        ? 'muted conversation-preview conversation-preview-unread conversation-preview-dm'
        : 'muted conversation-preview conversation-preview-unread'
      : isPrimaryChatsView
        ? 'muted conversation-preview conversation-preview-dm'
        : 'muted conversation-preview';

  const lastActivityAt = initialSummary.lastMessageAt ?? initialSummary.createdAt;
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
  const unreadBadgeCount = formatInboxUnreadBadgeCount(initialSummary.unreadCount);
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
        item.hasUnread
          ? isPrimaryChatsView
            ? 'conversation-card conversation-card-unread conversation-card-minimal conversation-card-dm'
            : 'conversation-card conversation-card-unread conversation-card-minimal'
          : isPrimaryChatsView
            ? 'conversation-card conversation-card-minimal conversation-card-dm'
            : 'conversation-card conversation-card-minimal',
        styles.card,
        item.hasUnread ? styles.cardUnread : null,
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
            item.hasUnread ? styles.linkUnread : null,
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
                  hasUnread={item.hasUnread}
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
                      item.hasUnread
                        ? 'conversation-recency conversation-recency-unread'
                        : 'conversation-recency',
                      styles.recency,
                    )}
                    title={timestampLabel}
                  >
                    {recencyLabel}
                  </span>
                  {item.hasUnread && unreadBadgeCount ? (
                    <span
                      aria-label={labels.unreadAria}
                      className={joinClassNames(
                        'conversation-unread-badge',
                        styles.unreadBadge,
                      )}
                    >
                      {unreadBadgeCount}
                    </span>
                  ) : null}
                </div>
              </div>
              {item.preview ? (
                <p
                  className={joinClassNames(
                    previewClassName,
                    styles.preview,
                  )}
                >
                  {item.preview}
                </p>
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
