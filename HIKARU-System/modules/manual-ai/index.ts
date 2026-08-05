import { createOpenAIClient, OPENAI_MODELS } from '@/lib/openai/client'
import { MANUAL_SYSTEM_PROMPT, MANUAL_USER_PROMPT } from './prompts'

// ============================================================
// マニュアルコンテキスト型
// ============================================================

export interface ManualItem {
  id: string
  type: 'pdf' | 'image' | 'video' | 'text' | 'faq' | 'note'
  title: string
  content: string | null
  file_url: string | null
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AIReplyResult {
  content: string
  sources: string[]
}

// ============================================================
// マニュアルコンテキスト構築
// ============================================================

const TYPE_LABEL: Record<string, string> = {
  note:  '注意事項',
  faq:   'FAQ',
  text:  '作業手順・説明',
  pdf:   'PDF資料',
  image: '画像資料',
  video: '動画資料',
}

// 優先度順（注意事項・FAQを先頭に）
const TYPE_PRIORITY: Record<string, number> = {
  note: 0, faq: 1, text: 2, pdf: 3, image: 4, video: 5,
}

export function buildManualContext(manuals: ManualItem[]): string {
  if (manuals.length === 0) return '（マニュアルが登録されていません）'

  const sorted = [...manuals].sort(
    (a, b) => (TYPE_PRIORITY[a.type] ?? 9) - (TYPE_PRIORITY[b.type] ?? 9)
  )

  return sorted
    .map((m) => {
      const typeLabel = TYPE_LABEL[m.type] ?? m.type
      let block = `【${typeLabel}】「${m.title}」`
      if (m.content) {
        block += `\n${m.content.trim()}`
      }
      if (m.file_url) {
        block += `\n（参考ファイル: ${m.file_url}）`
      }
      return block
    })
    .join('\n\n────────────────\n\n')
}

// ============================================================
// ソース抽出（■参照マニュアル セクションから）
// ============================================================

export function extractSources(reply: string, manuals: ManualItem[]): string[] {
  // ■参照マニュアル セクションを抽出
  const refSection = reply.match(/■参照マニュアル\s*\n([\s\S]*?)(?=■|$)/)?.[1] ?? ''

  // セクションにあるタイトル候補と一致するマニュアルを探す
  const found = manuals.filter((m) => {
    const inRef = refSection.includes(m.title)
    const inBody = reply.includes(m.title)
    return inRef || inBody
  })

  if (found.length > 0) return found.map((m) => m.title)

  // フォールバック: セクションの行を直接返す
  if (refSection.trim()) {
    return refSection
      .split('\n')
      .map((l) => l.replace(/^[-・\s]+/, '').trim())
      .filter(Boolean)
      .slice(0, 5)
  }

  return []
}

// ============================================================
// ストリーミング AI 回答生成
// ============================================================

export async function* generateManualReplyStream(
  question: string,
  chatHistory: ChatMessage[],
  manuals: ManualItem[]
): AsyncGenerator<string, void, unknown> {
  const openai = createOpenAIClient()
  const context = buildManualContext(manuals)

  const messages = [
    { role: 'system' as const, content: MANUAL_SYSTEM_PROMPT },
    // 直近10件の会話履歴
    ...chatHistory.slice(-10).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    {
      role: 'user' as const,
      content: MANUAL_USER_PROMPT(question, context),
    },
  ]

  const stream = await openai.chat.completions.create({
    model:       OPENAI_MODELS.CHAT,
    messages,
    temperature: 0.3,   // 低温度 = より確実・一貫した回答
    max_tokens:  1500,
    stream:      true,
  })

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content
    if (text) yield text
  }
}

// ============================================================
// 非ストリーミング版（フォールバック・テスト用）
// ============================================================

export async function generateManualReply(
  question: string,
  chatHistory: ChatMessage[],
  manuals: ManualItem[]
): Promise<AIReplyResult> {
  const openai = createOpenAIClient()
  const context = buildManualContext(manuals)

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODELS.CHAT,
    messages: [
      { role: 'system', content: MANUAL_SYSTEM_PROMPT },
      ...chatHistory.slice(-10).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: MANUAL_USER_PROMPT(question, context) },
    ],
    temperature: 0.3,
    max_tokens:  1500,
  })

  const content = completion.choices[0]?.message.content ?? ''
  const sources = extractSources(content, manuals)

  return { content, sources }
}
