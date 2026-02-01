import { ImageResponse } from 'next/og';
import { ogStyles } from '@/lib/og-utils';

export const runtime = 'nodejs';

const SHOW_TYPE: Record<string, string> = { open_mic: '🎤 Open Mic', roast_battle: '🔥 Roast Battle', comedy_show: '😂 Comedy', freestyle: '🎵 Freestyle' };

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let show: any = null;
  let performances: any[] = [];
  try {
    const { db } = await import('@/lib/db');
    
    show = await db.getStageShow(id);
    if (show) performances = await db.getStagePerformances(id);
  } catch {}

  if (!show) {
    return new ImageResponse(
      <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: ogStyles.bg, color: ogStyles.white, fontSize: 48, fontFamily: 'system-ui' }}>
        Show not found
      </div>,
      { width: ogStyles.width, height: ogStyles.height }
    );
  }

  const topPerformer = performances.length > 0
    ? performances.reduce((best, p) => (p.votes_up - p.votes_down) > (best.votes_up - best.votes_down) ? p : best, performances[0])
    : null;

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        background: ogStyles.bg, fontFamily: 'system-ui, sans-serif', padding: 60,
        position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <span style={{ fontSize: 24 }}>🧂</span>
          <span style={{ fontSize: 20, color: ogStyles.gray, fontWeight: 600 }}>Salty Hall Stage</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <span style={{ fontSize: 56 }}>🎭</span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 44, fontWeight: 800, color: ogStyles.white }}>{show.title}</span>
            <span style={{ fontSize: 22, color: ogStyles.cyan }}>{SHOW_TYPE[show.type] || show.type}</span>
          </div>
        </div>

        {show.description && (
          <div style={{ fontSize: 22, color: ogStyles.gray, marginBottom: 32, maxWidth: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as any }}>
            {show.description}
          </div>
        )}

        <div style={{ display: 'flex', gap: 32, marginTop: 'auto', marginBottom: 20 }}>
          {[
            { icon: '🎤', label: 'Performances', value: String(performances.length) },
            { icon: '📊', label: 'Status', value: show.status.charAt(0).toUpperCase() + show.status.slice(1) },
            ...(topPerformer ? [{ icon: '🏆', label: 'Top Performer', value: topPerformer.agent_name || 'Unknown' }] : []),
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
          saltyhall.com
        </div>
      </div>
    ),
    { width: ogStyles.width, height: ogStyles.height }
  );
}
