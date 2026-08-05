// ============================================================
// チャットサービス — クライアントサイド専用
// API Routes経由でサーバーと通信する
// ============================================================

export interface ChatMessageRow {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources: string[] | null
  created_at: string
}

// ---- SSEストリーム読み取り用コールバック ----

export interface StreamCallbacks {
  onChunk: (text: string) => void
  onDone: (sources: string[]) => void
  onError: (message: string) => void
}

// チャット履歴取得
export async function loadChatHistory(
  projectId: string,
  limit = 30
): Promise<ChatMessageRow[]> {
  const res = await fetch(`/api/ai/manual?projectId=${projectId}&limit=${limit}`)
  if (!res.ok) return []
  const json = await res.json()
  return json.success ? json.data : []
}

// AIへ質問を送り、ストリーミング受信
export async function sendChatMessage(params: {
  projectId: string
  message: string
  chatHistory: { role: 'user' | 'assistant'; content: string }[]
  jobId?: string
  callbacks: StreamCallbacks
}): Promise<void> {
  const { projectId, message, chatHistory, jobId, callbacks } = params

  const res = await fetch('/api/ai/manual', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ projectId, message, chatHistory, jobId }),
  })

  if (!res.ok || !res.body) {
    callbacks.onError('通信に失敗しました。再度お試しください。')
    return
  }

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer    = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // SSEの行を処理
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? '' // 未完の行はバッファに残す

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const data = JSON.parse(line.slice(6))

        switch (data.type) {
          case 'chunk':
            callbacks.onChunk(data.content ?? '')
            break
          case 'done':
            callbacks.onDone(data.sources ?? [])
            break
          case 'error':
            callbacks.onError(data.message ?? 'エラーが発生しました')
            break
        }
      } catch {
        // JSONパースエラーは無視
      }
    }
  }
}

// レスポンスを構造化セクションに分割
export interface ResponseSection {
  type: 'answer' | 'steps' | 'caution' | 'sources' | 'supplement' | 'text'
  title: string
  content: string
}

export function parseAIResponse(content: string): ResponseSection[] {
  const SECTION_MAP: Record<string, ResponseSection['type']> = {
    '回答':      'answer',
    '手順・方法': 'steps',
    '注意事項':   'caution',
    '参照マニュアル': 'sources',
    '補足':      'supplement',
  }

  const sections: ResponseSection[] = []
  const parts = content.split(/(■[^\n]+)/).filter(Boolean)

  let currentType: ResponseSection['type'] = 'text'
  let currentTitle = ''
  let currentContent = ''

  for (const part of parts) {
    if (part.startsWith('■')) {
      if (currentContent.trim()) {
        sections.push({ type: currentType, title: currentTitle, content: currentContent.trim() })
      }
      const title = part.slice(1).trim()
      currentType    = SECTION_MAP[title] ?? 'text'
      currentTitle   = title
      currentContent = ''
    } else {
      currentContent += part
    }
  }

  if (currentContent.trim()) {
    sections.push({ type: currentType, title: currentTitle, content: currentContent.trim() })
  }

  // ■ が一つもない場合はそのまま返す
  if (sections.length === 0 && content.trim()) {
    sections.push({ type: 'text', title: '', content: content.trim() })
  }

  return sections
}
