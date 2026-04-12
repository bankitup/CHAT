'use client';

import { InboxConversationStaticRow } from './inbox-conversation-static-row';
import type { InboxConversationLiveSummary } from '@/modules/messaging/realtime/inbox-summary-store';

type OrganizedConversationSection = {
  items: Array<{
    conversationId: string;
    groupAvatarPath: string | null;
    hasUnread: boolean;
    isGroupConversation: boolean;
    metaLabels: Array<{
      label: string;
      tone: 'default' | 'archived';
    }>;
    participants: Array<{
      avatarPath?: string | null;
      displayName: string | null;
      userId: string;
    }>;
    preview: string | null;
    title: string;
  }>;
  key: 'all' | 'dm' | 'groups';
  label: string | null;
};

type InboxConversationSectionsStaticProps = {
  activeSpaceId: string;
  currentUserId: string;
  isArchivedView: boolean;
  isPrimaryChatsView: boolean;
  language: 'en' | 'ru';
  labels: {
    noActivityYet: string;
    unreadAria: string;
    yesterday: string;
  };
  restoreAction?: ((formData: FormData) => void | Promise<void>) | null;
  restoreLabel?: string;
  sections: OrganizedConversationSection[];
  shouldPrefetch: boolean;
  visibleSummariesByConversationId: Map<string, InboxConversationLiveSummary>;
};

export function InboxConversationSectionsStatic({
  activeSpaceId,
  currentUserId,
  isArchivedView,
  isPrimaryChatsView,
  language,
  labels,
  restoreAction,
  restoreLabel,
  sections,
  shouldPrefetch,
  visibleSummariesByConversationId,
}: InboxConversationSectionsStaticProps) {
  return (
    <>
      {sections.map((section) => (
        <div
          key={section.key}
          className={section.label ? 'stack conversation-list-section' : 'stack'}
        >
          {section.label ? (
            <p className="conversation-list-section-label">{section.label}</p>
          ) : null}
          {section.items.map((conversation, index) => (
            <InboxConversationStaticRow
              key={conversation.conversationId}
              activeSpaceId={activeSpaceId}
              currentUserId={currentUserId}
              initialSummary={
                visibleSummariesByConversationId.get(conversation.conversationId) ?? {
                  conversationId: conversation.conversationId,
                  createdAt: null,
                  hiddenAt: null,
                  lastMessageAt: null,
                  lastReadAt: null,
                  lastReadMessageSeq: null,
                  latestMessageAttachmentKind: null,
                  latestMessageBody: null,
                  latestMessageContentMode: null,
                  latestMessageDeletedAt: null,
                  latestMessageId: null,
                  latestMessageKind: null,
                  latestMessageSenderId: null,
                  latestMessageSeq: null,
                  unreadCount: 0,
                }
              }
              isArchivedView={isArchivedView}
              isPrimaryChatsView={isPrimaryChatsView}
              item={conversation}
              language={language}
              labels={labels}
              restoreAction={isArchivedView ? restoreAction : null}
              restoreLabel={isArchivedView ? restoreLabel : undefined}
              shouldPrefetch={shouldPrefetch && !isArchivedView && index < 6}
            />
          ))}
        </div>
      ))}
    </>
  );
}
