import { tr } from '../../shared/locale'
import { useState, ComponentType } from 'react'
import { Chart, Slider, fmt, range } from '../ui'
import { media, mediaUrl } from '../content'
import { saltViscosity } from '../models/physics'
import { stokesVelocity, hbViscosity, hbStress, unprocessed, coolingMinutes } from '../models/physics'

function Frame({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="widget" aria-label={title}>
      <header><span className="wtag">{tr("Интерактив")}</span><h4>{title}</h4></header>
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
    <Frame title={tr("Закон Стокса: какой рычаг сильнее")} note={tr("Учебная модель: одиночная сфера, ньютоновская среда. Меняйте один параметр за раз и следите за множителем.")}>
      <div className="wgrid">
        <div>
          <Slider label={tr("Диаметр капли d")} value={d} min={0.5} max={20} step={0.5} onChange={setD} show={`${fmt(d)}${tr(" мкм")}`} />
          <Slider label={tr("Разность плотностей Δρ")} value={dr} min={5} max={200} step={5} onChange={setDr} show={`${dr}${tr(" кг/м³")}`} />
          <Slider label={tr("Вязкость среды η (лог. шкала)")} value={le} min={-3} max={2} step={0.1} onChange={setLe} show={`${fmt(eta * 1000, 2)}${tr(" мПа·с")}`} />
        </div>
        <dl className="readout">
          <div><dt>{tr("Скорость")}</dt><dd className="num">{fmt(mmDay)} <small>{tr("мм/сут")}</small></dd></div>
          <div><dt>{tr("До слоя 1 мм")}</dt><dd className="num">{days1mm < 1 ? `${fmt(days1mm * 24, 2)}${tr(" ч")}` : days1mm < 730 ? `${fmt(days1mm, 2)}${tr(" сут")}` : `${fmt(days1mm / 365, 2)}${tr(" лет")}`}</dd></div>
          <div><dt>{tr("Относительно примера (5 мкм, 80 кг/м³, вода)")}</dt><dd className="num">× {fmt(v / base, 2)}</dd></div>
        </dl>
      </div>
    </Frame>)
}

function FlowCurve() {
  const [sy, setSy] = useState(10), [K, setK] = useState(15), [n, setN] = useState(0.5), [lr, setLr] = useState(0.6)
  const s = { sy, K, n }, rate = Math.pow(10, lr)
  const xs = range(0.001, 10000, 80, true)
  const zones = [{ x: 0.001, label: tr("хранение") }, { x: 1, label: tr("вискозиметр") }, { x: 100, label: tr("прокачка") }, { x: 3000, label: tr("нанесение") }]
  return (
    <Frame title={tr("Кривая течения: один образец — много вязкостей")} note="Учебная модель Гершеля — Балкли. При σ_y > 0 вязкость при малых скоростях сдвига растёт неограниченно — это модельное представление предела текучести.">
      <div className="wgrid">
        <div>
          <Slider label={tr("Предел текучести σ_y")} value={sy} min={0} max={50} step={1} onChange={setSy} show={`${sy}${tr(" Па")}`} />
          <Slider label={tr("Консистенция K")} value={K} min={1} max={50} step={1} onChange={setK} show={`${K}${tr(" Па·сⁿ")}`} />
          <Slider label={tr("Индекс течения n")} value={n} min={0.2} max={1} step={0.05} onChange={setN} show={fmt(n, 2)} />
          <Slider label={tr("Точка чтения: скорость сдвига")} value={lr} min={-3} max={4} step={0.1} onChange={setLr} show={`${fmt(rate, 2)}${tr(" с⁻¹")}`} />
          <dl className="readout">
            <div><dt>{tr("Вязкость в точке")}</dt><dd className="num">{fmt(hbViscosity(s, rate))} <small>{tr("Па·с")}</small></dd></div>
            <div><dt>{tr("Напряжение в точке")}</dt><dd className="num">{fmt(hbStress(s, rate))} <small>{tr("Па")}</small></dd></div>
          </dl>
        </div>
        <Chart title={tr("Вязкость от скорости сдвига")} xLog yLog xDomain={[0.001, 10000]} yDomain={[0.01, 100000]}
          xLabel={tr("Скорость сдвига, с⁻¹")} yLabel={tr("Вязкость, Па·с")} markers={zones} cursor={rate}
          series={[{ name: tr("образец"), color: 'var(--teal)', points: xs.map((x) => [x, hbViscosity(s, x)]) }]} />
      </div>
    </Frame>)
}

