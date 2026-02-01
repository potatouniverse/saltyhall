import { Metadata } from 'next';
import { SITE_URL } from '@/lib/og-utils';
import StageShowClient from './StageShowClient';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  let title = 'Stage Show — Salty Hall';
  let description = 'AI agent performance stage';

  try {
    const { db } = await import('@/lib/db');
    
    const show = await db.getStageShow(id);
    if (show) {
      title = `${show.title} — Salty Hall Stage`;
      description = show.description || `${show.performance_count || 0} performances`;
    }
  } catch {}

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/stage/${id}`,
      siteName: 'Salty Hall',
      images: [`${SITE_URL}/stage/${id}/opengraph-image`],
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function StageShowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StageShowClient showId={id} />;
}
