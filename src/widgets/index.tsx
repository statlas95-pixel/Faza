import { useState, ComponentType } from 'react'
import { Chart, Slider, fmt, range } from '../ui'
import { media, mediaUrl } from '../content'
import { saltViscosity } from '../models/physics'
import { stokesVelocity, hbViscosity, hbStress, unprocessed, coolingMinutes } from '../models/physics'

function Frame({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="widget" aria-label={title}>
      <header><span className="wtag">Интерактив</span><h4>{title}</h4></header>
      {children}
      {note && <p className="wnote">{note}</p>}
    </section>)
}

function Stokes() {
  const [d, setD] = useState(5), [dr, setDr] = useState(80), [le, setLe] = useState(-3)
  const eta = Math.pow(10, le)
  const v = stokesVelocity(dr, d * 1e-6, eta), mmDay = v * 86400 * 1000
  const days1mm = 1 / mmDay
  const base = stokesVelocity(80, 5e-6, 1e-3)
  return (
    <Frame title="Закон Стокса: какой рычаг сильнее" note="Учебная модель: одиночная сфера, ньютоновская среда. Меняйте один параметр за раз и следите за множителем.">
      <div className="wgrid">
        <div>
          <Slider label="Диаметр капли d" value={d} min={0.5} max={20} step={0.5} onChange={setD} show={`${fmt(d)} мкм`} />
          <Slider label="Разность плотностей Δρ" value={dr} min={5} max={200} step={5} onChange={setDr} show={`${dr} кг/м³`} />
          <Slider label="Вязкость среды η (лог. шкала)" value={le} min={-3} max={2} step={0.1} onChange={setLe} show={`${fmt(eta * 1000, 2)} мПа·с`} />
        </div>
        <dl className="readout">
          <div><dt>Скорость</dt><dd className="num">{fmt(mmDay)} <small>мм/сут</small></dd></div>
          <div><dt>До слоя 1 мм</dt><dd className="num">{days1mm < 1 ? `${fmt(days1mm * 24, 2)} ч` : days1mm < 730 ? `${fmt(days1mm, 2)} сут` : `${fmt(days1mm / 365, 2)} лет`}</dd></div>
          <div><dt>Относительно примера (5 мкм, 80 кг/м³, вода)</dt><dd className="num">× {fmt(v / base, 2)}</dd></div>
        </dl>
      </div>
    </Frame>)
}

function FlowCurve() {
  const [sy, setSy] = useState(10), [K, setK] = useState(15), [n, setN] = useState(0.5), [lr, setLr] = useState(0.6)
  const s = { sy, K, n }, rate = Math.pow(10, lr)
  const xs = range(0.001, 10000, 80, true)
  const zones = [{ x: 0.001, label: 'хранение' }, { x: 1, label: 'вискозиметр' }, { x: 100, label: 'прокачка' }, { x: 3000, label: 'нанесение' }]
  return (
    <Frame title="Кривая течения: один образец — много вязкостей" note="Учебная модель Гершеля — Балкли. При σ_y > 0 вязкость при малых скоростях сдвига растёт неограниченно — это модельное представление предела текучести.">
      <div className="wgrid">
        <div>
          <Slider label="Предел текучести σ_y" value={sy} min={0} max={50} step={1} onChange={setSy} show={`${sy} Па`} />
          <Slider label="Консистенция K" value={K} min={1} max={50} step={1} onChange={setK} show={`${K} Па·сⁿ`} />
          <Slider label="Индекс течения n" value={n} min={0.2} max={1} step={0.05} onChange={setN} show={fmt(n, 2)} />
          <Slider label="Точка чтения: скорость сдвига" value={lr} min={-3} max={4} step={0.1} onChange={setLr} show={`${fmt(rate, 2)} с⁻¹`} />
          <dl className="readout">
            <div><dt>Вязкость в точке</dt><dd className="num">{fmt(hbViscosity(s, rate))} <small>Па·с</small></dd></div>
            <div><dt>Напряжение в точке</dt><dd className="num">{fmt(hbStress(s, rate))} <small>Па</small></dd></div>
          </dl>
        </div>
        <Chart title="Вязкость от скорости сдвига" xLog yLog xDomain={[0.001, 10000]} yDomain={[0.01, 100000]}
          xLabel="Скорость сдвига, с⁻¹" yLabel="Вязкость, Па·с" markers={zones} cursor={rate}
          series={[{ name: 'образец', color: 'var(--teal)', points: xs.map((x) => [x, hbViscosity(s, x)]) }]} />
      </div>
    </Frame>)
}