function Passes() {
  const [V, setV] = useState(2000), [Q, setQ] = useState(600), [t, setT] = useState(5)
  const n = (Q * t) / V, f = unprocessed(n)
  return (
    <Frame title={tr("Число проходов и необработанная доля")} note={tr("Допущение: идеальное перемешивание в реакторе. Реальная необработанная доля в вязком продукте выше.")}>
      <div className="wgrid">
        <div>
          <Slider label={tr("Объём партии V")} value={V} min={5} max={5000} step={5} onChange={setV} show={`${V}${tr(" л")}`} />
          <Slider label={tr("Производительность циркуляции Q")} value={Q} min={10} max={1500} step={10} onChange={setQ} show={`${Q}${tr(" л/мин")}`} />
          <Slider label={tr("Время гомогенизации t")} value={t} min={1} max={60} step={1} onChange={setT} show={`${t}${tr(" мин")}`} />
        </div>
        <div>
          <dl className="readout">
            <div><dt>{tr("Проходов n = Q·t/V")}</dt><dd className="num">{fmt(n, 3)}</dd></div>
            <div><dt>{tr("Не прошло через зону, e⁻ⁿ")}</dt><dd className="num">{fmt(f * 100, 2)} <small>%</small></dd></div>
          </dl>
          <div className="bar" role="img" aria-label={`${tr("Необработанная доля ")}${fmt(f * 100, 2)}${tr(" процента")}`}><span style={{ width: `${Math.max(f * 100, 0.5)}%` }} /></div>
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
    <Frame title={tr("Время охлаждения и масштаб")} note={tr("Учебная модель: геометрически подобные аппараты, U = 300 Вт/(м²·К), c_p = 3,8 кДж/(кг·К), охлаждение 75 → 40 °C. Тепло от мешалок и рост вязкости не учтены.")}>
      <div className="wgrid">
        <div>
          <Slider label={tr("Масса партии (лог. шкала)")} value={lm} min={Math.log10(5)} max={Math.log10(5000)} step={0.01} onChange={setLm} show={`${fmt(m, 2)}${tr(" кг")}`} />
          <Slider label={tr("Температура хладагента")} value={Tc} min={5} max={30} step={1} onChange={setTc} show={`${Tc} °C`} />
          <dl className="readout">
            <div><dt>{tr("Площадь рубашки")}</dt><dd className="num">{fmt(A, 2)} <small>{tr("м²")}</small></dd></div>
            <div><dt>{tr("Поверхность / масса")}</dt><dd className="num">{fmt((A / m) * 1000, 2)} <small>{tr("м²/т")}</small></dd></div>
            <div><dt>{tr("Время охлаждения")}</dt><dd className="num">{fmt(t, 2)} <small>{tr("мин")}</small></dd></div>
          </dl>
        </div>
        <Chart title={tr("Время охлаждения от массы партии")} xLog xDomain={[5, 5000]} yDomain={[0, 120]} xLabel={tr("Масса партии, кг")} yLabel={tr("Время охлаждения, мин")} cursor={m}
          series={[{ name: `${tr("хладагент ")}${Tc} °C`, color: 'var(--coral)', points: ms.map((x) => [x, coolingMinutes(x, 3800, 300, 7 * Math.pow(x / 2000, 2 / 3), 75, 40, Tc)]) }]} />
      </div>
    </Frame>)
}

