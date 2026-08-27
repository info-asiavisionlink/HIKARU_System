import { createOpenAIClient, OPENAI_MODELS } from '@/lib/openai/client'
import { PHOTO_QUALITY_CHECK_PROMPT, BEFORE_AFTER_EVALUATION_PROMPT } from './prompts'

// ============================================================
// 品質評価の合格ライン（変更はここのみ）
// ============================================================
export const QUALITY_PASS_THRESHOLD = 75
export const QUALITY_CHECK_THRESHOLD = 60

// ============================================================
// 型定義
// ============================================================

export interface PhotoQualityResult {
  isValid: boolean
  issues: string[]
  message: string
}

export interface ValidationResult {
  isCleaningScene: boolean
  matchesSpot:     boolean
  sameLocation:    boolean
  comparable:      boolean
  imageQualityOk:  boolean
  confidence:      number
  issues:          string[]
}

export interface SpotEvaluationResult {
  evaluationPossible: boolean
  validation?: ValidationResult
  photoQuality: {
    beforeValid: boolean
    afterValid: boolean
    issues: string[]
  }
  beforeAnalysis: {
    summary: string
    dirtyPoints: string[]
    dirtLevel: 'severe' | 'moderate' | 'light' | 'clean'
  }
  afterAnalysis: {
    summary: string
    improvements: string[]
    remainingIssues: string[]
  }
  comparison: string
  score: number
  breakdown: {
    dirtyRemoval: number
    thoroughness: number
    shine: number
  }
  passed: boolean
  recommendation: 'pass' | 'check' | 'redo'
  comment: string
  improvements: string[]
}

// ============================================================
// 写真品質チェック
// ============================================================

export async function checkPhotoQuality(
  photoUrl: string,
  locationName: string
): Promise<PhotoQualityResult> {
  const openai = createOpenAIClient()

  const response = await openai.chat.completions.create({
    model: OPENAI_MODELS.VISION,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: photoUrl, detail: 'low' } },
          { type: 'text', text: PHOTO_QUALITY_CHECK_PROMPT(locationName) },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 400,
    temperature: 0.1,
  })

  const raw = response.choices[0]?.message.content ?? '{}'
  const parsed = JSON.parse(raw)

  return {
    isValid: parsed.isValid ?? false,
    issues:  parsed.issues  ?? [],
    message: parsed.message ?? '',
  }
}

// ============================================================
// Before/After 比較評価
// ============================================================

export async function evaluateBeforeAfter(
  beforeUrl: string,
  afterUrl: string,
  locationName: string,
  spotDescription?: string,
  manualContext?: string,
): Promise<SpotEvaluationResult> {
  const openai = createOpenAIClient()

  const response = await openai.chat.completions.create({
    model: OPENAI_MODELS.VISION,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: '【Before（清掃前）】' },
          { type: 'image_url', image_url: { url: beforeUrl, detail: 'high' } },
          { type: 'text', text: '【After（清掃後）】' },
          { type: 'image_url', image_url: { url: afterUrl, detail: 'high' } },
          { type: 'text', text: BEFORE_AFTER_EVALUATION_PROMPT(locationName, spotDescription, manualContext) },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 1500,
    temperature: 0.2,
  })

  const raw    = response.choices[0]?.message.content ?? '{}'
  const parsed = JSON.parse(raw)

  // ── Validation Gate（Fail-closed）─────────────────────────
  // AI応答に evaluationPossible がなければ保存禁止（Fail-closed）
  const evaluationPossible: boolean =
    typeof parsed.evaluationPossible === 'boolean' ? parsed.evaluationPossible : false

  const validation: ValidationResult = parsed.validation ?? {
    isCleaningScene: false,
    matchesSpot:     false,
    sameLocation:    false,
    comparable:      false,
    imageQualityOk:  false,
    confidence:      0,
    issues:          ['AI応答にValidation情報がありません'],
  }

  if (!evaluationPossible) {
    return {
      evaluationPossible: false,
      validation,
      photoQuality:   { beforeValid: false, afterValid: false, issues: validation.issues },
      beforeAnalysis: { summary: '', dirtyPoints: [], dirtLevel: 'moderate' },
      afterAnalysis:  { summary: '', improvements: [], remainingIssues: [] },
      comparison:     '',
      score:          0,  // 型互換用プレースホルダ。APIレイヤでDBへは保存しない
      breakdown:      { dirtyRemoval: 0, thoroughness: 0, shine: 0 },
      passed:         false,
      recommendation: 'redo',
      comment:        '',
      improvements:   [],
    }
  }

  // ── Validation OK → 清掃品質評価 ──────────────────────────
  const score = Math.max(0, Math.min(100, Number(parsed.score ?? 0)))
  const passed = score >= QUALITY_PASS_THRESHOLD

  const recommendation: SpotEvaluationResult['recommendation'] =
    score >= QUALITY_PASS_THRESHOLD ? 'pass' :
    score >= QUALITY_CHECK_THRESHOLD ? 'check' : 'redo'

  return {
    evaluationPossible: true,
    validation,
    photoQuality: {
      beforeValid: parsed.photoQuality?.beforeValid ?? true,
      afterValid:  parsed.photoQuality?.afterValid  ?? true,
      issues:      parsed.photoQuality?.issues ?? [],
    },
    beforeAnalysis: {
      summary:    parsed.beforeAnalysis?.summary    ?? '',
      dirtyPoints: parsed.beforeAnalysis?.dirtyPoints ?? [],
      dirtLevel:  parsed.beforeAnalysis?.dirtLevel  ?? 'moderate',
    },
    afterAnalysis: {
      summary:        parsed.afterAnalysis?.summary        ?? '',
      improvements:   parsed.afterAnalysis?.improvements   ?? [],
      remainingIssues: parsed.afterAnalysis?.remainingIssues ?? [],
    },
    comparison:  parsed.comparison ?? '',
    score,
    breakdown: {
      dirtyRemoval: Math.max(0, Math.min(100, Number(parsed.breakdown?.dirtyRemoval ?? score))),
      thoroughness: Math.max(0, Math.min(100, Number(parsed.breakdown?.thoroughness ?? score))),
      shine:        Math.max(0, Math.min(100, Number(parsed.breakdown?.shine        ?? score))),
    },
    passed,
    recommendation,
    comment:      parsed.comment      ?? '',
    improvements: parsed.improvements ?? [],
  }
}

// ============================================================
// スコアからUI表示用データを計算
// ============================================================

export function getScoreDisplay(score: number): {
  stars: number
  label: string
  color: string
} {
  if (score >= 90) return { stars: 5, label: '素晴らしい',  color: 'success' }
  if (score >= 75) return { stars: 4, label: '良好',       color: 'success' }
  if (score >= 60) return { stars: 3, label: '普通',       color: 'warning' }
  if (score >= 45) return { stars: 2, label: '要改善',     color: 'warning' }
  return              { stars: 1, label: '不合格',      color: 'error' }
}

export function getRecommendationLabel(rec: 'pass' | 'check' | 'redo'): string {
  return rec === 'pass'  ? '合格'     :
         rec === 'check' ? '要確認'   : '再清掃推奨'
}
