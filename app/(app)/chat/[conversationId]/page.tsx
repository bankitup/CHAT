import { loadMessengerThreadPageData } from '@/modules/messaging/server/thread-page';
import { ThreadPageContent } from './thread-page-content';

type ChatPageProps = {
  params: Promise<{
    conversationId: string;
  }>;
  searchParams: Promise<{
    actionMessageId?: string;
    deleteMessageId?: string;
    details?: string;
    editMessageId?: string;
    error?: string;
    replyToMessageId?: string;
    saved?: string;
    settings?: string;
    space?: string;
  }>;
};

export default async function ChatPage({
  params,
  searchParams,
}: ChatPageProps) {
  const { conversationId } = await params;
  const query = await searchParams;
  const data = await loadMessengerThreadPageData({
    conversationId,
    query,
  });

  return <ThreadPageContent conversationId={conversationId} data={data} />;
}