// Пошаговая визуальная демонстрация (вместо видео): механизмы разрушения эмульсии
const demoSteps = [
  { id: 'fresh', title: tr("Свежая эмульсия"), text: tr("Капли распределены по объёму равномерно. Система выглядит однородной, но она неравновесна: у неё избыток поверхности раздела.") },
  { id: 'floc', title: tr("Флокуляция"), text: tr("Капли слипаются в гроздья, но плёнки между ними целы — размер каждой капли прежний. Гроздь движется как одна крупная частица.") },
  { id: 'cream', title: tr("Кримирование"), text: tr("Капли и флокулы легче воды и всплывают. Внизу появляется обеднённый слой. Капли по-прежнему отдельные: встряхивание вернёт однородность.") },
  { id: 'coal', title: tr("Коалесценция"), text: tr("В плотном слое плёнки между каплями рвутся, капли сливаются. Число капель падает, размер растёт. Это необратимо; в пределе — слой свободного масла.") },
  { id: 'ost', title: tr("Оствальдово созревание"), text: tr("Другой путь, без контакта капель: мелкие растворяются, вещество диффундирует через воду и осаждается на крупных. Мелкие исчезают, крупные растут.") },
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
    <Frame title={tr("Пошаговая демонстрация: пути разрушения эмульсии")} note={tr("Схематическая визуализация, не микрофотография. Размеры и число капель условны.")}>
      <div className="demo">
        <svg viewBox="0 0 160 240" className="vial" role="img" aria-label={`${st.title}. ${st.text}`}>
          <rect x="4" y="4" width="152" height="232" rx="14" fill="#E4F4F2" stroke="var(--ink)" strokeWidth="2" />
          {st.id === 'coal' && <rect x="5" y="5" width="150" height="16" rx="10" fill="#FFB38A" opacity=".9" />}
          {drops.map((d, k) => <circle key={k} cx={d.x} cy={d.y} r={d.r} fill="#FFB38A" stroke="#C4532B" strokeWidth=".8" />)}
        </svg>
        <div className="demo-text">
          <ol className="steps" aria-label={tr("Шаги демонстрации")}>
            {demoSteps.map((s, k) => <li key={s.id}><button className={k === i ? 'on' : ''} aria-current={k === i} onClick={() => setI(k)}>{k + 1}. {s.title}</button></li>)}
          </ol>
          <div aria-live="polite"><h5>{st.title}</h5><p>{st.text}</p></div>
          <div className="row">
            <button className="btn ghost" disabled={i === 0} onClick={() => setI(i - 1)}>{tr("← Назад")}</button>
            <button className="btn" disabled={i === demoSteps.length - 1} onClick={() => setI(i + 1)}>{tr("Дальше →")}</button>
          </div>
          <details><summary>{tr("Текстовая расшифровка всех шагов")}</summary><ol>{demoSteps.map((s) => <li key={s.id}><b>{s.title}.</b> {s.text}</li>)}</ol></details>
        </div>
      </div>
    </Frame>)
}

function SaltCurveW() {
  const [own, setOwn] = useState(0.65), [add, setAdd] = useState(0.8)
  const c = { etaMax: 11000, sPeak: 1.9, k: 1.689 }
  const xs = range(0.4, 3, 70), total = own + add, eta = saltViscosity(c, total)
  return (
    <Frame title={tr("Солевая кривая: добавка одна, результат разный")} note={tr("Синтетическая кривая (учебная модель), 25 °C. Сдвигайте собственную соль сырья и смотрите, куда приводит одна и та же добавка.")}>
      <div className="wgrid">
        <div>
          <Slider label={tr("Собственная соль сырья")} value={own} min={0.4} max={1.4} step={0.05} onChange={setOwn} show={`${fmt(own, 3)} %`} />
          <Slider label={tr("Добавка технолога")} value={add} min={0} max={1.6} step={0.05} onChange={setAdd} show={`+${fmt(add, 3)} %`} />
          <dl className="readout">
            <div><dt>{tr("Общая соль")}</dt><dd className="num">{fmt(total, 3)} <small>%</small></dd></div>
            <div><dt>{tr("Вязкость")}</dt><dd className="num">{fmt(Math.round(eta / 10) * 10, 4)} <small>{tr("мПа·с · ")}{eta < 6000 ? tr("ниже нормы") : eta > 9000 ? tr("выше нормы") : tr("в норме")}, {total <= c.sPeak ? tr("левый склон") : tr("правый склон")}</small></dd></div>
          </dl>
        </div>
        <Chart title={tr("Вязкость от общего содержания соли")} xDomain={[0.4, 3]} yDomain={[0, 12000]} xLabel={tr("Общее содержание NaCl, %")} yLabel={tr("Вязкость, мПа·с")} cursor={Math.min(total, 3)}
          hlines={[{ y: 6000, label: tr("норма от 6000") }, { y: 9000, label: tr("до 9000") }]} markers={[{ x: own, label: tr("до добавки") }]}
          series={[{ name: tr("учебная кривая"), color: 'var(--teal)', points: xs.map((x) => [x, saltViscosity(c, x)]) }]} />
      </div>
    </Frame>)
}

