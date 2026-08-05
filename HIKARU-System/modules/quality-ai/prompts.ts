// ============================================================
// AI品質管理（quality-ai）プロンプト定義
// プロンプトの変更はこのファイルのみ
// ============================================================

// ---- 写真品質チェック ----
export const PHOTO_QUALITY_CHECK_PROMPT = (locationName: string): string => `
あなたは清掃品質管理の専門家AIです。
「${locationName}」の写真が品質評価に使用できるかチェックしてください。

【確認項目】
- 明るさ: 暗すぎて見えない、または白飛びしていないか
- ピント: 対象物にピントが合っているか
- ブレ: 手ブレや動きブレがないか
- 撮影範囲: 対象箇所全体が適切に写っているか
- 解像度: 汚れの有無が判断できる十分な画質か
- 構図: 評価に適した角度・距離から撮影されているか

【必ずJSON形式で回答すること】
{
  "isValid": true か false,
  "issues": ["問題点1", "問題点2"],
  "message": "NGの場合: 撮り直しの具体的な指示。OKの場合: 空文字列"
}
`.trim()

// ---- Before/After比較評価 ----
export const BEFORE_AFTER_EVALUATION_PROMPT = (locationName: string): string => `
あなたは清掃業界の品質管理専門AIです。
「${locationName}」の清掃前（Before）と清掃後（After）の写真を比較し、品質を評価してください。

【評価の視点】
熟練した品質管理者の目で以下を確認してください:
1. 汚れの除去度: ホコリ・油汚れ・水垢・黒ずみ・シミ・ゴミ・カビ
2. 清掃の丁寧さ: 細部・隅・端まで清掃されているか
3. 仕上がり・光沢: 清掃後の光沢・清潔感・見た目の改善
4. 清掃漏れ: 見落としている箇所がないか
5. 傷・破損: 清掃により傷や汚れが付いていないか

【スコア基準】
- 90-100点: 非常に良好。どこから見ても清潔で光沢がある
- 75-89点: 良好。概ね清潔で合格基準を満たす
- 60-74点: 普通。改善の余地あり、一部清掃漏れあり
- 45-59点: 要改善。明らかな清掃漏れや汚れの残留あり
- 0-44点: 不合格。再清掃が必要

【必ずJSON形式で回答すること】
{
  "photoQuality": {
    "beforeValid": true,
    "afterValid": true,
    "issues": []
  },
  "beforeAnalysis": {
    "summary": "Before写真の状態説明（1-2文）",
    "dirtyPoints": ["ホコリが堆積している", "油汚れあり"],
    "dirtLevel": "severe または moderate または light または clean"
  },
  "afterAnalysis": {
    "summary": "After写真の状態説明（1-2文）",
    "improvements": ["ホコリを完全に除去", "光沢が出た"],
    "remainingIssues": ["左下コーナーにわずかなホコリが残留"]
  },
  "comparison": "BeforeとAfterを比較した具体的なコメント（2-3文。何が改善され、何が残っているかを明記）",
  "score": 0から100の整数,
  "breakdown": {
    "dirtyRemoval": 汚れ除去度 0-100の整数,
    "thoroughness": 丁寧さ・細部への対応 0-100の整数,
    "shine": 光沢・清潔感 0-100の整数
  },
  "passed": 75点以上ならtrue,
  "recommendation": "pass または check または redo",
  "comment": "作業者への総合評価コメント（日本語・具体的に・2-3文）",
  "improvements": ["改善提案1", "改善提案2"]
}
`.trim()
