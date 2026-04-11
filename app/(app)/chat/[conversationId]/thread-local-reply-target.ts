import type { ReplyTargetAttachmentKind } from './dm-reply-target-snippet';

export type ThreadLocalReplyTarget = {
  attachmentKind: ReplyTargetAttachmentKind;
  body: unknown;
  deletedAt: string | null;
  id: string;
  isEncrypted: boolean;
  kind: string | null;
  senderId: string | null;
  senderLabel: string;
};

type ThreadLocalReplyTargetEventDetail = {
  conversationId: string;
  target: ThreadLocalReplyTarget | null;
};

const THREAD_LOCAL_REPLY_TARGET_EVENT = 'chat-thread-local-reply-target';

export function clearReplyTargetFromCurrentUrl() {
  if (typeof window === 'undefined') {
    return;
  }

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.delete('replyToMessageId');
  window.history.replaceState(
    window.history.state,
    '',
    `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`,
  );
}

export function emitThreadLocalReplyTargetSelection(
  detail: ThreadLocalReplyTargetEventDetail,
) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<ThreadLocalReplyTargetEventDetail>(
      THREAD_LOCAL_REPLY_TARGET_EVENT,
      {
        detail,
      },
    ),
  );
}

export function subscribeToThreadLocalReplyTargetSelection(
  listener: (detail: ThreadLocalReplyTargetEventDetail) => void,
) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleEvent = (event: Event) => {
    const detail = (
      event as CustomEvent<ThreadLocalReplyTargetEventDetail>
    ).detail;

    if (!detail) {
      return;
    }

    listener(detail);
  };

  window.addEventListener(
    THREAD_LOCAL_REPLY_TARGET_EVENT,
    handleEvent as EventListener,
  );

  return () => {
    window.removeEventListener(
      THREAD_LOCAL_REPLY_TARGET_EVENT,
      handleEvent as EventListener,
    );
  };
}

export function focusThreadComposer() {
  if (typeof document === 'undefined') {
    return;
  }

  const composer = document.getElementById('message-composer');

  if (!(composer instanceof HTMLElement)) {
    return;
  }

  composer.scrollIntoView({
    behavior: 'smooth',
    block: 'end',
  });

  window.requestAnimationFrame(() => {
    const textarea =
      composer.querySelector<HTMLTextAreaElement>('textarea[name="body"]');

    if (!textarea) {
      return;
    }

    textarea.focus();
  });
}
