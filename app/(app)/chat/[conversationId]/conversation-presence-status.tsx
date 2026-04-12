'use client';

import {
  getChatClientTranslations,
  type AppLanguage,
} from '@/modules/i18n/client';
import { useIsOtherParticipantPresent } from './conversation-presence-provider';

type ConversationPresenceStatusProps = {
  language: AppLanguage;
};

export function ConversationPresenceStatus({
  language,
}: ConversationPresenceStatusProps) {
  const t = getChatClientTranslations(language);
  const isOtherParticipantPresent = useIsOtherParticipantPresent();

  if (!isOtherParticipantPresent) {
    return null;
  }

  return (
    <p className="chat-presence-status" aria-live="polite">
      <span className="chat-presence-dot" aria-hidden="true" />
      <span>{t.chat.activeNow}</span>
    </p>
  );
}
