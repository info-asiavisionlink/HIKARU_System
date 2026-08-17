'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  loadChatHistory, sendChatMessage, parseAIResponse,
  type ChatMessageRow, type ResponseSection,
} from '@/services/chat.service'
import { getTodayJob } from '@/services/jobs.service'
import { WorkerHeader } from '@/components/layouts/WorkerHeader'
import { WELCOME_MESSAGE } from '@/modules/manual-ai/prompts'
import { cn } from '@hikaru/ui'
import {
  Send, BookOpen, AlertTriangle, List,
  FileText, Sparkles, Trash2, Bot,
} from 'lucide-react'

// ============================================================
// AI回答セクション レンダラー
// ============================================================

function SectionBlock({ section }: { section: ResponseSection }) {
  if (!section.content.trim()) return null

  const sectionConfig = {
    answer:     { color: 'bg-[var(--color-primary-muted)]   border-[var(--color-primary)]/20',   icon: Sparkles,     titleColor: 'text-[var(--color-primary)]' },
    steps:      { color: 'bg-[var(--color-surface)]          border-[var(--color-border)]',       icon: List,         titleColor: 'text-[var(--color-foreground)]' },
    caution:    { color: 'bg-[var(--color-warning-muted)]    border-[var(--color-warning)]/30',   icon: AlertTriangle, titleColor: 'text-[var(--color-warning-foreground)]' },
    sources:    { color: 'bg-[var(--color-success-muted)]    border-[var(--color-success)]/20',   icon: BookOpen,     titleColor: 'text-[var(--color-success-foreground)]' },
    supplement: { color: 'bg-[var(--color-muted)]            border-[var(--color-border)]',       icon: FileText,     titleColor: 'text-[var(--color-muted-foreground)]' },
    text:       { color: 'bg-[var(--color-surface)]          border-transparent',                 icon: null,         titleColor: '' },
  }

  const config = sectionConfig[section.type]
  const Icon = config.icon

  return (
    <div className={cn('rounded-[var(--radius-lg)] border px-3 py-2.5', config.color)}>
      {section.title && Icon && (
        <div className={cn('flex items-center gap-1.5 mb-1.5', config.titleColor)}>
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="text-xs font-semibold">{section.title}</span>
        </div>
      )}
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{section.content}</p>
    </div>
  )
}

// ============================================================
// メッセージバブル
// ============================================================