function InteractionW() {
  const [ea, setEa] = useState(10), [eb, setEb] = useState(6), [eab, setEab] = useState(7)
  const b0 = 30, y = (a: number, b: number) => b0 + (ea / 2) * a + (eb / 2) * b + (eab / 2) * a * b
  const ofat = y(-1, -1) + (y(1, -1) - y(-1, -1)) + (y(-1, 1) - y(-1, -1))
  return (
    <Frame title={tr("Взаимодействие: когда «по одному» ошибается")} note={tr("Учебная модель с двумя факторами. Параллельные линии — взаимодействия нет; чем сильнее расходятся, тем больше ошибка прогноза «по одному».")}>
      <div className="wgrid">
        <div>
          <Slider label={tr("Главный эффект A")} value={ea} min={-20} max={30} step={1} onChange={setEa} show={fmt(ea)} />
          <Slider label={tr("Главный эффект B")} value={eb} min={-20} max={30} step={1} onChange={setEb} show={fmt(eb)} />
          <Slider label={tr("Взаимодействие A × B")} value={eab} min={-15} max={15} step={1} onChange={setEab} show={fmt(eab)} />
          <dl className="readout">
            <div><dt>{tr("Точка «оба высоких»: факт")}</dt><dd className="num">{fmt(y(1, 1), 3)}</dd></div>
            <div><dt>{tr("Прогноз «по одному» от базы")}</dt><dd className="num">{fmt(ofat, 3)} <small>{tr("ошибка ")}{fmt(ofat - y(1, 1), 3)}</small></dd></div>
          </dl>
        </div>
        <Chart title={tr("График взаимодействия")} xDomain={[-1.2, 1.2]} yDomain={[0, 70]} xLabel={tr("Уровень фактора A (−1 — нижний, +1 — верхний)")} yLabel={tr("Отклик, усл. ед.")}
          series={[{ name: tr("B нижний"), color: 'var(--teal)', dots: true, points: [[-1, y(-1, -1)], [1, y(1, -1)]] }, { name: tr("B верхний"), color: 'var(--coral)', dash: '7 4', dots: true, points: [[-1, y(-1, 1)], [1, y(1, 1)]] }]} />
      </div>
    </Frame>)
}

