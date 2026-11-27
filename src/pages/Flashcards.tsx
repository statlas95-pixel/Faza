import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { language, tr } from '../../shared/locale'
import {
  FLASHCARDS,
  FLASHCARD_DECKS,
  getDueFlashcards,
  reviewCardSM2,
  type FlashcardDeckId,
} from '../../shared/flashcards'
import { update, useProgress } from '../store'
import { playTactile } from '../tactile'
import { useTitle } from './util'

export default function FlashcardsPage() {
  useTitle(tr('Флеш-тренажёр SM-2'))
  const en = language === 'en'
  const progress = useProgress()
  const [deck, setDeck] = useState<FlashcardDeckId | 'all'>('all')
  const [flipped, setFlipped] = useState(false)
  const [sessionReviewed, setSessionReviewed] = useState(0)

  const dueCards = useMemo(() => getDueFlashcards(progress.flashcards ?? {}, deck), [progress.flashcards, deck])
  const current = dueCards[0] ?? null

  const totalLearned = useMemo(
    () => Object.values(progress.flashcards ?? {}).filter((r) => r.reps >= 1).length,
    [progress.flashcards],
  )
  const masteredCount = useMemo(
    () => Object.values(progress.flashcards ?? {}).filter((r) => r.intervalDays >= 6).length,
    [progress.flashcards],
  )

  function rate(quality: 0 | 3 | 4 | 5) {
    if (!current) return
    playTactile(quality >= 4 ? 'ok' : 'tap')
    const nextRec = reviewCardSM2(progress.flashcards?.[current.id], quality)
    update((p) => {
      if (!p.flashcards) p.flashcards = {}
      p.flashcards[current.id] = nextRec
    })
    setFlipped(false)
    setSessionReviewed((n) => n + 1)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === 'Space') {
        e.preventDefault()
        setFlipped((v) => !v)
      } else if (flipped) {
        if (e.key === '1') rate(0)
        else if (e.key === '2') rate(3)
        else if (e.key === '3') rate(4)
        else if (e.key === '4') rate(5)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="page flashcards-page">
      <div className="sandbox-head-row">
        <div>
          <h1>{tr('Флеш-тренажёр · 120 карточек SM-2')}</h1>
          <p className="lead" style={{ marginBottom: 0 }}>
            {tr('3-минутные интервальные блицы по INCI, регуляторным лимитам EU/ТР ТС, диагностике брака и ключевым формулам технолога.')}
          </p>
        </div>
        <div className="row">
          <Link to="/portfolio" className="btn ghost">← {tr('К портфолио')}</Link>
          <Link to="/tools" className="btn ghost">🧰 {tr('Утилиты 2.0')}</Link>
        </div>
      </div>

      <div className="tools-kpi-row">
        <div className="tools-kpi">
          <span className="small muted">{tr('Всего карточек в базе')}</span>
          <b className="num">{FLASHCARDS.length}</b>
        </div>
        <div className="tools-kpi accent">
          <span className="small muted">{tr('К повторению сейчас')}</span>
          <b className="num">{dueCards.length}</b>
        </div>
        <div className="tools-kpi">
          <span className="small muted">{tr('Изучено / закреплено (≥ 6 дн.)')}</span>
          <b className="num">{totalLearned} / {masteredCount}</b>
        </div>
        <div className="tools-kpi">
          <span className="small muted">{tr('Повторено за сессию')}</span>
          <b className="num">{sessionReviewed}</b>
        </div>
      </div>

      <div className="tools-tabs" role="tablist" aria-label={tr('Выбор колоды карточек')}>
        <button type="button" role="tab" aria-selected={deck === 'all'} className={`chip ${deck === 'all' ? 'on' : ''}`} onClick={() => { setDeck('all'); setFlipped(false) }}>
          {tr('Все колоды')} ({FLASHCARDS.length})
        </button>
        {FLASHCARD_DECKS.map((d) => {
          const countDue = getDueFlashcards(progress.flashcards ?? {}, d.id).length
          return (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={deck === d.id}
              className={`chip ${deck === d.id ? 'on' : ''}`}
              onClick={() => { setDeck(d.id); setFlipped(false) }}
            >
              {en ? d.titleEn : d.titleRu} ({countDue})
            </button>
          )
        })}
      </div>

      {current ? (
        <section className="panel fc-stage" style={{ marginTop: 18 }}>
          <div className="fc-meta">
            <span className="chip">{en ? FLASHCARD_DECKS.find((d) => d.id === current.deck)?.titleEn : FLASHCARD_DECKS.find((d) => d.id === current.deck)?.titleRu}</span>
            <span className="small muted num">{current.id}</span>
          </div>

          <div
            className={`fc-card ${flipped ? 'is-flipped' : ''}`}
            role="button"
            tabIndex={0}
            aria-label={tr('Перевернуть карточку')}
            onClick={() => setFlipped((v) => !v)}
            onKeyDown={(e) => { if (e.key === 'Enter') setFlipped((v) => !v) }}
          >
            <div className="fc-face fc-front">
              <div className="small muted" style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>{tr('Вопрос')}</div>
              <h3>{en ? current.frontEn : current.frontRu}</h3>
              {(en ? current.hintEn : current.hintRu) && (
                <p className="small muted">{tr('Подсказка:')} {en ? current.hintEn : current.hintRu}</p>
              )}
              <span className="small muted fc-tap-cue">{tr('Нажмите на карточку или Space, чтобы увидеть ответ')}</span>
            </div>

            {flipped && (
              <div className="fc-face fc-back">
                <div className="small muted" style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>{tr('Инженерный ответ')}</div>
                <p className="fc-answer">{en ? current.backEn : current.backRu}</p>
                {current.topicId && (
                  <Link
                    to={`/topics/${current.topicId}`}
                    className="small"
                    onClick={(e) => e.stopPropagation()}
                  >
                    📖 {tr('Открыть тему в учебнике →')}
                  </Link>
                )}
              </div>
            )}
          </div>

          {flipped ? (
            <div className="fc-actions" role="group" aria-label={tr('Оценка запоминания SM-2')}>
              <button type="button" className="btn fc-btn-again" onClick={() => rate(0)}>
                <b>1 · {tr('Снова')}</b>
                <span className="small">1 {tr('дн.')}</span>
              </button>
              <button type="button" className="btn fc-btn-hard" onClick={() => rate(3)}>
                <b>2 · {tr('Трудно')}</b>
                <span className="small">SM-2</span>
              </button>
              <button type="button" className="btn primary fc-btn-good" onClick={() => rate(4)}>
                <b>3 · {tr('Хорошо')}</b>
                <span className="small">SM-2</span>
              </button>
              <button type="button" className="btn fc-btn-easy" onClick={() => rate(5)}>
                <b>4 · {tr('Легко')}</b>
                <span className="small">+EF</span>
              </button>
            </div>
          ) : (
            <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
              <button type="button" className="btn primary" onClick={() => setFlipped(true)}>
                {tr('Показать ответ')} (Space)
              </button>
            </div>
          )}
        </section>
      ) : (
        <section className="panel" style={{ marginTop: 18, textAlign: 'center', padding: 32 }}>
          <h2>✓ {tr('Все карточки в этой колоде повторены на сегодня!')}</h2>
          <p className="small muted">
            {tr('Алгоритм SM-2 запланировал следующие повторения по кривой забывания Эббингауза. Вы можете выбрать другую колоду или перейти к практике.')}
          </p>
          <div className="row" style={{ justifyContent: 'center', gap: 10, marginTop: 12 }}>
            <button type="button" className="btn ghost" onClick={() => setDeck('all')}>{tr('Проверить все колоды')}</button>
            <Link to="/sandbox" className="btn primary">{tr('Перейти в Лабораторию')}</Link>
          </div>
        </section>
      )}
    </div>
  )
}
