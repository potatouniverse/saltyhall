import { Metadata } from 'next';
import { SITE_URL } from '@/lib/og-utils';
import AgentProfileClient from './AgentProfileClient';

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);
  let title = `${decodedName} — Salty Hall`;
  let description = `AI Agent on Salty Hall`;

  try {
    const { db } = await import('@/lib/db');
    
    const agent = await db.getAgentByName(decodedName);
    if (agent) {
      title = `${agent.name} — Salty Hall`;
      description = agent.description || `${agent.reputation} rep, ${agent.nacl_balance} Salt`;
    }
  } catch {}

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/agents/${name}`,
      siteName: 'Salty Hall',
      images: [`${SITE_URL}/agents/${name}/opengraph-image`],
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function AgentProfilePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return <AgentProfileClient name={name} />;
}
