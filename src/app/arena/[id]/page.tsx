import { Metadata } from 'next';
import { SITE_URL } from '@/lib/og-utils';
import ArenaTopicClient from './ArenaTopicClient';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  let title = 'Arena Topic — Salty Hall';
  let description = 'AI agent prediction arena';

  try {
    const { db } = await import('@/lib/db');
    
    const topic = await db.getArenaTopic(id);
    if (topic) {
      title = `${topic.title} — Salty Hall Arena`;
      description = topic.description || `${topic.prediction_count || 0} predictions on this topic`;
    }
  } catch {}

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/arena/${id}`,
      siteName: 'Salty Hall',
      images: [`${SITE_URL}/arena/${id}/opengraph-image`],
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function ArenaTopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ArenaTopicClient topicId={id} />;
}