function PreservativeW() {
  const [ph, setPh] = useState(5.0), [pka, setPka] = useState(4.76)
  const f = (x: number, k: number) => 1 / (1 + Math.pow(10, x - k))
  const xs = range(3, 8, 60)
  return (
    <Frame title={tr("Доля действующей формы кислоты-консерванта")} note={tr("Расчёт по уравнению Гендерсона — Хассельбальха. Значения pKa справочные (25 °C); расчёт — ориентир, защиту подтверждают испытанием.")}>
      <div className="wgrid">
        <div>
          <Slider label={tr("pH продукта")} value={ph} min={3} max={8} step={0.1} onChange={setPh} show={fmt(ph, 2)} />
          <div className="seg" role="group" aria-label={tr("Кислота")}>{[[tr("Сорбиновая, pKa ≈ 4,76"), 4.76], [tr("Бензойная, pKa ≈ 4,2"), 4.2]].map(([l, k]) => <label key={l as string} className={pka === k ? 'on' : ''}><input type="radio" name="pka" checked={pka === k} onChange={() => setPka(k as number)} />{l}</label>)}</div>
          <dl className="readout">
            <div><dt>{tr("Недиссоциированная форма")}</dt><dd className="num">{fmt(f(ph, pka) * 100, 3)} <small>%</small></dd></div>
            <div><dt>{tr("Относительно pH 5,0")}</dt><dd className="num">× {fmt(f(ph, pka) / f(5, pka), 2)}</dd></div>
          </dl>
        </div>
        <Chart title={tr("Доля недиссоциированной кислоты от pH")} xDomain={[3, 8]} yDomain={[0, 100]} xLabel="pH" yLabel={tr("Недиссоциированная форма, %")} cursor={ph}
          series={[{ name: tr("сорбиновая"), color: 'var(--teal)', points: xs.map((x) => [x, f(x, 4.76) * 100]) }, { name: tr("бензойная"), color: 'var(--coral)', dash: '7 4', points: xs.map((x) => [x, f(x, 4.2) * 100]) }]} />
      </div>
    </Frame>)
}
function MixReW() {
  const [lmu, setLmu] = useState(-3), [rpm, setRpm] = useState(120), [D, setD] = useState(0.4)
  const mu = Math.pow(10, lmu), N = rpm / 60, Re = (1000 * N * D * D) / mu
  const regime = Re > 1e4 ? tr("турбулентный") : Re < 10 ? tr("ламинарный") : tr("переходный")
  return (
    <Frame title={tr("Число Рейнольдса для мешалки")} note={tr("Плотность 1000 кг/м³. Границы режимов — типичные ориентиры для аппаратов с мешалками, а не точные значения для вашего аппарата.")}>
      <div className="wgrid">
        <div>
          <Slider label={tr("Вязкость (лог. шкала)")} value={lmu} min={-3} max={2} step={0.1} onChange={setLmu} show={`${fmt(mu, 2)}${tr(" Па·с")}`} />
          <Slider label={tr("Обороты")} value={rpm} min={10} max={240} step={5} onChange={setRpm} show={`${rpm}${tr(" об/мин = ")}${fmt(N, 3)}${tr(" с⁻¹")}`} />
          <Slider label={tr("Диаметр мешалки")} value={D} min={0.2} max={1.2} step={0.02} onChange={setD} show={`${fmt(D, 3)}${tr(" м")}`} />
        </div>
        <dl className="readout">
          <div><dt>Re = ρ·N·D²/μ</dt><dd className="num">{fmt(Re, 3)}</dd></div>
          <div><dt>{tr("Режим")}</dt><dd>{regime}</dd></div>
          <div><dt>{tr("Как мощность зависит от оборотов")}</dt><dd className="num">{Re > 1e4 ? tr("P ∝ N³, от вязкости не зависит") : Re < 10 ? 'P ∝ μ·N²' : tr("между N² и N³")}</dd></div>
        </dl>
      </div>
    </Frame>)
}

