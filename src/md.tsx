import { tr } from '../shared/locale'
import MarkdownIt from 'markdown-it'
import katex from 'katex'
import { Fragment, useMemo } from 'react'
import { termById, sourceById, mediaUrl, mediaByFile } from './content'
import { widgets } from './widgets'

const mdi = new MarkdownIt({ html: true, linkify: false, typographer: false })
const mdSafe = new MarkdownIt({ html: false, linkify: false })
/** Рендер недоверенного текста (ответ модели): без HTML, метки [F1] превращаются в ссылки на фрагменты. */
export function renderSafe(text: string, frags: { id: string; title: string; path: string }[] = []) {
  return mdSafe.render(text).replace(/\[([FSML]\d+)\]/g, (m, id: string) => { const f = frags.find((x) => x.id === id); return f ? `<a class="cite frag" href="#${esc(f.path)}" data-tip="${esc(f.title)}">${id}</a>` : m })
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

const calloutTitle: Record<string, string> = {
  model: tr("Учебная модель и границы вывода"), decision: tr("К практике"), warn: tr("Внимание"),
}

export function shortAuthor(authors: string) {
  const first = authors.split(/[,(]/)[0].trim().split(' ')[0]
  return authors.includes(',') ? `${first}${tr(" и др.")}` : first
}

/** Markdown с расширениями платформы -> HTML. Синтаксис описан в docs/AUTHORING.md. */
export function renderMd(src: string): string {
  const blocks: string[] = []
  // :::deep Заголовок ... :::   :::model ... :::
  src = src.replace(/^:::(\w+)[ \t]*(.*)\r?\n([\s\S]*?)\r?\n:::[ \t]*$/gm, (_m, kind: string, title: string, body: string) => {
    const inner = renderMd(body)
    const html = kind === 'deep'
      ? `<details class="deep"><summary><span class="deep-tag">${esc(tr('Глубже'))}</span>${esc(title || tr("Подробности"))}</summary><div class="deep-body">${inner}</div></details>`
      : `<aside class="callout ${kind}"><div class="callout-h">${esc(title || calloutTitle[kind] || '')}</div>${inner}</aside>`
    blocks.push(html)
    return `\n\n@@BLOCK${blocks.length - 1}@@\n\n`
  })
  src = src.replace(/^(#{2,4}) (.+?) \{#([\w-]+)\}[ \t]*$/gm, (_m, h: string, t: string, id: string) => `<h${h.length} id="${id}">${t}</h${h.length}>\n`)
  const maths: string[] = []
  const tex = (t: string, display: boolean) => {
    try { maths.push(katex.renderToString(t, { displayMode: display, throwOnError: false, output: 'html' })) }
    catch { maths.push(esc(t)) }
    return `@@MATH${maths.length - 1}@@`
  }
  src = src.replace(/\$\$([\s\S]+?)\$\$/g, (_m, t) => tex(t, true)).replace(/\$([^$\n]+?)\$/g, (_m, t) => tex(t, false))
  // термины
  src = src.replace(/(^|\| ?|\n)?\[\[([\w-]+)(?:\|([^\]]+))?\]\]/g, (_m, pre: string | undefined, id: string, text?: string) => {
    const t = termById(id)
    if (!t) return `${pre ?? ''}<span class="broken">[[${id}]]</span>`
    const label = text ?? (pre !== undefined ? t.term : t.term.charAt(0).toLowerCase() + t.term.slice(1))
    return `${pre ?? ''}<a class="term" href="#/glossary/${id}" data-tip="${esc(t.short)}">${label}</a>`
  })
  // ссылки на источники
  src = src.replace(/\[@([^\]]+)\]/g, (_m, list: string) => {
    const links = list.split(';').map((x) => x.trim().replace(/^@/, '')).map((id) => {
      const s = sourceById(id)
      return s
        ? `<a class="cite" href="#/sources/${id}" data-tip="${esc(s.title)}">${esc(shortAuthor(s.authors))}, ${s.year.toString().slice(0, 4)}</a>`
        : `<span class="broken">[@${id}]</span>`
    })
    return `<span class="cites">${links.join('')}</span>`
  })
  let html = mdi.render(src)
  html = html.replace(/<p><img src="media:([^"]+)" alt="([^"]*)"(?: title="([^"]*)")?[^>]*><\/p>/g, (_m, file: string, alt: string, cap?: string) => {
    const m = mediaByFile(file), url = mediaUrl(file)
    if (!url) return `<p class="broken">Нет файла content/media/${file}</p>`
    return `<figure class="fig"><img src="${url}" alt="${esc(m?.alt ?? alt)}" loading="lazy"><figcaption>${cap ?? alt}<span class="credit">${m ? `${esc(m.author)}. <a href="#/about">${esc(tr('Реестр изображений'))}</a>` : tr("Нет записи в реестре изображений")}</span></figcaption></figure>`
  })
  html = html.replace(/<table>/g, '<div class="table-wrap" tabindex="0"><table>').replace(/<\/table>/g, '</table></div>')
  html = html.replace(/(?:<p>)?@@BLOCK(\d+)@@(?:<\/p>)?/g, (_m, i) => blocks[+i])
  html = html.replace(/@@MATH(\d+)@@/g, (_m, i) => maths[+i])
  return html
}

/** Рендер текста с интерактивными вставками {{widget:имя}}. */
export function Md({ text, className = 'prose' }: { text: string; className?: string }) {
  const parts = useMemo(() => text.split(/^\{\{widget:([\w-]+)\}\}[ \t]*$/m), [text])
  return (
    <div className={className}>
      {parts.map((p, i) => {
        if (i % 2 === 1) {
          const W = widgets[p]
          return W ? <W key={i} /> : <p key={i} className="broken">{tr("Неизвестный виджет: ")}{p}</p>
        }
        return <Fragment key={i}><div dangerouslySetInnerHTML={{ __html: renderMd(p) }} /></Fragment>
      })}
    </div>
  )
}
export function MdInline({ text }: { text: string }) {
  return <div className="prose small" dangerouslySetInnerHTML={{ __html: renderMd(text) }} />
}
/** Какие источники упомянуты в тексте. */
export function citedIds(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(/\[@([^\]]+)\]/g)) for (const x of m[1].split(';')) {
    const id = x.trim().replace(/^@/, '')
    if (!out.includes(id)) out.push(id)
  }
  return out
}
