'use client';

import type { ReactNode } from 'react';

type ThreadHistoryRenderSeparatorItem = {
  key: string;
  label: string;
  type: 'separator' | 'unread';
};

export type ThreadHistoryRenderListItem<MessageItem> =
  | ThreadHistoryRenderSeparatorItem
  | MessageItem;

type ThreadHistoryRenderListProps<MessageItem extends { key: string; type: 'message' }> = {
  emptyLabel: string;
  items: readonly ThreadHistoryRenderListItem<MessageItem>[];
  renderMessage: (messageItem: MessageItem) => ReactNode;
};

export function ThreadHistoryRenderList<
  MessageItem extends { key: string; type: 'message' },
>({
  emptyLabel,
  items,
  renderMessage,
}: ThreadHistoryRenderListProps<MessageItem>) {
  if (items.length === 0) {
    return (
      <div className="chat-empty-state" aria-label={emptyLabel}>
        <span className="chat-empty-state-label">{emptyLabel}</span>
      </div>
    );
  }

  return (
    <>
      {items.map((item) => {
        if (item.type === 'separator') {
          return (
            <div
              key={item.key}
              className="message-day-separator"
              aria-label={item.label}
            >
              <span className="message-day-label">{item.label}</span>
            </div>
          );
        }

        if (item.type === 'unread') {
          return (
            <div
              key={item.key}
              className="message-unread-separator"
              aria-label={item.label}
            >
              <span className="message-unread-label">{item.label}</span>
            </div>
          );
        }

        return renderMessage(item as MessageItem);
      })}
    </>
  );
}