function DilutionW() {
  const [w1, setW1] = useState(50), [w2, setW2] = useState(10), [m2, setM2] = useState(30), [rho, setRho] = useState(1.52)
  const m1 = (m2 * w2) / w1, water = m2 - m1, v1 = m1 / rho
  return (
    <Frame title={tr("Разбавление: сколько концентрата и воды")} note={tr("Сохраняется масса растворённого вещества: m₁·w₁ = m₂·w₂. Плотность нужна только для пересчёта массы концентрата в объём.")}>
      <div className="wgrid">
        <div>
          <Slider label={tr("Концентрация исходного раствора w₁")} value={w1} min={5} max={99} step={1} onChange={(v) => { setW1(v); if (w2 >= v) setW2(Math.max(1, v - 1)) }} show={`${w1} %`} />
          <Slider label={tr("Нужная концентрация w₂")} value={w2} min={1} max={Math.max(1, w1 - 1)} step={0.5} onChange={setW2} show={`${fmt(w2, 3)} %`} />
          <Slider label={tr("Нужная масса раствора m₂")} value={m2} min={1} max={200} step={1} onChange={setM2} show={`${m2}${tr(" кг")}`} />
          <Slider label={tr("Плотность исходного раствора")} value={rho} min={0.8} max={1.9} step={0.01} onChange={setRho} show={`${fmt(rho, 3)}${tr(" кг/л")}`} />
        </div>
        <dl className="readout">
          <div><dt>{tr("Исходного раствора")}</dt><dd className="num">{fmt(m1, 3)} <small>{tr("кг · ")}{fmt(v1, 3)}{tr(" л")}</small></dd></div>
          <div><dt>{tr("Воды")}</dt><dd className="num">{fmt(water, 3)} <small>{tr("кг")}</small></dd></div>
          <div><dt>{tr("Если отмерить ")}{fmt(m1, 3)}{tr(" литров вместо килограммов")}</dt><dd className="num">{fmt((m1 * rho * w1) / (m1 * rho + water), 3)} <small>{tr("% вместо ")}{fmt(w2, 3)} %</small></dd></div>
        </dl>
      </div>
    </Frame>)
}
function BufferW() {
  const [pka, setPka] = useState(3.86), [C, setC] = useState(0.1), [ph0, setPh0] = useState(4.5)
  const xs = range(0, 0.06, 61)
  // начальное соотношение форм задаётся pH0; добавляем сильную кислоту x моль/л
  const r0 = Math.pow(10, ph0 - pka), A0 = (C * r0) / (1 + r0), HA0 = C - A0
  const phBuf = (x: number) => { const A = A0 - x, HA = HA0 + x; if (A <= 1e-6) return Math.max(-Math.log10(Math.max(x - A0, 1e-9)), 0.5); return pka + Math.log10(A / HA) }
  const phWater = (x: number) => (x < 1e-7 ? ph0 : Math.min(ph0, -Math.log10(x)))
  const ka = Math.pow(10, -pka), h = Math.pow(10, -ph0), beta = (2.303 * C * ka * h) / Math.pow(ka + h, 2)
  return (
    <Frame title={tr("Буфер против небуферированной системы")} note={tr("Учебная модель: одна слабая кислота и её соль, уравнение Гендерсона — Хассельбальха, концентрации вместо активностей. Для «без буфера» pH задаётся только добавленной сильной кислотой.")}>
      <div className="wgrid">
        <div>
          <Slider label={tr("pKa слабой кислоты")} value={pka} min={2.5} max={7} step={0.01} onChange={setPka} show={fmt(pka, 3)} />
          <Slider label={tr("Общая концентрация буфера C")} value={C} min={0.01} max={0.3} step={0.01} onChange={setC} show={`${fmt(C, 2)}${tr(" моль/л")}`} />
          <Slider label={tr("Исходный pH")} value={ph0} min={2.5} max={7} step={0.05} onChange={setPh0} show={fmt(ph0, 3)} />
          <dl className="readout"><div><dt>{tr("Буферная ёмкость при исходном pH")}</dt><dd className="num">{fmt(beta, 2)} <small>{tr("моль/(л·ед. pH) · максимум ")}{fmt(0.576 * C, 2)}{tr(" при pH = pKa")}</small></dd></div></dl>
        </div>
        <Chart title={tr("pH при добавлении сильной кислоты")} xDomain={[0, 0.06]} yDomain={[0, 7.5]} xLabel={tr("Добавлено сильной кислоты, моль/л")} yLabel="pH"
          series={[{ name: tr("с буфером"), color: 'var(--teal)', points: xs.map((x) => [x, phBuf(x)]) }, { name: tr("без буфера"), color: 'var(--coral)', dash: '7 4', points: xs.map((x) => [x, phWater(x)]) }]} />
      </div>
    </Frame>)
}

