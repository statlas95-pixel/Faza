import { useEffect, useState } from 'react'
import { tr } from '../../shared/locale'
import { deleteNote, saveNote, useProgress } from '../store'

interface NoteBoxProps {
  noteId: string
  kind: 'topic' | 'ingredient' | 'formula'
  targetId: string
  title: string
  placeholder?: string
  onSaved?: () => void
}

/** Личный блокнот технолога (хранится в Progress.notes, синхронизируется с облаком и бэкапом JSON). */
export function NoteBox({ noteId, kind, targetId, title, placeholder, onSaved }: NoteBoxProps) {
  const p = useProgress()
  const existing = p.notes[noteId]
  const [open, setOpen] = useState(() => !!existing?.text)
  const [draft, setDraft] = useState(() => existing?.text ?? '')
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    setDraft(existing?.text ?? '')
    if (existing?.text) setOpen(true)
  }, [noteId, existing?.text])

  function handleSave() {
    saveNote({ id: noteId, kind, targetId, title, text: draft })
    setSavedFlash(true)
    onSaved?.()
    setTimeout(() => setSavedFlash(false), 1600)
  }

  function handleClear() {
    setDraft('')
    deleteNote(noteId)
  }

  return (
    <section className="panel note-box no-print" aria-label={tr('Заметки технолога')}>
      <div className="sandbox-head-row">
        <div>
          <span className="eyebrow">✎ {tr('Личный лабораторный журнал')}</span>
          <h3 style={{ margin: '2px 0 0', fontSize: '1.02rem' }}>{tr('Заметка технолога')}</h3>
        </div>
        <button type="button" className="btn small ghost" onClick={() => setOpen((v) => !v)}>
          {open ? tr('Свернуть') : existing ? tr('Открыть заметку') : tr('+ Добавить заметку')}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 10 }}>
          <textarea
            rows={3}
            value={draft}
            placeholder={placeholder ?? tr('Запишите рабочие наблюдения: нюансы поставщика сырья, режим ввода, удачные пропорции или вопросы на проверку…')}
            onChange={(e) => setDraft(e.target.value)}
            style={{ width: '100%', resize: 'vertical' }}
          />
          <div className="row" style={{ marginTop: 8, justifyContent: 'space-between' }}>
            <span className="small muted">
              {savedFlash
                ? tr('✓ Заметка сохранена в журнале')
                : existing?.at
                  ? `${tr('Обновлено:')} ${new Date(existing.at).toLocaleDateString()}`
                  : tr('Сохраняется локально, в аккаунте и в резервной копии JSON')}
            </span>
            <div className="row">
              {existing && (
                <button type="button" className="btn small ghost" onClick={handleClear}>
                  {tr('Удалить')}
                </button>
              )}
              <button type="button" className="btn small primary" onClick={handleSave}>
                {tr('Сохранить заметку')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