function Passes() {
  const [V, setV] = useState(2000), [Q, setQ] = useState(600), [t, setT] = useState(5)
  const n = (Q * t) / V, f = unprocessed(n)
  return (
    <Frame title="Число проходов и необработанная доля" note="Допущение: идеальное перемешивание в реакторе. Реальная необработанная доля в вязком продукте выше.">
      <div className="wgrid">
        <div>
          <Slider label="Объём партии V" value={V} min={5} max={5000} step={5} onChange={setV} show={`${V} л`} />
          <Slider label="Производительность циркуляции Q" value={Q} min={10} max={1500} step={10} onChange={setQ} show={`${Q} л/мин`} />
          <Slider label="Время гомогенизации t" value={t} min={1} max={60} step={1} onChange={setT} show={`${t} мин`} />
        </div>
        <div>
          <dl className="readout">
            <div><dt>Проходов n = Q·t/V</dt><dd className="num">{fmt(n, 3)}</dd></div>
            <div><dt>Не прошло через зону, e⁻ⁿ</dt><dd className="num">{fmt(f * 100, 2)} <small>%</small></dd></div>
          </dl>
          <div className="bar" role="img" aria-label={`Необработанная доля ${fmt(f * 100, 2)} процента`}><span style={{ width: `${Math.max(f * 100, 0.5)}%` }} /></div>
        </div>
      </div>
    </Frame>)
}

function Cooling() {
  const [lm, setLm] = useState(Math.log10(2000)), [Tc, setTc] = useState(20)
  const m = Math.pow(10, lm)
  // геометрическое подобие: A = A_ref (m/2000)^(2/3)
  const A = 7 * Math.pow(m / 2000, 2 / 3)
  const t = coolingMinutes(m, 3800, 300, A, 75, 40, Tc)
  const ms = range(5, 5000, 40, true)
  return (
    <Frame title="Время охлаждения и масштаб" note="Учебная модель: геометрически подобные аппараты, U = 300 Вт/(м²·К), c_p = 3,8 кДж/(кг·К), охлаждение 75 → 40 °C. Тепло от мешалок и рост вязкости не учтены.">
      <div className="wgrid">
        <div>
          <Slider label="Масса партии (лог. шкала)" value={lm} min={Math.log10(5)} max={Math.log10(5000)} step={0.01} onChange={setLm} show={`${fmt(m, 2)} кг`} />
          <Slider label="Температура хладагента" value={Tc} min={5} max={30} step={1} onChange={setTc} show={`${Tc} °C`} />
          <dl className="readout">
            <div><dt>Площадь рубашки</dt><dd className="num">{fmt(A, 2)} <small>м²</small></dd></div>
            <div><dt>Поверхность / масса</dt><dd className="num">{fmt((A / m) * 1000, 2)} <small>м²/т</small></dd></div>
            <div><dt>Время охлаждения</dt><dd className="num">{fmt(t, 2)} <small>мин</small></dd></div>
          </dl>
        </div>
        <Chart title="Время охлаждения от массы партии" xLog xDomain={[5, 5000]} yDomain={[0, 120]} xLabel="Масса партии, кг" yLabel="Время охлаждения, мин" cursor={m}
          series={[{ name: `хладагент ${Tc} °C`, color: 'var(--coral)', points: ms.map((x) => [x, coolingMinutes(x, 3800, 300, 7 * Math.pow(x / 2000, 2 / 3), 75, 40, Tc)]) }]} />
      </div>
    </Frame>)
}

