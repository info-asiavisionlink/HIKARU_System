import { NextRequest } from 'next/server'

// ============================================================
// POST /api/ai/realtime-token — Realtime Voice Ephemeral Token
// ブラウザへOpenAI API Keyを露出しない。
// サーバー側でEphemeral Tokenを発行し、ブラウザへ返す。
// 認証: hk_s_uid cookie（ミドルウェア検証済み）
// ============================================================

export const maxDuration = 15

export async function POST(req: NextRequest) {
  const uid = req.cookies.get('hk_s_uid')?.value
  if (!uid) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
  }

  let body: { model?: string; voice?: string } = {}
  try { body = await req.json() } catch {}

  const model = body.model ?? 'gpt-realtime-2.1'
  const voice = body.voice ?? 'alloy'

  try {
    // OpenAI公式: POST /v1/realtime/client_secrets でEphemeral Tokenを発行
    const res = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        voice,
        turn_detection: {
          type:                'server_vad',
          threshold:           0.5,
          prefix_padding_ms:   200,
          silence_duration_ms: 500,
        },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[realtime-token] OpenAI error:', err)
      return Response.json({ error: 'Failed to create realtime session' }, { status: 502 })
    }

    const session = await res.json()
    // session.client_secret.value がEphemeral Token
    return Response.json({
      clientSecret: session?.client_secret?.value ?? null,
      sessionId:    session?.id ?? null,
      model,
      voice,
    })
  } catch (err) {
    console.error('[realtime-token]', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
