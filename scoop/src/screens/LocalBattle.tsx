import { useCallback, useRef, useState } from 'react'
import { AiQuestLoadingOverlay } from '../components/AiQuestLoadingOverlay'
import { judgeBattle, generateAiQuest } from '../ai/scoring'
import { compressImageToDataUrl } from '../lib/image'
import { randomStaticQuest } from '../quests/static'
import { useAppI18n } from '../settings/useAppI18n'
import type { BattleJudgeResult, QuestSpec } from '../types'

type Step = 1 | 2 | 3

export function LocalBattle({ onBack }: { onBack: () => void }) {
  const { t, settings, locale } = useAppI18n()
  const [quest, setQuest] = useState<QuestSpec>(() => randomStaticQuest(locale, null))
  const [step, setStep] = useState<Step>(1)
  const [p1Text, setP1Text] = useState('')
  const [p1Img, setP1Img] = useState<string | null>(null)
  const [p2Text, setP2Text] = useState('')
  const [p2Img, setP2Img] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [aiQuestLoading, setAiQuestLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [judge, setJudge] = useState<BattleJudgeResult | null>(null)
  const recentAiQuestsRef = useRef<string[]>([])

  const nextStatic = useCallback(() => {
    setQuest((q) => randomStaticQuest(locale, q))
    setStep(1)
    setP1Text('')
    setP1Img(null)
    setP2Text('')
    setP2Img(null)
    setJudge(null)
    setErr(null)
  }, [locale])

  const aiQuest = useCallback(async () => {
    setErr(null)
    if (!settings.apiKey.trim()) {
      setErr(t.needApiKey)
      return
    }
    setAiQuestLoading(true)
    try {
      const q = await generateAiQuest(settings, locale, {
        avoidTexts: recentAiQuestsRef.current,
      })
      recentAiQuestsRef.current = [q.text, ...recentAiQuestsRef.current].slice(0, 8)
      setQuest(q)
      setStep(1)
      setP1Text('')
      setP1Img(null)
      setP2Text('')
      setP2Img(null)
      setJudge(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errorGeneric)
    } finally {
      setAiQuestLoading(false)
    }
  }, [settings, locale, t])

  const onPick = useCallback(async (file: File | null, player: 1 | 2) => {
    if (!file) return
    try {
      const url = await compressImageToDataUrl(file)
      if (player === 1) setP1Img(url)
      else setP2Img(url)
    } catch {
      setErr(t.errorGeneric)
    }
  }, [t])

  const lockP1 = useCallback(() => {
    if (quest.preferPhoto && !p1Img) {
      setErr(t.submitNeedPhoto)
      return
    }
    if (!quest.preferPhoto && !p1Text.trim()) {
      setErr(t.submitNeedText)
      return
    }
    setStep(2)
    setErr(null)
  }, [quest.preferPhoto, p1Img, p1Text, t])

  const runJudge = useCallback(async () => {
    setErr(null)
    if (!settings.apiKey.trim()) {
      setErr(t.needApiKey)
      return
    }
    if (quest.preferPhoto && (!p1Img || !p2Img)) {
      setErr(t.submitNeedPhoto)
      return
    }
    if (!quest.preferPhoto && (!p1Text.trim() || !p2Text.trim())) {
      setErr(t.submitNeedText)
      return
    }
    setBusy(true)
    try {
      const players = quest.preferPhoto
        ? [
            { id: 'p1', name: t.player1, text: '', imageDataUrl: p1Img },
            { id: 'p2', name: t.player2, text: '', imageDataUrl: p2Img },
          ]
        : [
            { id: 'p1', name: t.player1, text: p1Text, imageDataUrl: null },
            { id: 'p2', name: t.player2, text: p2Text, imageDataUrl: null },
          ]
      const result = await judgeBattle({
        settings,
        locale,
        quest,
        players,
      })
      setJudge(result)
      setStep(3)
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errorGeneric)
    } finally {
      setBusy(false)
    }
  }, [settings, locale, quest, p1Text, p1Img, p2Text, p2Img, t])

  const blockUi = busy || aiQuestLoading

  return (
    <div className="app">
      <AiQuestLoadingOverlay open={aiQuestLoading} message={t.aiQuestLoading} />
      <header className="header">
        <button type="button" className="linkish" onClick={onBack}>
          ← {t.back}
        </button>
        <p className="eyebrow">Local</p>
        <h1 className="title">{t.localTitle}</h1>
        <p className="lede">{t.localIntro}</p>
      </header>

      <main className="card">
        <p className="quest-label">{t.questLabel}</p>
        <p className="quest">{quest.text}</p>
        {quest.preferPhoto ? (
          <p className="photo-hint">{t.questPhotoOnly}</p>
        ) : (
          <p className="muted small">{t.questTextOnly}</p>
        )}

        <div className="actions">
          <button type="button" className="btn ghost" onClick={nextStatic} disabled={blockUi}>
            {t.newQuest}
          </button>
          <button type="button" className="btn ghost" onClick={() => void aiQuest()} disabled={blockUi}>
            {t.aiQuest}
          </button>
        </div>

        {step === 1 && (
          <>
            <h3 className="subhead">{t.player1}</h3>
            {quest.preferPhoto ? (
              <label className="field">
                <span className="field-label">{t.photoProofLabel}</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => void onPick(e.target.files?.[0] ?? null, 1)}
                />
              </label>
            ) : (
              <label className="field">
                <span className="field-label">{t.yourAnswer}</span>
                <textarea
                  className="textarea"
                  rows={3}
                  value={p1Text}
                  onChange={(e) => setP1Text(e.target.value)}
                  maxLength={2000}
                />
              </label>
            )}
            <div className="actions">
              <button type="button" className="btn primary" onClick={lockP1}>
                {t.nextPlayer}
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h3 className="subhead">{t.player2}</h3>
            {quest.preferPhoto ? (
              <label className="field">
                <span className="field-label">{t.photoProofLabel}</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => void onPick(e.target.files?.[0] ?? null, 2)}
                />
              </label>
            ) : (
              <label className="field">
                <span className="field-label">{t.yourAnswer}</span>
                <textarea
                  className="textarea"
                  rows={3}
                  value={p2Text}
                  onChange={(e) => setP2Text(e.target.value)}
                  maxLength={2000}
                />
              </label>
            )}
            <div className="actions">
              <button type="button" className="btn primary" onClick={() => void runJudge()} disabled={blockUi}>
                {busy ? t.analyzing : t.runJudge}
              </button>
            </div>
          </>
        )}

        {step === 3 && judge && (
          <div className="result-block">
            <p className="result-line">
              <strong>{t.battleResult}:</strong> {judge.summary}
            </p>
            <p className="result-line">
              <strong>{t.winner}:</strong>{' '}
              {judge.winnerId === 'tie'
                ? t.tie
                : judge.winnerId === 'p1'
                  ? t.player1
                  : t.player2}
            </p>
            <div className="split-feedback">
              <div>
                <strong>{t.player1}</strong> — {judge.byPlayer.p1?.score ?? '—'}:{' '}
                {judge.byPlayer.p1?.feedback}
              </div>
              <div>
                <strong>{t.player2}</strong> — {judge.byPlayer.p2?.score ?? '—'}:{' '}
                {judge.byPlayer.p2?.feedback}
              </div>
            </div>
            <div className="actions">
              <button type="button" className="btn primary" onClick={nextStatic} disabled={blockUi}>
                {t.newQuest}
              </button>
            </div>
          </div>
        )}

        {err && <p className="error">{err}</p>}
      </main>
    </div>
  )
}
