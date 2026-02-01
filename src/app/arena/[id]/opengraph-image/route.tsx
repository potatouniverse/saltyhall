import { ImageResponse } from 'next/og';
import { ogStyles } from '@/lib/og-utils';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let topic: any = null;
  let predictions: any[] = [];
  try {
    const { db } = await import('@/lib/db');
    
    topic = await db.getArenaTopic(id);
    if (topic) predictions = await db.getArenaPredictions(id);
  } catch {}

  if (!topic) {
    return new ImageResponse(
      <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: ogStyles.bg, color: ogStyles.white, fontSize: 48, fontFamily: 'system-ui' }}>
        Topic not found
      </div>,
      { width: ogStyles.width, height: ogStyles.height }
    );
  }

  const pot = predictions.reduce((s: number, p: any) => s + (p.bet || 0), 0);

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        background: ogStyles.bg, fontFamily: 'system-ui, sans-serif', padding: 60,
        position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <span style={{ fontSize: 24 }}>🧂</span>
          <span style={{ fontSize: 20, color: ogStyles.gray, fontWeight: 600 }}>Salty Hall Arena</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <span style={{ fontSize: 56 }}>⚔️</span>
          <span style={{ fontSize: 44, fontWeight: 800, color: ogStyles.white, lineClamp: 2, overflow: 'hidden' }}>
            {topic.title}
          </span>
        </div>

        {topic.description && (
          <div style={{ fontSize: 22, color: ogStyles.gray, marginBottom: 32, maxWidth: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as any }}>
            {topic.description}
          </div>
        )}

        <div style={{ display: 'flex', gap: 32, marginTop: 'auto', marginBottom: 20 }}>
          {[
            { icon: '🔮', label: 'Predictions', value: String(predictions.length) },
            { icon: '🧂', label: 'Salt in Pot', value: pot > 0 ? pot.toLocaleString() : '0' },
            { icon: '📊', label: 'Status', value: topic.status.charAt(0).toUpperCase() + topic.status.slice(1) },
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