// Пошаговая визуальная демонстрация (вместо видео): механизмы разрушения эмульсии
const demoSteps = [
  { id: 'fresh', title: 'Свежая эмульсия', text: 'Капли распределены по объёму равномерно. Система выглядит однородной, но она неравновесна: у неё избыток поверхности раздела.' },
  { id: 'floc', title: 'Флокуляция', text: 'Капли слипаются в гроздья, но плёнки между ними целы — размер каждой капли прежний. Гроздь движется как одна крупная частица.' },
  { id: 'cream', title: 'Кримирование', text: 'Капли и флокулы легче воды и всплывают. Внизу появляется обеднённый слой. Капли по-прежнему отдельные: встряхивание вернёт однородность.' },
  { id: 'coal', title: 'Коалесценция', text: 'В плотном слое плёнки между каплями рвутся, капли сливаются. Число капель падает, размер растёт. Это необратимо; в пределе — слой свободного масла.' },
  { id: 'ost', title: 'Оствальдово созревание', text: 'Другой путь, без контакта капель: мелкие растворяются, вещество диффундирует через воду и осаждается на крупных. Мелкие исчезают, крупные растут.' },
]
function rnd(seed: number) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647 }
function scene(id: string) {
  const r = rnd(7), out: { x: number; y: number; r: number }[] = []
  const N = 46
  for (let i = 0; i < N; i++) {
    let x = 14 + r() * 132, y = 14 + r() * 212, rad = 3.2 + r() * 2.2
    if (id === 'floc') { const c = i % 6; x = [35, 110, 70, 125, 40, 95][c] + (r() - 0.5) * 26; y = [45, 70, 120, 170, 195, 215][c] + (r() - 0.5) * 26 }
    if (id === 'cream') { y = 12 + r() * r() * 110 }
    if (id === 'coal') { if (i >= 16) continue; y = 14 + r() * 70; rad = 7 + r() * 9 }
    if (id === 'ost') { if (i % 3 === 0) rad = 7.5 + r() * 3; else if (i % 3 === 1) rad = 1.2 + r() * 0.8; else continue }
    out.push({ x, y, r: rad })
  }
  return out
}
function Demo() {
  const [i, setI] = useState(0)
  const st = demoSteps[i], drops = scene(st.id)
  return (
    <Frame title="Пошаговая демонстрация: пути разрушения эмульсии" note="Схематическая визуализация, не микрофотография. Размеры и число капель условны.">
      <div className="demo">
        <svg viewBox="0 0 160 240" className="vial" role="img" aria-label={`${st.title}. ${st.text}`}>
          <rect x="4" y="4" width="152" height="232" rx="14" fill="#E4F4F2" stroke="var(--ink)" strokeWidth="2" />
          {st.id === 'coal' && <rect x="5" y="5" width="150" height="16" rx="10" fill="#FFB38A" opacity=".9" />}
          {drops.map((d, k) => <circle key={k} cx={d.x} cy={d.y} r={d.r} fill="#FFB38A" stroke="#C4532B" strokeWidth=".8" />)}
        </svg>
        <div className="demo-text">
          <ol className="steps" aria-label="Шаги демонстрации">
            {demoSteps.map((s, k) => <li key={s.id}><button className={k === i ? 'on' : ''} aria-current={k === i} onClick={() => setI(k)}>{k + 1}. {s.title}</button></li>)}
          </ol>
          <div aria-live="polite"><h5>{st.title}</h5><p>{st.text}</p></div>
          <div className="row">
            <button className="btn ghost" disabled={i === 0} onClick={() => setI(i - 1)}>← Назад</button>
            <button className="btn" disabled={i === demoSteps.length - 1} onClick={() => setI(i + 1)}>Дальше →</button>
          </div>
          <details><summary>Текстовая расшифровка всех шагов</summary><ol>{demoSteps.map((s) => <li key={s.id}><b>{s.title}.</b> {s.text}</li>)}</ol></details>
        </div>
      </div>
    </Frame>)
}