function DisperseW() {
  const [ld, setLd] = useState(0) // lg d, мкм
  const d = Math.pow(10, ld), r = (d * 1e-6) / 2, eta = 0.89e-3, kT = 4.11e-21
  const S = 6 / (d * 1e-6) * 1e-6 // м² на 1 см³
  const D = kT / (6 * Math.PI * eta * r), brown = Math.sqrt(2 * D) * 1e6 // мкм за 1 с
  const stokes = (80 * 9.81 * Math.pow(d * 1e-6, 2)) / (18 * eta) * 1e6 // мкм/с
  return (
    <Frame title={tr("Размер частицы: поверхность, броуновское движение и всплывание")} note={tr("Вода при 25 °C (0,89 мПа·с), разность плотностей 80 кг/м³. Броуновское смещение случайно и не накапливается в одну сторону; всплывание — направленное.")}>
      <div className="wgrid">
        <div><Slider label={tr("Диаметр капли (лог. шкала)")} value={ld} min={-1.7} max={1.7} step={0.05} onChange={setLd} show={`${fmt(d, 3)}${tr(" мкм")}`} /></div>
        <dl className="readout">
          <div><dt>{tr("Поверхность капель из 1 см³ масла")}</dt><dd className="num">{fmt(S, 3)} <small>{tr("м²")}</small></dd></div>
          <div><dt>{tr("Броуновское смещение за 1 с")}</dt><dd className="num">{fmt(brown, 3)} <small>{tr("мкм")}</small></dd></div>
          <div><dt>{tr("Всплывание по Стоксу за 1 с · за сутки")}</dt><dd className="num">{fmt(stokes, 3)} <small>{tr("мкм · ")}{fmt(stokes * 86400 / 1000, 3)}{tr(" мм")}</small></dd></div>
          <div><dt>{tr("Что преобладает за 1 с")}</dt><dd>{brown > stokes ? tr("тепловое движение") : tr("всплывание")}</dd></div>
        </dl>
      </div>
    </Frame>)
}
function DebyeW() {
  const [lc, setLc] = useState(-3), [type, setType] = useState<'11' | '21' | '22'>('11')
  const c = Math.pow(10, lc), I = type === '11' ? c : type === '21' ? 3 * c : 4 * c, L = 0.304 / Math.sqrt(I)
  const xs = range(-4, 0, 41)
  const curve = (k: number) => xs.map((x) => [Math.pow(10, x), 0.304 / Math.sqrt(k * Math.pow(10, x))] as [number, number])
  return (
    <Frame title={tr("Дебаевская длина и ионная сила")} note={tr("Водные растворы при 25 °C: κ⁻¹ ≈ 0,304/√I нм. Для CaCl₂ I = 3c, для MgSO₄ I = 4c.")}>
      <div className="wgrid">
        <div>
          <div className="seg" role="group" aria-label={tr("Электролит")}>{([['11', 'NaCl (1:1)'], ['21', 'CaCl₂ (2:1)'], ['22', 'MgSO₄ (2:2)']] as const).map(([k, l]) => <label key={k} className={type === k ? 'on' : ''}><input type="radio" name="el" checked={type === k} onChange={() => setType(k)} />{l}</label>)}</div>
          <Slider label={tr("Концентрация соли (лог. шкала)")} value={lc} min={-4} max={0} step={0.05} onChange={setLc} show={`${fmt(c, 2)}${tr(" моль/л")}`} />
          <dl className="readout">
            <div><dt>{tr("Ионная сила I")}</dt><dd className="num">{fmt(I, 3)} <small>{tr("моль/л")}</small></dd></div>
            <div><dt>{tr("Дебаевская длина")}</dt><dd className="num">{fmt(L, 3)} <small>{tr("нм")}</small></dd></div>
          </dl>
        </div>
        <Chart title={tr("Дебаевская длина от концентрации соли")} xLog yLog xDomain={[0.0001, 1]} yDomain={[0.1, 100]} xLabel={tr("Концентрация соли, моль/л")} yLabel={tr("Дебаевская длина, нм")} cursor={c}
          series={[{ name: 'NaCl', color: 'var(--teal)', points: curve(1) }, { name: 'CaCl₂', color: 'var(--coral)', dash: '7 4', points: curve(3) }, { name: 'MgSO₄', color: '#6B4FC8', dash: '2 4', points: curve(4) }]} />
      </div>
    </Frame>)
}
function PipeW() {
  const [mu, setMu] = useState(10), [Qh, setQh] = useState(2), [dmm, setDmm] = useState(50), [L, setL] = useState(10)
  const Q = Qh / 3600, d = dmm / 1000, v = Q / (Math.PI * d * d / 4), Re = (1000 * v * d) / mu
  const dp = (128 * mu * L * Q) / (Math.PI * Math.pow(d, 4)) / 1e5, gw = (32 * Q) / (Math.PI * Math.pow(d, 3))
  return (
    <Frame title={tr("Перепад давления в шланге (уравнение Хагена — Пуазейля)")} note={tr("Ньютоновская оценка для ламинарного режима; для псевдопластичного продукта подставляйте кажущуюся вязкость при скорости сдвига у стенки. Местные сопротивления не учтены.")}>
      <div className="wgrid">
        <div>
          <Slider label={tr("Кажущаяся вязкость")} value={mu} min={0.5} max={60} step={0.5} onChange={setMu} show={`${fmt(mu, 3)}${tr(" Па·с")}`} />
          <Slider label={tr("Расход")} value={Qh} min={0.2} max={6} step={0.1} onChange={setQh} show={`${fmt(Qh, 2)}${tr(" м³/ч")}`} />
          <Slider label={tr("Внутренний диаметр")} value={dmm} min={20} max={100} step={5} onChange={setDmm} show={`${dmm}${tr(" мм")}`} />
          <Slider label={tr("Длина")} value={L} min={1} max={50} step={1} onChange={setL} show={`${L}${tr(" м")}`} />
        </div>
        <dl className="readout">
          <div><dt>{tr("Перепад давления")}</dt><dd className="num">{fmt(dp, 3)} <small>{tr("бар")}</small></dd></div>
          <div><dt>{tr("Число Рейнольдса")}</dt><dd className="num">{fmt(Re, 3)} <small>{Re < 2000 ? tr("ламинарный режим") : tr("формула неприменима: режим не ламинарный")}</small></dd></div>
          <div><dt>{tr("Скорость · скорость сдвига у стенки")}</dt><dd className="num">{fmt(v, 3)} <small>{tr("м/с · ")}{fmt(gw, 3)}{tr(" с⁻¹")}</small></dd></div>
        </dl>
      </div>
    </Frame>)
}
function WallW() {
  const [a1, setA1] = useState(150), [a2, setA2] = useState(2000), [dl, setDl] = useState(6), [lam, setLam] = useState(16)
  const r1 = 1 / a1, rw = dl / 1000 / lam, r2 = 1 / a2, sum = r1 + rw + r2, K = 1 / sum
  const parts = [[tr("продукт"), r1, 'var(--coral)'], [tr("стенка"), rw, '#8A7D9A'], [tr("хладагент"), r2, 'var(--teal)']] as const
  return (
    <Frame title={tr("Коэффициент теплопередачи как сумма сопротивлений")} note={tr("Учебные порядки величин. Самое большое сопротивление определяет результат: меняйте его — и K растёт заметно; меняйте малые — почти не растёт.")}>
      <div className="wgrid">
        <div>
          <Slider label={tr("Теплоотдача со стороны продукта α₁")} value={a1} min={30} max={1500} step={10} onChange={setA1} show={`${a1}${tr(" Вт/(м²·К)")}`} />
          <Slider label={tr("Теплоотдача со стороны хладагента α₂")} value={a2} min={500} max={6000} step={100} onChange={setA2} show={`${a2}${tr(" Вт/(м²·К)")}`} />
          <Slider label={tr("Толщина стенки")} value={dl} min={2} max={15} step={0.5} onChange={setDl} show={`${fmt(dl, 3)}${tr(" мм")}`} />
          <Slider label={tr("Теплопроводность стенки λ")} value={lam} min={10} max={60} step={1} onChange={setLam} show={`${lam}${tr(" Вт/(м·К)")}`} />
        </div>
        <div>
          <dl className="readout"><div><dt>{tr("Коэффициент теплопередачи K")}</dt><dd className="num">{fmt(K, 3)} <small>{tr("Вт/(м²·К)")}</small></dd></div></dl>
          <div className="stack" role="img" aria-label={parts.map(([n, r]) => `${n} ${Math.round((r / sum) * 100)} %`).join(', ')}>
            {parts.map(([n, r, c]) => <span key={n} style={{ width: `${(r / sum) * 100}%`, background: c }} title={`${n}: ${Math.round((r / sum) * 100)} %`} />)}
          </div>
          <p className="small">{parts.map(([n, r]) => `${n} — ${Math.round((r / sum) * 100)} %`).join(' · ')}</p>
        </div>
      </div>
    </Frame>)
}

function MediaRegistry() {
  return (
    <div className="table-wrap" tabIndex={0}>
      <table><caption>{tr("Реестр использованных изображений")}</caption>
        <thead><tr><th>{tr("Изображение")}</th><th>{tr("Автор")}</th><th>{tr("Источник")}</th><th>{tr("Лицензия")}</th><th>{tr("Атрибуция")}</th></tr></thead>
        <tbody>{media.map((m) => (
          <tr key={m.file}><td><img src={mediaUrl(m.file)} alt="" style={{ width: 120, display: 'block' }} />{m.title}<br /><code>{m.file}</code></td>
            <td>{m.author}</td><td>{m.source}</td><td>{m.license}</td><td>{m.attribution}</td></tr>))}</tbody>
      </table>
    </div>)
}

export const widgets: Record<string, ComponentType> = {
  'media-registry': MediaRegistry, saltcurve: SaltCurveW, interaction: InteractionW, preservative: PreservativeW, mixre: MixReW, dilution: DilutionW, buffer: BufferW, disperse: DisperseW, debye: DebyeW, pipe: PipeW, wall: WallW,
  stokes: Stokes, flowcurve: FlowCurve, passes: Passes, cooling: Cooling, 'demo-destabilization': Demo,
}