function MessageBubble({
  message,
  isStreaming,
}: {
  message: ChatMessageRow & { streamingContent?: string }
  isStreaming?: boolean
}) {
  const isUser = message.role === 'user'
  const content = isStreaming ? (message.streamingContent ?? '') : message.content

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className={cn(
          'max-w-[80%] rounded-[var(--radius-xl)] rounded-br-[var(--radius-sm)]',
          'bg-[var(--color-primary)] text-white',
          'px-4 py-3 text-sm leading-relaxed'
        )}>
          {content}
        </div>
      </div>
    )
  }

  // AI回答
  const sections = parseAIResponse(content)

  return (
    <div className="flex gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-white mt-1">
        <Bot className="h-4 w-4" />
      </span>
      <div className="flex-1 min-w-0 space-y-2">
        {sections.map((s, i) => (
          <SectionBlock key={i} section={s} />
        ))}
        {isStreaming && !content && (
          <div className="flex gap-1 items-center px-3 py-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-2 w-2 rounded-full bg-[var(--color-muted-foreground)] animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        )}
        {/* ソース */}
        {message.sources && message.sources.length > 0 && !isStreaming && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {message.sources.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 rounded-[var(--radius-full)] bg-[var(--color-muted)] px-2 py-0.5 text-[10px] text-[var(--color-muted-foreground)]"
              >
                <BookOpen className="h-2.5 w-2.5" />
                {s}
              </span>
            ))}
          </div>
        )}
        <p className="text-[10px] text-[var(--color-subtle)] pl-1">
          {new Date(message.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

// ============================================================
// ウェルカムメッセージ（初回表示）
// ============================================================

function WelcomeMessage() {
  const sections = parseAIResponse('')
  return (
    <div className="flex gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-white mt-1">
        <Bot className="h-4 w-4" />
      </span>
      <div className={cn(
        'flex-1 rounded-[var(--radius-xl)] rounded-bl-[var(--radius-sm)]',
        'bg-[var(--color-surface)] border border-[var(--color-border)]',
        'px-4 py-3'
      )}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-[var(--color-foreground)]">
          {WELCOME_MESSAGE}
        </p>
      </div>
    </div>
  )
}

// ============================================================
// メインページ
// ============================================================

const QUICK_QUESTIONS = [
  '清掃手順を教えてください',
  '注意事項はありますか？',
  '使用できる洗剤は？',
  '厨房の清掃方法は？',
]

export default function ChatPage() {
  const { jobId: projectId } = useParams<{ jobId: string }>()
  const [messages, setMessages] = React.useState<(ChatMessageRow & { streamingContent?: string })[]>([])
  const [input, setInput] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [projectName, setProjectName] = React.useState('')
  const [jobId, setJobId] = React.useState<string | undefined>()
  const [historyLoaded, setHistoryLoaded] = React.useState(false)
  const bottomRef = React.useRef<HTMLDivElement>(null)
  const inputRef  = React.useRef<HTMLTextAreaElement>(null)

  // 初期化
  React.useEffect(() => {
    async function init() {
      const supabase = createClient()

      // プロジェクト名取得
      const { data: project } = await supabase
        .from('projects')
        .select('name')
        .eq('id', projectId)
        .single()
      if (project) setProjectName(project.name)

      // 今日のJob取得（チャット保存に使用）
      const job = await getTodayJob(projectId)
      if (job) setJobId(job.id)

      // 履歴ロード
      const history = await loadChatHistory(projectId, 30)
      setMessages(history)
      setHistoryLoaded(true)
    }
    init()
  }, [projectId])

  // 自動スクロール
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 送信処理
  async function handleSend(text?: string) {
    const question = (text ?? input).trim()
    if (!question || isLoading) return

    setInput('')
    setIsLoading(true)

    // ユーザーメッセージを即時追加
    const userMsg: ChatMessageRow = {
      id:         `temp-user-${Date.now()}`,
      role:       'user',
      content:    question,
      sources:    null,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])

    // AI返答プレースホルダー
    const aiMsgId = `temp-ai-${Date.now()}`
    const aiPlaceholder: ChatMessageRow & { streamingContent: string } = {
      id:               aiMsgId,
      role:             'assistant',
      content:          '',
      streamingContent: '',
      sources:          null,
      created_at:       new Date().toISOString(),
    }
    setMessages((prev) => [...prev, aiPlaceholder])

    // 会話履歴（直近10件）
    const chatHistory = messages.slice(-10).map((m) => ({
      role:    m.role,
      content: m.content,
    }))

    try {
      await sendChatMessage({
        projectId,
        message: question,
        chatHistory,
        jobId,
        callbacks: {
          onChunk: (chunk) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId
                  ? { ...m, streamingContent: (m.streamingContent ?? '') + chunk }
                  : m
              )
            )
          },
          onDone: (sources) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId
                  ? {
                      ...m,
                      content:          m.streamingContent ?? '',
                      streamingContent: undefined,
                      sources,
                    }
                  : m
              )
            )
            setIsLoading(false)
          },
          onError: (errMsg) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === aiMsgId
                  ? {
                      ...m,
                      content:          `エラー: ${errMsg}`,
                      streamingContent: undefined,
                    }
                  : m
              )
            )
            setIsLoading(false)
          },
        },
      })
    } catch {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const hasMessages = messages.length > 0

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--color-background)]">
      {/* ヘッダー */}
      <WorkerHeader
        title="AIアシスタント"
        showBack
        rightAction={
          <div className="flex items-center gap-1.5 rounded-[var(--radius-full)] bg-[var(--color-primary-muted)] px-2.5 py-1">
            <Sparkles className="h-3.5 w-3.5 text-[var(--color-primary)]" />
            <span className="text-xs font-medium text-[var(--color-primary)]">HIKARU AI</span>
          </div>
        }
      />

      {/* プロジェクト名バー */}
      {projectName && (
        <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 py-2 flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5 text-[var(--color-muted-foreground)] shrink-0" />
          <span className="text-xs text-[var(--color-muted-foreground)] truncate">{projectName} のマニュアルを参照中</span>
        </div>
      )}

      {/* メッセージエリア */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-2">
        {!historyLoaded ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            <WelcomeMessage />
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isStreaming={msg.streamingContent !== undefined}
              />
            ))}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* クイック質問 (履歴が空の場合) */}
      {historyLoaded && !hasMessages && (
        <div className="px-4 pb-2">
          <p className="text-xs text-[var(--color-muted-foreground)] mb-2">よく使われる質問</p>
          <div className="grid grid-cols-2 gap-1.5">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => handleSend(q)}
                disabled={isLoading}
                className={cn(
                  'text-left text-xs rounded-[var(--radius-lg)] px-3 py-2.5',
                  'bg-[var(--color-surface)] border border-[var(--color-border)]',
                  'text-[var(--color-foreground)]',
                  'active:bg-[var(--color-muted)] transition-colors',
                  'disabled:opacity-50'
                )}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 入力エリア（固定フッター） */}
      <div className="sticky bottom-0 bg-[var(--color-surface)]/95 backdrop-blur-md border-t border-[var(--color-border)] px-4 pt-3 pb-safe pb-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="質問を入力してください…"
            rows={1}
            disabled={isLoading}
            className={cn(
              'flex-1 resize-none rounded-[var(--radius-xl)]',
              'border border-[var(--color-border)] bg-[var(--color-muted)]',
              'px-4 py-3 text-sm text-[var(--color-foreground)]',
              'placeholder:text-[var(--color-subtle)]',
              'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent',
              'disabled:opacity-50',
              'max-h-32 overflow-y-auto'
            )}
            style={{ height: 'auto', minHeight: '48px' }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = `${Math.min(el.scrollHeight, 128)}px`
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-full',
              'transition-all active:scale-90',
              input.trim() && !isLoading
                ? 'bg-[var(--color-primary)] text-white shadow-[var(--shadow-md)]'
                : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
              'disabled:cursor-not-allowed'
            )}
            aria-label="送信"
          >
            {isLoading ? (
              <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-[var(--color-subtle)]">
          Enterで送信 / Shift+Enterで改行
        </p>
      </div>
    </div>
  )
}
