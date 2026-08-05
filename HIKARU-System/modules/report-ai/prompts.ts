// ============================================================
// AI報告書（report-ai）プロンプト定義
// ============================================================

export interface SpotInput {
  name: string
  score: number | null
  recommendation: 'pass' | 'check' | 'redo' | null
  comparison: string | null       // AI比較コメント（品質評価から）
  remaining_issues: string[]      // 残課題
  improvements: string[]          // 改善提案
}

export const REPORT_GENERATION_PROMPT = (
  storeName: string,
  clientName: string,
  workDate: string,
  workerName: string,
  spots: SpotInput[],
  overallScore: number
): string => `
あなたはHIKARUの清掃品質報告書を作成するAIです。
以下の情報をもとに、クライアント企業へ提出できる品質の報告書コンテンツを生成してください。

【作業情報】
- 店舗名: ${storeName}
- クライアント: ${clientName}
- 作業日: ${workDate}
- 担当者: ${workerName}
- 総合品質スコア: ${overallScore}点

【各撮影箇所の評価データ】
${spots.map((s, i) => `
${i + 1}. 【${s.name}】
   - スコア: ${s.score ?? '評価なし'}点
   - 判定: ${s.recommendation === 'pass' ? '合格' : s.recommendation === 'check' ? '要確認' : s.recommendation === 'redo' ? '再清掃推奨' : '未評価'}
   - AI比較コメント: ${s.comparison ?? 'なし'}
   - 残課題: ${s.remaining_issues.length > 0 ? s.remaining_issues.join('、') : 'なし'}
   - 改善提案: ${s.improvements.length > 0 ? s.improvements.join('、') : 'なし'}
`).join('')}

【出力要件】
- 文体: クライアント企業へ提出する正式文書として丁寧・専門的に
- 日本語で回答
- 事実に基づき、誇張せず正確に記述
- 問題がある箇所は誠実に記述し、改善への取り組みも示す

【必ずJSON形式で回答】
{
  "work_summary": "本日の清掃作業の概要（2-3文。実施した場所・主な作業内容を含める）",
  "quality_assessment": "品質評価の総括（スコアを踏まえた具体的な評価。2-3文）",
  "spot_comments": {
    "${spots[0]?.name ?? ''}": "この箇所の清掃品質コメント（1-2文。具体的な改善内容を含める）"
    ${spots.slice(1).map(s => `,"${s.name}": "この箇所のコメント（1-2文）"`).join('\n    ')}
  },
  "total_comment": "全体を通した総合評価コメント（3-4文。スコアと改善点、今後の方針も含める）",
  "next_recommendations": ["次回作業への推奨事項1", "推奨事項2"]
}
`.trim()