function SaltCurveW() {
  const [own, setOwn] = useState(0.65), [add, setAdd] = useState(0.8)
  const c = { etaMax: 11000, sPeak: 1.9, k: 1.689 }
  const xs = range(0.4, 3, 70), total = own + add, eta = saltViscosity(c, total)
  return (
    <Frame title="Солевая кривая: добавка одна, результат разный" note="Синтетическая кривая (учебная модель), 25 °C. Сдвигайте собственную соль сырья и смотрите, куда приводит одна и та же добавка.">
      <div className="wgrid">
        <div>
          <Slider label="Собственная соль сырья" value={own} min={0.4} max={1.4} step={0.05} onChange={setOwn} show={`${fmt(own, 3)} %`} />
          <Slider label="Добавка технолога" value={add} min={0} max={1.6} step={0.05} onChange={setAdd} show={`+${fmt(add, 3)} %`} />
          <dl className="readout">
            <div><dt>Общая соль</dt><dd className="num">{fmt(total, 3)} <small>%</small></dd></div>
            <div><dt>Вязкость</dt><dd className="num">{fmt(Math.round(eta / 10) * 10, 4)} <small>мПа·с · {eta < 6000 ? 'ниже нормы' : eta > 9000 ? 'выше нормы' : 'в норме'}, {total <= c.sPeak ? 'левый склон' : 'правый склон'}</small></dd></div>
          </dl>
        </div>
        <Chart title="Вязкость от общего содержания соли" xDomain={[0.4, 3]} yDomain={[0, 12000]} xLabel="Общее содержание NaCl, %" yLabel="Вязкость, мПа·с" cursor={Math.min(total, 3)}
          hlines={[{ y: 6000, label: 'норма от 6000' }, { y: 9000, label: 'до 9000' }]} markers={[{ x: own, label: 'до добавки' }]}
          series={[{ name: 'учебная кривая', color: 'var(--teal)', points: xs.map((x) => [x, saltViscosity(c, x)]) }]} />
      </div>
    </Frame>)
}

function InteractionW() {
  const [ea, setEa] = useState(10), [eb, setEb] = useState(6), [eab, setEab] = useState(7)
  const b0 = 30, y = (a: number, b: number) => b0 + (ea / 2) * a + (eb / 2) * b + (eab / 2) * a * b
  const ofat = y(-1, -1) + (y(1, -1) - y(-1, -1)) + (y(-1, 1) - y(-1, -1))
  return (
    <Frame title="Взаимодействие: когда «по одному» ошибается" note="Учебная модель с двумя факторами. Параллельные линии — взаимодействия нет; чем сильнее расходятся, тем больше ошибка прогноза «по одному».">
      <div className="wgrid">
        <div>
          <Slider label="Главный эффект A" value={ea} min={-20} max={30} step={1} onChange={setEa} show={fmt(ea)} />
          <Slider label="Главный эффект B" value={eb} min={-20} max={30} step={1} onChange={setEb} show={fmt(eb)} />
          <Slider label="Взаимодействие A × B" value={eab} min={-15} max={15} step={1} onChange={setEab} show={fmt(eab)} />
          <dl className="readout">
            <div><dt>Точка «оба высоких»: факт</dt><dd className="num">{fmt(y(1, 1), 3)}</dd></div>
            <div><dt>Прогноз «по одному» от базы</dt><dd className="num">{fmt(ofat, 3)} <small>ошибка {fmt(ofat - y(1, 1), 3)}</small></dd></div>
          </dl>
        </div>
        <Chart title="График взаимодействия" xDomain={[-1.2, 1.2]} yDomain={[0, 70]} xLabel="Уровень фактора A (−1 — нижний, +1 — верхний)" yLabel="Отклик, усл. ед."
          series={[{ name: 'B нижний', color: 'var(--teal)', dots: true, points: [[-1, y(-1, -1)], [1, y(1, -1)]] }, { name: 'B верхний', color: 'var(--coral)', dash: '7 4', dots: true, points: [[-1, y(-1, 1)], [1, y(1, 1)]] }]} />
      </div>
    </Frame>)
}

