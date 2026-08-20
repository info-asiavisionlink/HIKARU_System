import { NextRequest } from 'next/server'
import OpenAI from 'openai'

// ============================================================
// POST /api/ai/realtime-token — Realtime Voice Ephemeral Token
// openai v7: client.realtime.clientSecrets.create()
// POST /v1/realtime/sessions は廃止済み。SDKメソッドを使用。
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
    const openai = new OpenAI({ apiKey })

    // openai SDK v7: realtime.clientSecrets.create() でEphemeral Tokenを発行
    const secret = await openai.realtime.clientSecrets.create({
      session: {
        type:  'realtime',
        model: model as 'gpt-realtime-2.1',
        audio: {
          input: {
            turn_detection: {
              type:                'server_vad',
              threshold:           0.5,
              prefix_padding_ms:   200,
              silence_duration_ms: 500,
            },
          },
          output: { voice: voice as 'alloy' },
        },
      },
      expires_after: { anchor: 'created_at', seconds: 600 },
    })

    return Response.json({
      clientSecret: secret.value,
      sessionId:    (secret.session as { id?: string })?.id ?? null,
      model,
      voice,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[realtime-token]', msg)
    return Response.json({ error: msg }, { status: 500 })
  }
}
