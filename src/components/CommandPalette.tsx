import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { tr } from '../../shared/locale'
import { ingredients, labs, terms, topics } from '../content'

interface Hit {
  id: string
  kind: 'Тема' | 'Занятие' | 'Сырьё' | 'Термин'
  title: string
  sub: string
  to: string
  search: string
}

/** Глобальный быстрый поиск по всей платформе (Ctrl + K / Cmd + K). */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const index = useMemo<Hit[]>(() => [
    ...topics.map((t) => ({
      id: `t:${t.id}`,
      kind: 'Тема' as const,
      title: t.title,
      sub: t.summary,
      to: `/topics/${t.id}`,
      search: `${t.title} ${t.summary} ${t.domain} ${(t.questions ?? []).join(' ')}`.toLowerCase(),
    })),
    ...labs.map((l) => ({
      id: `l:${l.id}`,
      kind: 'Занятие' as const,
      title: l.title,
      sub: `${l.role} · ${l.minutes} ${tr('мин')}`,
      to: `/labs/${l.id}`,
      search: `${l.title} ${l.summary} ${l.role} ${l.skill}`.toLowerCase(),
    })),
    ...ingredients.map((ing) => ({
      id: `i:${ing.id}`,
      kind: 'Сырьё' as const,
      title: `${ing.name} (${ing.inci})`,
      sub: `${tr('Фаза')} ${ing.recommendedPhase} · ${ing.typicalRange[0]}–${ing.typicalRange[1]} % · ${ing.note}`,
      to: `/sandbox?add=${encodeURIComponent(ing.id)}`,
      search: `${ing.name} ${ing.inci} ${ing.note} ${ing.role} фаза phase ${ing.recommendedPhase}`.toLowerCase(),
    })),
    ...terms.map((g) => ({
      id: `g:${g.id}`,
      kind: 'Термин' as const,
      title: g.en ? `${g.term} (${g.en})` : g.term,
      sub: g.short,
      to: `/glossary/${g.id}`,
      search: `${g.term} ${g.en ?? ''} ${g.short}`.toLowerCase(),
    })),
  ], [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      return [
        { id: 'q:sandbox', kind: 'Занятие' as const, title: tr('Лаборатория рецептур и фаз'), sub: tr('Конструктор, 5 стадий варки, ГЛБ и лимиты ТР ТС / EU'), to: '/sandbox', search: '' },
        { id: 'q:reactions', kind: 'Занятие' as const, title: tr('Реакции и механизмы'), sub: tr('RK4-моделирование органических и коллоидных реакций косметики'), to: '/reactions', search: '' },
        { id: 'q:map', kind: 'Тема' as const, title: tr('Карта знаний'), sub: tr('Все разделы, темы и практические тренажёры'), to: '/map', search: '' },
        { id: 'q:catalog', kind: 'Тема' as const, title: tr('Каталог и поиск по материалам'), sub: tr('Фильтр всех тем, терминов, источников и занятий'), to: '/catalog', search: '' },
        { id: 'q:portfolio', kind: 'Занятие' as const, title: tr('Карта компетенций и портфолио'), sub: tr('Профиль по 6 направлениям и сохранённые рецептуры'), to: '/portfolio', search: '' },
        ...labs.slice(0, 5).map((l) => ({
          id: `ql:${l.id}`,
          kind: 'Занятие' as const,
          title: l.title,
          sub: `${l.role} · ${l.minutes} ${tr('мин')}`,
          to: `/labs/${l.id}`,
          search: '',
        })),
      ]
    }
    const tokens = q.split(/\s+/).filter(Boolean)
    return index
      .filter((h) => tokens.every((tk) => h.search.includes(tk)))
      .slice(0, 14)
  }, [index, query])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setCursor(0)
    const id = window.setTimeout(() => inputRef.current?.focus(), 10)
    return () => window.clearTimeout(id)
  }, [open])

  useEffect(() => {
    setCursor(0)
  }, [query])

  if (!open) return null

  function go(hit: Hit) {
    onClose()
    nav(hit.to)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => (results.length ? (c + 1) % results.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => (results.length ? (c - 1 + results.length) % results.length : 0))
    } else if (e.key === 'Enter' && results[cursor]) {
      e.preventDefault()
      go(results[cursor])
    }
  }

  return (
    <div className="cmdk-backdrop" role="presentation" onClick={onClose}>
      <div
        className="cmdk-modal"
        role="dialog"
        aria-modal="true"
        aria-label={tr('Быстрый поиск по платформе')}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="cmdk-head">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr('Найти тему, занятие, сырьё INCI или термин…')}
            aria-label={tr('Быстрый поиск')}
          />
          <button type="button" className="btn small ghost" onClick={onClose}>Esc</button>
        </div>
        {results.length === 0 ? (
          <p className="small muted cmdk-empty">{tr('Ничего не найдено. Попробуйте другой запрос или INCI-название.')}</p>
        ) : (
          <ul className="cmdk-list" role="listbox">
            {results.map((h, i) => (
              <li key={h.id} role="option" aria-selected={i === cursor}>
                <button
                  type="button"
                  className={i === cursor ? 'on' : ''}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(h)}
                >
                  <span className={`kindtag k-${h.kind}`}>{tr(h.kind)}</span>
                  <span className="cmdk-txt">
                    <b>{h.title}</b>
                    <span className="small">{h.sub}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="cmdk-foot small muted">
          {tr('↑↓ выбор · Enter открыть · Esc закрыть · клик по сырью сразу добавит его в Лабораторию')}
        </p>
      </div>
    </div>
  )
}
