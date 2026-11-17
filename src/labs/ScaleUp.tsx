import { useState } from 'react'
import { LabMeta } from '../content'
import * as P from '../models/physics'
import { fmt, parseNum, VerdictTag, Verdict } from '../ui'
import { LabFrame, Brief, useLabState, Transfer, DebriefLinks, markFinished } from './LabPage'

interface S { phase: 'brief' | 'work' | 'debrief'; crit?: string; rpm: string; minutes: string; coolPred: string; cool?: string; verif: string[]; transfer: Record<number, any>; finished?: boolean }

export default function ScaleUp({ lab }: { lab: LabMeta }) {
  const p = lab.params as P.ScaleParams
  const [s, set, reset] = useLabState<S>(lab.id, () => ({ phase: 'brief', rpm: '', minutes: '', coolPred: '', verif: [], transfer: {} }))
  const [warn, setWarn] = useState('')
  const steps = ['Вводная', 'Режим', 'Первая партия']
  const frame = (ch: React.ReactNode) => <LabFrame lab={lab} steps={steps} step={{ brief: 0, work: 1, debrief: 2 }[s.phase]} debrief={s.phase === 'debrief'} onRestart={reset}>{ch}</LabFrame>
  if (s.phase === 'brief') return frame(<Brief lab={lab} resumed={!!s.crit} onStart={() => set((x) => { x.phase = 'work' })} />)

  const rpm = parseNum(s.rpm), minutes = parseNum(s.minutes), coolPred = parseNum(s.coolPred)
  const rpmEff = isFinite(rpm) ? Math.min(rpm, p.plant.rpm_max) : NaN
  const passes = isFinite(rpmEff) && isFinite(minutes) ? P.plantPasses(p, rpmEff, minutes) : NaN
  const dT = isFinite(rpmEff) && isFinite(minutes) ? P.homogHeat(p, rpmEff, minutes) : NaN

  if (s.phase === 'work') {
    const submit = () => {
      const miss = [!s.crit && 'критерий', !isFinite(rpm) && 'обороты', !isFinite(minutes) && 'время гомогенизации', !isFinite(coolPred) && 'оценка времени охлаждения', !s.cool && 'способ охлаждения', s.verif.length === 0 && 'план проверки'].filter(Boolean)
      if (miss.length) { setWarn(`Не заполнено: ${miss.join(', ')}.`); return }
      set((x) => { x.phase = 'debrief'; x.finished = true }); window.scrollTo(0, 0)
      { const c = (lab.criteria as any[]).find((x) => x.id === s.crit), t20 = P.coolingMinutes(p.plant.m, p.plant.cp, p.plant.U, p.plant.A, p.plant.T0, p.plant.T1, 20), ce = Math.abs(coolPred - t20) / t20
        const sc = ((c.verdict === 'ok' ? 1 : c.verdict === 'weak' ? 0.5 : 0) + (passes >= 4 && passes <= 12 ? 1 : passes >= 2.5 && passes <= 20 ? 0.5 : 0) + (ce <= 0.25 ? 1 : ce <= 0.6 ? 0.5 : 0) + (s.verif.includes('scaledown') ? 1 : s.verif.includes('criteria') || s.verif.includes('pilot') ? 0.5 : 0)) / 4
        markFinished(lab.id, `обороты ${fmt(rpmEff, 4)}, проходов ${fmt(passes, 2)}`, { rpm: rpmEff, passes }, sc) }
    }
    return frame(
      <div className="scale">
        <aside className="paper sheet" aria-label="Таблица оборудования">
          <div className="paper-head"><h2>Сравнение оборудования</h2><dl><div><dt>Документ</dt><dd>Лист данных к переносу Р-205, ред. 1 (учебный)</dd></div><div><dt>Составил</dt><dd><span className="hand">инж. Орлова, 04.11.2026</span></dd></div></dl></div>
          <div className="paper-scroll" tabIndex={0}><table>
            <thead><tr><th>Параметр</th><th>Лаборатория</th><th>Производство</th></tr></thead>
            <tbody>
              <tr><td>Масса партии</td><td className="num">{p.lab.V_l} кг</td><td className="num">{p.plant.m} кг</td></tr>
              <tr><td>Диаметр ротора гомогенизатора</td><td className="num">{p.lab.D * 1000} мм</td><td className="num">{p.plant.D * 1000} мм</td></tr>
              <tr><td>Обороты гомогенизатора</td><td className="num">{p.lab.rpm} об/мин</td><td className="num">до {p.plant.rpm_max} об/мин</td></tr>
              <tr><td>Производительность циркуляции</td><td className="num">{p.lab.Q_lpm} л/мин</td><td className="num">{p.plant.Q_lpm_ref} л/мин при {p.plant.rpm_ref} об/мин (пропорц. оборотам)</td></tr>
              <tr><td>Мощность привода гомогенизатора</td><td className="num">—</td><td className="num">{p.plant.P_kw_max} кВт при {p.plant.rpm_max} об/мин (∝ N³)</td></tr>
              <tr><td>Время гомогенизации</td><td className="num">{p.lab.time_min} мин</td><td className="num"><span className="hand">?</span></td></tr>
              <tr><td>Средний диаметр капель d₃₂</td><td className="num">{fmt(p.lab.d32)} мкм</td><td className="num"><span className="hand">?</span></td></tr>
              <tr><td>Площадь рубашки</td><td className="num">0,135 м²</td><td className="num">{p.plant.A} м²</td></tr>
              <tr><td>Коэффициент теплопередачи (оценка)</td><td className="num">{p.plant.U} Вт/(м²·К)</td><td className="num">{p.plant.U} Вт/(м²·К)</td></tr>
              <tr><td>Теплоёмкость продукта</td><td className="num" colSpan={2}>{p.plant.cp / 1000} кДж/(кг·К)</td></tr>
              <tr><td>Охлаждение {p.plant.T0} → {p.plant.T1} °C</td><td className="num">{p.lab.cool_min} мин (водяная баня 20 °C)</td><td className="num"><span className="hand">?</span></td></tr>
            </tbody></table></div>
          <p className="stamp" aria-hidden>УЧЕБНЫЙ ДОКУМЕНТ</p>
        </aside>
        <div className="scale-steps">
          <section className="panel"><h3><span className="ptag">1</span>Что сохраняем при переносе гомогенизации?</h3>
            <div className="choices">{(lab.criteria as any[]).map((c) => <label key={c.id} className={`choice ${s.crit === c.id ? 'on' : ''}`}><input type="radio" name="crit" checked={s.crit === c.id} onChange={() => set((x) => { x.crit = c.id })} /><span>{c.title}</span></label>)}</div>
            <label className="field">Обороты производственного гомогенизатора, которые вы запишете в режим
              <span className="inl"><input inputMode="decimal" value={s.rpm} onChange={(e) => set((x) => { x.rpm = e.target.value })} /><span className="unit">об/мин</span></span></label>
            {isFinite(rpm) && <p className="live num">Окружная скорость при {fmt(rpm, 4)} об/мин: {fmt(P.tipSpeed(p.plant.D, rpm), 3)} м/с (в лаборатории {fmt(P.tipSpeed(p.lab.D, p.lab.rpm), 3)} м/с){rpm > p.plant.rpm_max && ' — выше максимума аппарата'}</p>}
          </section>
          <section className="panel"><h3><span className="ptag">2</span>Сколько гомогенизировать?</h3>
            <p className="small">В лаборатории партия проходит через гомогенизатор {fmt(P.labPasses(p), 3)} раз за {p.lab.time_min} минут.</p>
            <label className="field">Время гомогенизации на реакторе
              <span className="inl"><input inputMode="decimal" value={s.minutes} onChange={(e) => set((x) => { x.minutes = e.target.value })} /><span className="unit">мин</span></span></label>
            {isFinite(passes) && <p className="live num">При {fmt(rpmEff, 4)} об/мин: проходов {fmt(passes, 3)} · необработанная доля {fmt(P.unprocessed(passes) * 100, 2)} % · нагрев без отвода тепла +{fmt(dT, 2)} К</p>}
          </section>
          <section className="panel"><h3><span className="ptag">3</span>Охлаждение</h3>
            <label className="field">Ваша оценка времени охлаждения {p.plant.T0} → {p.plant.T1} °C водой 20 °C — до того, как система покажет расчёт
              <span className="inl"><input inputMode="decimal" value={s.coolPred} onChange={(e) => set((x) => { x.coolPred = e.target.value })} /><span className="unit">мин</span></span></label>
            <div className="choices">{(lab.cooling as any[]).map((c) => <label key={c.id} className={`choice ${s.cool === c.id ? 'on' : ''}`}><input type="radio" name="cool" checked={s.cool === c.id} onChange={() => set((x) => { x.cool = c.id })} /><span>{c.title}</span></label>)}</div>
          </section>
          <section className="panel"><h3><span className="ptag">4</span>Что сделать до первой партии? <span className="small">— не более {lab.verification.max}</span></h3>
            <div className="choices">{(lab.verification.options as any[]).map((c) => {
              const on = s.verif.includes(c.id), full = s.verif.length >= lab.verification.max
              return <label key={c.id} className={`choice ${on ? 'on' : ''} ${!on && full ? 'dis' : ''}`}><input type="checkbox" checked={on} disabled={!on && full} onChange={() => set((x) => { x.verif = on ? x.verif.filter((i) => i !== c.id) : [...x.verif, c.id] })} /><span>{c.title}</span></label>
            })}</div></section>
          {warn && <p className="warnline" role="alert">{warn}</p>}
          <button className="btn primary" onClick={submit}>Сварить первую партию по этому режиму</button>
        </div>
      </div>)
  }
  // ---------- Разбор ----------
  const crit = (lab.criteria as any[]).find((c) => c.id === s.crit)
  const expected = P.rpmForCriterion(p, s.crit as any)
  const arith = Math.abs(rpm - expected) / expected <= 0.03
  const limited = Math.abs(rpm - Math.min(expected, p.plant.rpm_max)) / p.plant.rpm_max <= 0.03
  const d32 = P.d32AtPlant(p, rpmEff), d32tip = P.d32ByTip(p, rpmEff), f = P.unprocessed(passes)
  const cool = (lab.cooling as any[]).find((c) => c.id === s.cool)
  const tCool = P.coolingMinutes(p.plant.m, p.plant.cp, p.plant.U, p.plant.A, p.plant.T0, p.plant.T1, cool.Tc)
  const tCool20 = P.coolingMinutes(p.plant.m, p.plant.cp, p.plant.U, p.plant.A, p.plant.T0, p.plant.T1, 20)
  const passV: Verdict = passes >= 4 && passes <= 12 ? 'ok' : passes >= 2.5 && passes <= 20 ? 'weak' : 'wrong'
  const coolV: Verdict = Math.abs(coolPred - tCool20) / tCool20 <= 0.25 ? 'ok' : Math.abs(coolPred - tCool20) / tCool20 <= 0.6 ? 'weak' : 'wrong'
  return frame(
    <div className="debrief">
      <header className="debrief-head"><p className="eyebrow">Результат первой партии</p><h1>{lab.title}</h1>
        <dl className="outcome">
          <div><dt>Обороты (факт)</dt><dd className="num">{fmt(rpmEff, 4)}<small> об/мин</small></dd></div>
          <div><dt>d₃₂ по учебной модели</dt><dd className="num">{fmt(d32, 3)}<small> мкм (лаб. {fmt(p.lab.d32)})</small></dd></div>
          <div><dt>Проходов</dt><dd className="num">{fmt(passes, 3)}<small> (лаб. {fmt(P.labPasses(p), 3)})</small></dd></div>
          <div><dt>Необработанная доля</dt><dd className="num">{fmt(f * 100, 2)}<small> %</small></dd></div>
          <div><dt>Нагрев от гомогенизатора</dt><dd className="num">+{fmt(dT, 2)}<small> К</small></dd></div>
          <div><dt>Охлаждение</dt><dd className="num">{fmt(tCool, 2)}<small> мин (лаб. {p.lab.cool_min})</small></dd></div>
        </dl></header>
      <section className="panel"><h3>1. Критерий и обороты</h3>
        <article className={`drow ${crit.verdict}`}><h4>{crit.title}</h4><p className="yours"><VerdictTag v={crit.verdict} /></p><p>{crit.text}</p></article>
        <article className={`drow ${arith ? 'ok' : limited ? 'ok' : 'wrong'}`}>
          <p>По выбранному критерию расчёт даёт <b className="num">{fmt(expected, 4)} об/мин</b>; вы записали <b className="num">{fmt(rpm, 4)}</b>.{' '}
            {arith ? 'Расчёт сходится.' : limited ? 'Вы учли ограничение аппарата и записали достижимые обороты — это и есть инженерное решение.' : 'Числа не сходятся: проверьте показатель степени при отношении диаметров (см. таблицу критериев в теме «Масштабирование»).'}</p>
          {rpm > p.plant.rpm_max && <p>Аппарат не даёт больше {p.plant.rpm_max} об/мин — партия сварена на максимуме. В режим нельзя записывать недостижимый параметр.</p>}</article>
        <article className="drow weak"><p><b>Размер капель.</b> По учебной модели (диссипация энергии) — {fmt(d32, 3)} мкм против {fmt(p.lab.d32)} мкм в лаборатории. По корреляции через окружную скорость получилось бы {fmt(d32tip, 3)} мкм. Разница между двумя оценками — {fmt(Math.abs(d32 - d32tip), 2)} мкм: это и есть неопределённость, которую снимает только измерение на первой партии.{d32 > p.lab.d32 * 1.3 && ' Капли заметно крупнее лабораторных: скорость гравитационного разделения по Стоксу выросла бы в ' + fmt((d32 / p.lab.d32) ** 2, 2) + ' раза — значит, устойчивость рецептуры к такому размеру нужно знать заранее.'}</p></article>
      </section>
      <section className="panel"><h3>2. Время гомогенизации</h3>
        <article className={`drow ${passV}`}><p className="yours"><VerdictTag v={passV} /> {fmt(minutes, 3)} мин → {fmt(passes, 3)} прохода(ов)</p>
          {passes < 2.5 && <p>Через зону диспергирования не прошло {fmt(f * 100, 2)} % партии. Под микроскопом — два семейства капель: обработанные и грубый премикс. Копирование лабораторных минут — самая частая ошибка переноса: в лаборатории те же {p.lab.time_min} минут дают {fmt(P.labPasses(p), 3)} проходов.</p>}
          {passes >= 2.5 && passes < 4 && <p>Необработанная доля {fmt(f * 100, 2)} % — на границе допустимого; в вязком креме с застойными зонами реальная доля будет выше расчётной.</p>}
          {passes >= 4 && passes <= 12 && <p>Необработанная доля {fmt(f * 100, 2)} % при умеренном нагреве (+{fmt(dT, 2)} К). Обратите внимание: это в {fmt(P.labPasses(p) / passes, 2)} раза меньше проходов, чем в лаборатории, — лабораторный режим избыточен, и проверять рецептуру стоит именно при заводском числе проходов.</p>}
          {passes > 12 && <p>Вы приблизились к лабораторному числу проходов ценой времени ({fmt(minutes, 3)} мин) и тепла: +{fmt(dT, 2)} К без отвода. {dT > 10 ? 'Такой нагрев требует одновременного охлаждения и удлиняет цикл; для термочувствительных компонентов это риск.' : ''} Практичнее сократить число проходов в лаборатории и убедиться, что продукт от этого не страдает.</p>}
        </article></section>
      <section className="panel"><h3>3. Охлаждение</h3>
        <article className={`drow ${coolV}`}><p className="yours"><VerdictTag v={coolV} label={coolV === 'ok' ? 'Оценка близка' : coolV === 'weak' ? 'Порядок верный' : 'Оценка далека'} /> Ваша оценка: {fmt(coolPred, 3)} мин; расчёт для воды 20 °C: {fmt(tCool20, 3)} мин</p>
          <p>t = (m·c_p)/(U·A)·ln((T₀−T_c)/(T₁−T_c)) = ({p.plant.m}·{p.plant.cp})/({p.plant.U}·{p.plant.A})·ln(55/20) ≈ {fmt(tCool20, 3)} мин. Быстрая проверка без формулы: линейный размер вырос в (400)^(1/3) ≈ 7,4 раза, лабораторные {p.lab.cool_min} минут превращаются примерно в час.</p></article>
        <article className={`drow ${cool.verdict}`}><h4>{cool.title}</h4><p className="yours"><VerdictTag v={cool.verdict} /></p><p>{cool.text}</p></article></section>
      <section className="panel"><h3>4. Проверка до первой партии</h3>
        {s.verif.map((id) => (lab.verification.options as any[]).find((c) => c.id === id)).map((c) => <article key={c.id} className={`drow ${c.verdict}`}><h4>{c.title}</h4><p className="yours"><VerdictTag v={c.verdict} /></p><p>{c.text}</p></article>)}
        <details><summary>Варианты, которые вы не выбрали</summary>{(lab.verification.options as any[]).filter((c) => !s.verif.includes(c.id)).map((c) => <p key={c.id} className="small"><VerdictTag v={c.verdict} /> <b>{c.title}.</b> {c.text}</p>)}</details></section>
      <section className="panel story"><h3>Принцип</h3>
        <p>Завод отличается от лаборатории одновременно по интенсивности, числу проходов и тепловой истории. Сохранить всё нельзя; профессиональное решение — выяснить ограничения аппарата, воспроизвести их в лаборатории и проверить устойчивость рецептуры до того, как на кону окажутся две тонны.</p>
        <p className="small">{lab.dataNote}</p></section>
      <Transfer lab={lab} answers={s.transfer} onAnswer={(i, v) => set((x) => { x.transfer[i] = v })} />
      <DebriefLinks lab={lab} />
      <div className="row end"><button className="btn" onClick={() => set((x) => { x.phase = 'work' })}>Изменить режим и сварить снова</button><button className="btn ghost" onClick={reset}>Новая попытка с нуля</button></div>
    </div>)
}
