import { useState } from 'react'
import { LabMeta } from '../content'
import { saltViscosity, dilutedSalt, seededNoise, SaltCurve } from '../models/physics'
import { Chart, fmt, parseNum, VerdictTag, Verdict } from '../ui'
import { LabFrame, Brief, useLabState, Transfer, DebriefLinks, markFinished } from './LabPage'

interface Step { kind: 'bench' | 'add' | 'dilute'; kg?: number; pct?: number; eta?: number; sTotal: number; at: number; points?: [number, number][] }
interface S { phase: 'brief' | 'work' | 'conclude' | 'debrief'; log: Step[]; sTotal: number; mass: number; used: number; opened: Record<string, boolean>; doc?: string; kg: string; concl?: number; transfer: Record<number, any>; finished?: boolean }
const Hand = ({ v }: { v: string }) => v.startsWith('~') ? <span className="hand">{v.slice(1)}</span> : <>{v}</>

export default function SaltDosing({ lab }: { lab: LabMeta }) {
  const c = lab.curve as SaltCurve, b = lab.batch, A = lab.actions, spec = lab.spec
  const [s, set, reset] = useLabState<S>(lab.id, () => ({ phase: 'brief', log: [], sTotal: b.saltNow, mass: b.mass, used: 0, opened: {}, kg: '', transfer: {} }))
  const [warn, setWarn] = useState('')
  const measure = (sT: number, seed: number) => Math.round((saltViscosity(c, sT) * (1 + lab.noise * seededNoise(seed))) / 10) * 10
  const eta0 = measure(b.saltNow, 1)
  const lastEta = [...s.log].reverse().find((x) => x.eta !== undefined)?.eta ?? eta0
  const left = lab.timeBudget - s.used
  const frame = (ch: React.ReactNode) => <LabFrame lab={lab} steps={['Вводная', 'Реактор', 'Вывод', 'Разбор']} step={{ brief: 0, work: 1, conclude: 2, debrief: 3 }[s.phase]} debrief={s.phase === 'debrief'} onRestart={reset}>{ch}</LabFrame>
  if (s.phase === 'brief') return frame(<Brief lab={lab} resumed={s.log.length > 0} onStart={() => set((x) => { x.phase = 'work' })} />)

  const bench = s.log.find((x) => x.kind === 'bench')
  const inSpec = (e: number) => e >= spec.min && e <= spec.max
  const journal = (
    <div className="table-wrap" tabIndex={0}><table>
      <caption>Журнал корректировки партии. Вязкость — учебный расчёт, мПа·с при 25 °C.</caption>
      <thead><tr><th>Время от начала</th><th>Действие</th><th>Вязкость партии, мПа·с</th><th>Оценка</th></tr></thead>
      <tbody>
        <tr><td className="num">0 мин</td><td>Замер ОКК до ввода соли</td><td className="num">{fmt(eta0, 4)}</td><td><VerdictTag v="weak" label="ниже нормы" /></td></tr>
        {s.log.map((x, i) => (
          <tr key={i}><td className="num">{x.at} мин</td>
            <td>{x.kind === 'bench' ? 'Солевая кривая на пробе (реактор не затронут)' : x.kind === 'add' ? `Введено NaCl ${fmt(x.kg!, 3)} кг (+${fmt(x.pct!, 2)} %)` : `Разбавление несолёной основой, +${A.dilute.fraction * 100} % массы`}</td>
            <td className="num">{x.eta !== undefined ? fmt(x.eta, 4) : '—'}</td>
            <td>{x.eta !== undefined && <VerdictTag v={inSpec(x.eta) ? 'ok' : x.eta > spec.max ? 'wrong' : 'weak'} label={inSpec(x.eta) ? 'в норме' : x.eta > spec.max ? 'выше нормы' : 'ниже нормы'} />}</td></tr>))}
      </tbody></table></div>)
  const benchChart = bench && (
    <div className="result"><h4>Солевая кривая пробы партии</h4>
      <Chart title="Солевая кривая пробы" xDomain={[0, 1]} yDomain={[0, 12000]} xLabel="Добавка NaCl к пробе, % (сверх уже содержащейся соли)" yLabel="Вязкость, мПа·с (25 °C)"
        hlines={[{ y: spec.min, label: `норма от ${spec.min}` }, { y: spec.max, label: `норма до ${spec.max}` }]}
        series={[{ name: 'проба', color: '#0E7C7B', dots: true, points: bench.points! }]} />
      <div className="table-wrap" tabIndex={0}><table><thead><tr><th>Добавка, %</th>{bench.points!.map((p) => <td key={p[0]} className="num">{fmt(p[0], 2)}</td>)}</tr></thead>
        <tbody><tr><th>Вязкость, мПа·с</th>{bench.points!.map((p) => <td key={p[0]} className="num">{fmt(p[1], 4)}</td>)}</tr></tbody></table></div>
      <p className="small">Лабораторные стаканы по 200 г. Добавка отсчитывается от состояния партии на момент отбора пробы.</p></div>)

  if (s.phase === 'work') {
    const act = (min: number, fn: (x: S) => void) => {
      if (left < min) { setWarn(`На это действие нужно ${min} мин, до конца смены осталось ${left}.`); return }
      setWarn(''); set((x) => { x.used += min; fn(x) })
    }
    const kg = parseNum(s.kg)
    const doc = (lab.documents as any[]).find((d) => d.id === s.doc)
    return frame(
      <div className="bench">
        <section className="bench-ctl panel">
          <h3>Реактор Р-3 <span className="budget num">осталось {left} мин</span></h3>
          <dl className="readout dark">
            <div><dt>Последний замер вязкости</dt><dd className="num">{fmt(lastEta, 4)} <small>мПа·с · норма {spec.min}–{spec.max}</small></dd></div>
            <div><dt>Введено соли в реактор</dt><dd className="num">{fmt(s.log.filter((x) => x.kind === 'add').reduce((a, x) => a + x.kg!, 0), 3)} <small>кг · масса партии {fmt(s.mass, 4)} кг</small></dd></div>
          </dl>
          <h4>Документы партии</h4>
          <div className="choices">{(lab.documents as any[]).map((d) => <button key={d.id} className={`choice ${s.doc === d.id ? 'on' : ''}`} onClick={() => set((x) => { x.doc = d.id; x.opened[d.id] = true })}><span>▤ {d.title}{!s.opened[d.id] && <small>не открыт</small>}</span></button>)}</div>
          <h4>Действия</h4>
          <div className="act"><b>{A.bench.title}</b><span className="small">{A.bench.minutes} мин · {A.bench.text}</span>
            <button className="btn small" disabled={!!bench} onClick={() => act(A.bench.minutes, (x) => { x.log.push({ kind: 'bench', sTotal: x.sTotal, at: x.used, points: (A.bench.points as number[]).map((p, i) => [p, measure(x.sTotal + p, 100 + i)] as [number, number]) }) })}>{bench ? 'Кривая снята' : 'Снять кривую'}</button></div>
          <div className="act"><b>{A.add.title}</b><span className="small">{A.add.minutes} мин · {A.add.text}</span>
            <label className="field sm">Масса NaCl<span className="inl"><input inputMode="decimal" value={s.kg} onChange={(e) => set((x) => { x.kg = e.target.value })} /><span className="unit">кг{isFinite(kg) && kg > 0 ? ` = +${fmt((kg / s.mass) * 100, 2)} %` : ''}</span></span></label>
            <button className="btn small primary" disabled={!(kg > 0) || kg > 30} onClick={() => act(A.add.minutes, (x) => { const pct = (kg / x.mass) * 100; x.sTotal += pct; x.log.push({ kind: 'add', kg, pct, sTotal: x.sTotal, at: x.used, eta: measure(x.sTotal, 10 + x.log.length) }); x.kg = '' })}>Ввести и измерить</button></div>
          <div className="act"><b>{A.dilute.title}</b><span className="small">{A.dilute.minutes} мин · {A.dilute.text}</span>
            <button className="btn small ghost" disabled={s.log.some((x) => x.kind === 'dilute')} onClick={() => act(A.dilute.minutes, (x) => { x.sTotal = dilutedSalt(x.sTotal, A.dilute.fraction); x.mass *= 1 + A.dilute.fraction; x.log.push({ kind: 'dilute', sTotal: x.sTotal, at: x.used, eta: measure(x.sTotal, 50 + x.log.length) }) })}>Разбавить</button></div>
          {warn && <p className="warnline" role="alert">{warn}</p>}
          <button className="btn primary wide" onClick={() => set((x) => { x.phase = 'conclude' })}>Передать партию на контроль →</button>
        </section>
        <section className="bench-out">
          {doc && (
            <div className="paper" style={{ marginBottom: 18 }}>
              <div className="paper-head"><h2>{doc.title}</h2><dl><div><dt>Происхождение</dt><dd>{doc.origin}</dd></div></dl></div>
              <div className="paper-scroll" tabIndex={0}><table><tbody>{doc.rows.map((r: string[], i: number) => <tr key={i}><th scope="row">{r[0]}</th><td><Hand v={r[1]} /></td></tr>)}</tbody></table></div>
              <p className="stamp" aria-hidden>УЧЕБНЫЙ ДОКУМЕНТ</p></div>)}
          {!doc && s.log.length === 0 && <div className="empty"><p>Аппаратчик ждёт решения. Откройте документы партии слева — они не отнимают времени — и решите, с чего начать.</p></div>}
          {benchChart}{journal}
        </section>
      </div>)
  }
  const co = lab.conclusion
  if (s.phase === 'conclude') return frame(
    <div className="conclude">
      <div className="conclude-head"><h1>Партия передана на контроль</h1>{left >= 20 && <button className="btn ghost" onClick={() => set((x) => { x.phase = 'work' })}>← Вернуться к реактору</button>}</div>
      <p>Последний замер: <b className="num">{fmt(lastEta, 4)} мПа·с</b>. Прежде чем увидеть разбор, ответьте на вопрос начальника производства.</p>
      <fieldset className="qcard"><legend className="q">{co.q}</legend>
        {co.options.map((o: any, i: number) => <label key={i} className={`opt ${s.concl === i ? 'sel' : ''}`}><input type="radio" name="concl" checked={s.concl === i} onChange={() => set((x) => { x.concl = i })} /><span>{o.text}</span></label>)}</fieldset>
      {journal}
      <button className="btn primary" disabled={s.concl === undefined} onClick={() => { set((x) => { x.phase = 'debrief'; x.finished = true }); markFinished(lab.id, `${inSpec(lastEta) ? 'в норме' : 'вне нормы'}: ${fmt(lastEta, 4)} мПа·с за ${s.used} мин`, { log: s.log, eta: lastEta, used: s.used }, 0.7 * (inSpec(lastEta) ? (s.sTotal <= c.sPeak ? 1 : 0.6) : 0.15) + 0.3 * ({ ok: 1, weak: 0.5, wrong: 0 } as any)[co.options[s.concl!].verdict]); window.scrollTo(0, 0) }}>К разбору</button>
    </div>)

  // ---------- Разбор ----------
  const adds = s.log.filter((x) => x.kind === 'add'), firstAdd = adds[0]
  const benchFirst = !!bench && (!firstAdd || s.log.indexOf(bench) < s.log.indexOf(firstAdd))
  const diluted = s.log.some((x) => x.kind === 'dilute')
  const side = s.sTotal <= c.sPeak ? 'left' : 'right'
  const overshoot = s.log.some((x) => x.kind === 'add' && (x.sTotal > c.sPeak || x.eta! > spec.max))
  const ok = inSpec(lastEta)
  const resV: Verdict = ok ? (side === 'left' ? 'ok' : 'weak') : 'wrong'
  const pick = co.options[s.concl!]
  const xs = Array.from({ length: 61 }, (_, i) => 0.6 + i * 0.035)
  return frame(
    <div className="debrief">
      <header className="debrief-head"><p className="eyebrow">Разбор решения</p><h1>{lab.title}</h1>
        <dl className="outcome">
          <div><dt>Вязкость партии</dt><dd className="num">{fmt(lastEta, 4)}<small> мПа·с</small></dd></div>
          <div><dt>Общая соль</dt><dd className="num">{fmt(s.sTotal, 3)}<small> % (максимум кривой при {fmt(c.sPeak, 2)})</small></dd></div>
          <div><dt>Вводов соли</dt><dd className="num">{adds.length}</dd></div>
          <div><dt>Время</dt><dd className="num">{s.used}<small> из {lab.timeBudget} мин</small></dd></div>
        </dl></header>
      <section className="panel"><h3>Результат</h3>
        <article className={`drow ${resV}`}><p className="yours"><VerdictTag v={resV} label={ok ? (side === 'left' ? 'В норме, на левом склоне' : 'В норме, но на правом склоне') : lastEta > spec.max ? 'Выше нормы' : 'Ниже нормы'} /></p>
          {ok && side === 'left' && <p>Партия в норме и стоит слева от максимума: если после ввода отдушки вязкость немного просядет, её можно поправить малой порцией соли.</p>}
          {ok && side === 'right' && <p>Формально норма достигнута, но партия пересолена и стоит на правом склоне. Любой дополнительный электролит, отдушка или нагрев снизят вязкость, и поправить её солью уже нельзя. Такое состояние нужно отразить в отклонении.</p>}
          {!ok && adds.length === 0 && <p>Соль не вводилась — партия осталась с исходной вязкостью ниже нормы.</p>}
          {!ok && adds.length > 0 && lastEta > spec.max && <p>Партия остановилась у максимума кривой, выше нормы. Дальше остаются только плохие варианты: пересаливать до правого склона или разбавлять.</p>}
          {!ok && adds.length > 0 && lastEta < spec.min && <p>{side === 'right' ? 'Партия пересолена: вязкость упала ниже нормы на правом склоне. Вернуть её можно только разбавлением несолёной основой.' : 'Соли введено меньше, чем нужно, — партия ещё на левом склоне, ниже нормы. Это исправимо следующей порцией, но смена закончилась раньше.'}</p>}
        </article></section>
      <section className="panel"><h3>Как вы шли к результату</h3>
        <article className={`drow ${s.opened.coa && s.opened.qc ? 'ok' : 'weak'}`}><p><b>Данные до первого действия.</b> Открыты документы: {(lab.documents as any[]).filter((d) => s.opened[d.id]).map((d) => d.title).join('; ') || 'ни одного'}. {s.opened.coa && s.opened.qc ? 'Замер до соли и паспорта сырья вместе объясняют, почему стандартная дозировка здесь не подходит.' : 'Два документа указывали на проблему заранее: замер до соли (2 800 мПа·с при типичных 700–900) и паспорта сырья (расчётная собственная соль около 1,0 % против обычных 0,65 %).'}</p></article>
        {firstAdd && <article className={`drow ${firstAdd.pct! >= 0.7 ? 'wrong' : benchFirst || firstAdd.pct! <= 0.35 ? 'ok' : 'weak'}`}><p><b>Первая порция: +{fmt(firstAdd.pct!, 2)} % ({fmt(firstAdd.kg!, 3)} кг).</b>{' '}
          {firstAdd.pct! >= 0.7 ? 'Это дозировка из инструкции или близкая к ней. На партии с повышенной собственной солью она вывела продукт к максимуму кривой, и исправить это солью уже невозможно.'
            : benchFirst ? `Порция выбрана по снятой кривой: окно нормы лежит при добавке примерно +0,30…+0,55 %. ${firstAdd.pct! <= 0.45 ? 'Вы подошли к норме с левой стороны с запасом на довод.' : 'Порция близка к верхней границе окна — запаса на погрешность переноса из стакана в реактор почти нет.'}`
              : firstAdd.pct! <= 0.35 ? 'Кривую вы не снимали, но начали с малой порции и ориентировались по замерам в реакторе. Это рабочий путь; его цена — время на лишние циклы.'
                : 'Без кривой такая порция — риск: вы не знали, где максимум. В этот раз окно оказалось достаточно широким.'}</p></article>}
        <article className={`drow ${benchFirst ? 'ok' : bench ? 'weak' : adds.length <= 1 && !overshoot ? 'weak' : 'weak'}`}><p><b>Солевая кривая на пробе.</b> {benchFirst ? 'Снята до первого ввода в реактор — 40 минут в обмен на знание положения максимума и окна нормы.' : bench ? 'Снята уже после ввода соли в реактор — она помогла понять, где вы находитесь, но не предотвратила первый шаг вслепую.' : 'Не снималась. Без неё каждое добавление — эксперимент на тонне продукта; оправдано только малыми порциями.'}</p></article>
        {overshoot && <article className="drow wrong"><p><b>Проход через максимум или выход выше нормы.</b> В журнале есть замер у максимума кривой или за ним. Это необратимый шаг: всё, что было после, — исправление последствий.</p></article>}
        {diluted && <article className="drow weak"><p><b>Разбавление.</b> Вы вернули партию влево по кривой ценой 60 минут, дополнительной основы и согласования со службой качества. Масса партии выросла до {fmt(s.mass, 4)} кг — это тоже нужно оформить.</p></article>}
      </section>
      <section className="panel"><h3>Ваше объяснение</h3>
        <article className={`drow ${pick.verdict}`}><h4>{pick.text}</h4><p className="yours"><VerdictTag v={pick.verdict} /></p><p>{pick.why}</p></article></section>
      <section className="panel"><h3>Вся кривая этой партии и ваш путь по ней</h3>
        <Chart title="Солевая кривая партии с отмеченными шагами" xDomain={[0.6, 2.7]} yDomain={[0, 12000]} xLabel="Общее содержание NaCl в партии, %" yLabel="Вязкость, мПа·с (25 °C)"
          hlines={[{ y: spec.min, label: `норма от ${spec.min}` }, { y: spec.max, label: `до ${spec.max}` }]}
          markers={[{ x: b.saltNow, label: 'до соли' }, { x: b.saltNow + 0.8, label: 'после 0,8 % по ТИ' }]}
          series={[{ name: 'кривая (модель)', color: '#8A7D9A', dash: '4 4', points: xs.map((x) => [x, saltViscosity(c, x)] as [number, number]) },
            { name: 'ваши замеры', color: '#D9482B', dots: true, points: [[b.saltNow, eta0] as [number, number], ...s.log.filter((x) => x.eta !== undefined).map((x) => [x.sTotal, x.eta!] as [number, number])] }]} />
        {journal}{benchChart}</section>
      <section className="panel story"><h3>Принцип</h3>
        <p>Положение партии на солевой кривой определяет вся соль в системе, а не только добавленная вами. Сигналы были доступны до первого действия: вязкость до соли втрое выше типичной и паспорта сырья. Движение по кривой одностороннее, поэтому к норме подходят слева, порциями, а неизвестную кривую сначала снимают на пробе.</p>
        <p className="small">{lab.dataNote}</p></section>
      <Transfer lab={lab} answers={s.transfer} onAnswer={(i, v) => set((x) => { x.transfer[i] = v })} />
      <DebriefLinks lab={lab} />
      <div className="row end"><button className="btn ghost" onClick={reset}>Новая попытка с нуля</button></div>
    </div>)
}