function PreservativeW() {
  const [ph, setPh] = useState(5.0), [pka, setPka] = useState(4.76)
  const f = (x: number, k: number) => 1 / (1 + Math.pow(10, x - k))
  const xs = range(3, 8, 60)
  return (
    <Frame title="Доля действующей формы кислоты-консерванта" note="Расчёт по уравнению Гендерсона — Хассельбальха. Значения pKa справочные (25 °C); расчёт — ориентир, защиту подтверждают испытанием.">
      <div className="wgrid">
        <div>
          <Slider label="pH продукта" value={ph} min={3} max={8} step={0.1} onChange={setPh} show={fmt(ph, 2)} />
          <div className="seg" role="group" aria-label="Кислота">{[['Сорбиновая, pKa ≈ 4,76', 4.76], ['Бензойная, pKa ≈ 4,2', 4.2]].map(([l, k]) => <label key={l as string} className={pka === k ? 'on' : ''}><input type="radio" name="pka" checked={pka === k} onChange={() => setPka(k as number)} />{l}</label>)}</div>
          <dl className="readout">
            <div><dt>Недиссоциированная форма</dt><dd className="num">{fmt(f(ph, pka) * 100, 3)} <small>%</small></dd></div>
            <div><dt>Относительно pH 5,0</dt><dd className="num">× {fmt(f(ph, pka) / f(5, pka), 2)}</dd></div>
          </dl>
        </div>
        <Chart title="Доля недиссоциированной кислоты от pH" xDomain={[3, 8]} yDomain={[0, 100]} xLabel="pH" yLabel="Недиссоциированная форма, %" cursor={ph}
          series={[{ name: 'сорбиновая', color: 'var(--teal)', points: xs.map((x) => [x, f(x, 4.76) * 100]) }, { name: 'бензойная', color: 'var(--coral)', dash: '7 4', points: xs.map((x) => [x, f(x, 4.2) * 100]) }]} />
      </div>
    </Frame>)
}
function MixReW() {
  const [lmu, setLmu] = useState(-3), [rpm, setRpm] = useState(120), [D, setD] = useState(0.4)
  const mu = Math.pow(10, lmu), N = rpm / 60, Re = (1000 * N * D * D) / mu
  const regime = Re > 1e4 ? 'турбулентный' : Re < 10 ? 'ламинарный' : 'переходный'
  return (
    <Frame title="Число Рейнольдса для мешалки" note="Плотность 1000 кг/м³. Границы режимов — типичные ориентиры для аппаратов с мешалками, а не точные значения для вашего аппарата.">
      <div className="wgrid">
        <div>
          <Slider label="Вязкость (лог. шкала)" value={lmu} min={-3} max={2} step={0.1} onChange={setLmu} show={`${fmt(mu, 2)} Па·с`} />
          <Slider label="Обороты" value={rpm} min={10} max={240} step={5} onChange={setRpm} show={`${rpm} об/мин = ${fmt(N, 3)} с⁻¹`} />
          <Slider label="Диаметр мешалки" value={D} min={0.2} max={1.2} step={0.02} onChange={setD} show={`${fmt(D, 3)} м`} />
        </div>
        <dl className="readout">
          <div><dt>Re = ρ·N·D²/μ</dt><dd className="num">{fmt(Re, 3)}</dd></div>
          <div><dt>Режим</dt><dd>{regime}</dd></div>
          <div><dt>Как мощность зависит от оборотов</dt><dd className="num">{Re > 1e4 ? 'P ∝ N³, от вязкости не зависит' : Re < 10 ? 'P ∝ μ·N²' : 'между N² и N³'}</dd></div>
        </dl>
      </div>
    </Frame>)
}

function MediaRegistry() {
  return (
    <div className="table-wrap" tabIndex={0}>
      <table><caption>Реестр использованных изображений</caption>
        <thead><tr><th>Изображение</th><th>Автор</th><th>Источник</th><th>Лицензия</th><th>Атрибуция</th></tr></thead>
        <tbody>{media.map((m) => (
          <tr key={m.file}><td><img src={mediaUrl(m.file)} alt="" style={{ width: 120, display: 'block' }} />{m.title}<br /><code>{m.file}</code></td>
            <td>{m.author}</td><td>{m.source}</td><td>{m.license}</td><td>{m.attribution}</td></tr>))}</tbody>
      </table>
    </div>)
}

export const widgets: Record<string, ComponentType> = {
  'media-registry': MediaRegistry, saltcurve: SaltCurveW, interaction: InteractionW, preservative: PreservativeW, mixre: MixReW,
  stokes: Stokes, flowcurve: FlowCurve, passes: Passes, cooling: Cooling, 'demo-destabilization': Demo,
}
