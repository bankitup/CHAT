'use client';

import {
  getChatClientTranslations,
  type AppLanguage,
} from '@/modules/i18n/client-chat';
import { useIsOtherParticipantPresent } from './conversation-presence-provider';

type ConversationPresenceStatusProps = {
  language: AppLanguage;
};

export function ConversationPresenceStatus({
  language,
}: ConversationPresenceStatusProps) {
  const t = getChatClientTranslations(language);
  const isOtherParticipantPresent = useIsOtherParticipantPresent();

  return (
    <p
      aria-hidden={!isOtherParticipantPresent}
      aria-live={isOtherParticipantPresent ? 'polite' : undefined}
      className="chat-presence-status"
      data-presence-active={isOtherParticipantPresent ? 'true' : 'false'}
    >
      <span className="chat-presence-dot" aria-hidden="true" />
      <span>{isOtherParticipantPresent ? t.chat.activeNow : '\u00a0'}</span>
    </p>
  );
}
