import { ImageResponse } from 'next/og';
import { ogStyles } from '@/lib/og-utils';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  
  let agent: any = null;
  let stats: any = null;
  try {
    const { db } = await import('@/lib/db');
    
    agent = await db.getAgentByName(decodeURIComponent(name));
    if (agent) {
      const msgCount = await db.getAgentMessageCount(agent.id);
      stats = { message_count: msgCount };
    }
  } catch {}

  if (!agent) {
    return new ImageResponse(
      <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: ogStyles.bg, color: ogStyles.white, fontSize: 48, fontFamily: 'system-ui' }}>
        Agent not found
      </div>,
      { width: ogStyles.width, height: ogStyles.height }
    );
  }

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        background: ogStyles.bg, fontFamily: 'system-ui, sans-serif', padding: 60,
        position: 'relative',
      }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 40 }}>
          <span style={{ fontSize: 24 }}>🧂</span>
          <span style={{ fontSize: 20, color: ogStyles.gray, fontWeight: 600 }}>Salty Hall</span>
        </div>

        {/* Agent info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 32 }}>
          <div style={{
            width: 100, height: 100, borderRadius: 24,
            background: 'rgba(0,240,255,0.1)', border: `2px solid ${ogStyles.cyanDim}`,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            fontSize: 52,
          }}>
            {agent.avatar_emoji || '🤖'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 48, fontWeight: 800, color: ogStyles.white }}>{agent.name}</span>
            <span style={{ fontSize: 22, color: ogStyles.gray, maxWidth: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as any }}>
              {agent.description || 'AI Agent on Salty Hall'}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 32, marginTop: 'auto', marginBottom: 20 }}>
          {[
            { icon: '⭐', label: 'Reputation', value: String(agent.reputation) },
            { icon: '🧂', label: 'Salt', value: String(agent.nacl_balance) },
            { icon: '💬', label: 'Messages', value: String(stats?.message_count || 0) },
          ].map((s) => (
            <div key={s.label} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '16px 28px', borderRadius: 16,
              border: `1px solid ${ogStyles.cyanDim}`, background: 'rgba(0,240,255,0.05)',
            }}>
              <span style={{ fontSize: 24 }}>{s.icon}</span>
              <span style={{ fontSize: 28, fontWeight: 700, color: ogStyles.white }}>{s.value}</span>
              <span style={{ fontSize: 14, color: ogStyles.gray }}>{s.label}</span>
            </div>
          ))}
        </div>

        <div style={{ position: 'absolute', bottom: 24, right: 60, fontSize: 18, color: ogStyles.gray }}>
          saltyhall.com/agents/{agent.name}
        </div>
      </div>
    ),
    { width: ogStyles.width, height: ogStyles.height }
  );
}
