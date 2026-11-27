import { useState } from 'react'
import { language, tr } from '../../shared/locale'
import { Slider, fmt } from '../ui'

function Frame({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="widget exp-widget" aria-label={title}>
      <header><span className="wtag">{tr('Живое объяснение')}</span><h4>{title}</h4></header>
      {children}
      {note && <p className="wnote">{note}</p>}
    </section>
  )
}

/** 1. Интерактивный параметр упаковки ПАВ (CPP = v / (a₀·l_c)):
 *  крутишь площадь головки и объём хвоста → мицелла перестраивается в цилиндр, бислой LGN и обратную W/O. */
export function CppPackingWidget() {
  const en = language === 'en'
  const [a0, setA0] = useState(0.58) // нм² — площадь полярной головки
  const [tailBulk, setTailBulk] = useState(0.26) // v / l_c (нм²) — сечение гидрофобного хвоста

  const cpp = Number((tailBulk / a0).toFixed(2))
  const regime =
    cpp < 0.34
      ? 'sphere'
      : cpp < 0.52
        ? 'cylinder'
        : cpp <= 1.0
          ? 'bilayer'
          : 'inverse'

  const meta = {
    sphere: {
      ru: 'Сферические мицеллы (P < 1/3) · высокий ГЛБ · моющие ПАВ',
      en: 'Spherical micelles (P < 1/3) · high HLB · cleansing surfactants',
      color: '#0EA5E9',
    },
    cylinder: {
      ru: 'Червеобразные цилиндры (1/3 ≤ P < 1/2) · солевое загущение шампуня',
      en: 'Wormlike cylinders (1/3 ≤ P < 1/2) · salt thickening of shampoos',
      color: '#10B981',
    },
    bilayer: {
      ru: 'Ламеллярный бислой / LGN (1/2 ≤ P ≤ 1) · O/W-кремы и везикулы',
      en: 'Lamellar bilayer / LGN (1/2 ≤ P ≤ 1) · O/W creams & vesicles',
      color: '#8B5CF6',
    },
    inverse: {
      ru: 'Обратные мицеллы / W/O (P > 1) · низкий ГЛБ 3–6 · водостойкие бальзамы',
      en: 'Inverse micelles / W/O (P > 1) · low HLB 3–6 · water-resistant balms',
      color: '#F97316',
    },
  }[regime]

  const headR = Math.max(8, Math.min(22, a0 * 22))
  const tailHalfW = Math.max(4, Math.min(26, tailBulk * 52))

  return (
    <Frame
      title={tr('Параметр упаковки ПАВ (CPP): форма молекулы → тип структуры')}
      note={tr('Изменяйте площадь полярной головки a₀ (соль сжимает её за счёт экранирования) и разветвлённость хвоста v/l_c: критический параметр P = v / (a₀·l_c) диктует геометрию агрегата.')}
    >
      <div className="wgrid">
        <div>
          <Slider
            label={tr('Площадь полярной головки a₀')}
            value={a0}
            min={0.22}
            max={0.95}
            step={0.02}
            onChange={setA0}
            show={`${fmt(a0, 2)} ${tr('нм²')}`}
          />
          <Slider
            label={tr('Объём / разветвлённость хвоста (v/l_c)')}
            value={tailBulk}
            min={0.14}
            max={0.52}
            step={0.01}
            onChange={setTailBulk}
            show={`${fmt(tailBulk, 2)} ${tr('нм²')}`}
          />
          <dl className="readout">
            <div>
              <dt>CPP = v / (a₀ · l_c)</dt>
              <dd className="num" style={{ color: meta.color }}><b>{cpp.toFixed(2)}</b></dd>
            </div>
            <div>
              <dt>{tr('Самосборка')}</dt>
              <dd>{en ? meta.en : meta.ru}</dd>
            </div>
          </dl>
        </div>

        <svg viewBox="0 0 360 190" className="exp-svg" role="img" aria-label={en ? meta.en : meta.ru}>
          {/* Левая часть: форма одной молекулы */}
          <rect x="6" y="8" width="122" height="174" rx="14" fill="rgba(148,163,184,0.08)" stroke="rgba(148,163,184,0.28)" />
          <text x="67" y="26" textAnchor="middle" className="exp-cap">{tr('Молекула ПАВ')}</text>
          {/* Конус / цилиндр / обратный конус */}
          <polygon
            points={`${67 - headR},68 ${67 + headR},68 ${67 + tailHalfW},142 ${67 - tailHalfW},142`}
            fill={meta.color}
            opacity="0.16"
            stroke={meta.color}
            strokeDasharray="4 2"
          />
          <circle cx="67" cy="64" r={headR} fill={meta.color} stroke="#FFFFFF" strokeWidth="2" />
          <path d={`M67,${64 + headR} Q61,106 ${67 - tailHalfW * 0.45},142 M67,${64 + headR} Q73,106 ${67 + tailHalfW * 0.45},142`} fill="none" stroke="#F59E0B" strokeWidth="2.4" strokeLinecap="round" />
          <text x="67" y="168" textAnchor="middle" className="exp-cap num">P = {cpp.toFixed(2)}</text>

          {/* Правая часть: собираемый агрегат */}
          <rect x="138" y="8" width="216" height="174" rx="14" fill="rgba(14,165,233,0.06)" stroke="rgba(148,163,184,0.28)" />
          <text x="246" y="26" textAnchor="middle" className="exp-cap">{tr('Коллоидная структура')}</text>

          {regime === 'sphere' && (
            <g transform="translate(246,104)" className="exp-spin-slow">
              <circle cx="0" cy="0" r="24" fill="rgba(245,158,11,0.24)" />
              {Array.from({ length: 12 }).map((_, i) => {
                const a = (i * 2 * Math.PI) / 12
                return (
                  <g key={i}>
                    <line x1={Math.cos(a) * 10} y1={Math.sin(a) * 10} x2={Math.cos(a) * 44} y2={Math.sin(a) * 44} stroke="#F59E0B" strokeWidth="2" />
                    <circle cx={Math.cos(a) * 46} cy={Math.sin(a) * 46} r="6.5" fill="#0EA5E9" stroke="#FFF" strokeWidth="1.2" />
                  </g>
                )
              })}
            </g>
          )}

          {regime === 'cylinder' && (
            <g transform="translate(160,104)">
              <rect x="0" y="-22" width="172" height="44" rx="22" fill="rgba(245,158,11,0.22)" stroke="#10B981" strokeWidth="2" />
              {Array.from({ length: 9 }).map((_, i) => {
                const x = 14 + i * 18
                return (
                  <g key={i}>
                    <line x1={x} y1="-22" x2={x} y2="-4" stroke="#F59E0B" strokeWidth="1.8" />
                    <circle cx={x} cy="-24" r="5.2" fill="#10B981" />
                    <line x1={x} y1="22" x2={x} y2="4" stroke="#F59E0B" strokeWidth="1.8" />
                    <circle cx={x} cy="24" r="5.2" fill="#10B981" />
                  </g>
                )
              })}
            </g>
          )}

          {regime === 'bilayer' && (
            <g transform="translate(154,66)">
              {[0, 56].map((yOff, layer) => (
                <g key={layer} transform={`translate(0, ${yOff})`}>
                  <rect x="0" y="6" width="184" height="24" rx="4" fill="rgba(245,158,11,0.2)" />
                  {Array.from({ length: 11 }).map((_, i) => {
                    const x = 10 + i * 16.5
                    return (
                      <g key={i}>
                        <line x1={x} y1="6" x2={x} y2="17" stroke="#F59E0B" strokeWidth="1.6" />
                        <circle cx={x} cy="4" r="4.5" fill="#8B5CF6" />
                        <line x1={x} y1="30" x2={x} y2="19" stroke="#F59E0B" strokeWidth="1.6" />
                        <circle cx={x} cy="32" r="4.5" fill="#8B5CF6" />
                      </g>
                    )
                  })}
                </g>
              ))}
              <text x="92" y="50" textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#0284C7">H₂O (LGN)</text>
            </g>
          )}

          {regime === 'inverse' && (
            <g transform="translate(246,104)">
              <rect x="-86" y="-58" width="172" height="116" rx="12" fill="rgba(245,158,11,0.16)" />
              <circle cx="0" cy="0" r="24" fill="rgba(14,165,233,0.34)" stroke="#0284C7" strokeWidth="1.5" />
              <text x="0" y="4" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#0369A1">H₂O</text>
              {Array.from({ length: 12 }).map((_, i) => {
                const a = (i * 2 * Math.PI) / 12
                return (
                  <g key={i}>
                    <line x1={Math.cos(a) * 26} y1={Math.sin(a) * 26} x2={Math.cos(a) * 52} y2={Math.sin(a) * 52} stroke="#D97706" strokeWidth="2.2" />
                    <circle cx={Math.cos(a) * 24} cy={Math.sin(a) * 24} r="4.8" fill="#F97316" />
                  </g>
                )
              })}
            </g>
          )}
        </svg>
      </div>
    </Frame>
  )
}

/** 2. Живой симулятор ККМ и солюбилизации отдушки / масла. */
export function CmcSolubilizeWidget() {
  const en = language === 'en'
  const [ratio, setRatio] = useState(1.4) // c / CMC от 0 до 4.0

  const gamma = ratio < 1 ? Number((72 - 38 * Math.pow(ratio, 0.72)).toFixed(1)) : 34.0
  const micelles = ratio >= 1 ? Math.min(8, Math.round((ratio - 0.85) * 2.5)) : 0
  const solubilizedPct = ratio < 1 ? 0 : Math.min(100, Math.round(((ratio - 1) / 2.2) * 100))
  const clear = solubilizedPct >= 85
  const surfaceMonomers = Math.min(12, Math.max(1, Math.round(Math.min(1, ratio) * 12)))

  return (
    <Frame
      title={tr('ККМ и солюбилизация: как мицеллы «проглатывают» отдушку')}
      note={tr('Ниже 1× ККМ мономеры ПАВ заполняют поверхность раздела и роняют поверхностное натяжение γ. Выше ККМ γ выходит на плато, а в объёме собираются мицеллы, делающие раствор отдушки прозрачным.')}
    >
      <div className="wgrid">
        <div>
          <Slider
            label={tr('Концентрация ПАВ (c / ККМ)')}
            value={ratio}
            min={0.1}
            max={4.0}
            step={0.1}
            onChange={setRatio}
            show={`${fmt(ratio, 2)}× ${tr('ККМ')}`}
          />
          <dl className="readout">
            <div>
              <dt>{tr('Поверхностное натяжение γ')}</dt>
              <dd className="num"><b>{gamma}</b> <small>{tr('мН/м')}</small></dd>
            </div>
            <div>
              <dt>{tr('Солюбилизировано отдушки')}</dt>
              <dd className="num"><b>{solubilizedPct} %</b></dd>
            </div>
            <div>
              <dt>{tr('Внешний вид раствора')}</dt>
              <dd><b>{clear ? (en ? 'Crystal clear' : 'Прозрачный') : ratio >= 1 ? (en ? 'Opalescent' : 'Опалесцирующий') : (en ? 'Cloudy emulsion haze' : 'Мутная взвесь масла')}</b></dd>
            </div>
          </dl>
        </div>

        <svg viewBox="0 0 360 190" className="exp-svg" role="img" aria-label={tr('Симулятор ККМ и солюбилизации')}>
          {/* Стакан с раствором */}
          <rect
            x="16"
            y="38"
            width="160"
            height="136"
            rx="14"
            fill={clear ? 'rgba(14,165,233,0.14)' : ratio >= 1 ? 'rgba(148,163,184,0.2)' : 'rgba(245,158,11,0.18)'}
            stroke="#0284C7"
            strokeWidth="2"
          />
          {/* Поверхностный монослой ПАВ */}
          {Array.from({ length: surfaceMonomers }).map((_, i) => {
            const x = 28 + i * 12
            return (
              <g key={`sm-${i}`}>
                <line x1={x} y1="24" x2={x} y2="39" stroke="#F59E0B" strokeWidth="1.8" />
                <circle cx={x} cy="40" r="3.6" fill="#0EA5E9" />
              </g>
            )
          })}
          {/* Несолюбилизированные капли масла (исчезают выше ККМ) */}
          {solubilizedPct < 90 && (
            <g opacity={(100 - solubilizedPct) / 100}>
              <circle cx="64" cy="96" r="10" fill="#F59E0B" />
              <circle cx="128" cy="116" r="9" fill="#F59E0B" />
              <circle cx="88" cy="144" r="8" fill="#F59E0B" />
            </g>
          )}
          {/* Мицеллы с ядром масла внутри */}
          {Array.from({ length: micelles }).map((_, i) => {
            const cx = 46 + (i % 3) * 48
            const cy = 76 + Math.floor(i / 3) * 44
            return (
              <g key={`mc-${i}`} transform={`translate(${cx},${cy})`} className="rx-float">
                <circle cx="0" cy="0" r="14" fill="rgba(14,165,233,0.16)" stroke="#0EA5E9" strokeWidth="1.8" strokeDasharray="3 2" />
                <circle cx="0" cy="0" r="6" fill="#F59E0B" opacity="0.88" />
              </g>
            )
          })}
          <text x="96" y="186" textAnchor="middle" className="exp-cap">
            {ratio < 1 ? tr('Ниже ККМ') : tr('Выше ККМ (мицеллы)')}
          </text>

          {/* График γ(c/ККМ) справа */}
          <g transform="translate(194,20)">
            <line x1="20" y1="12" x2="20" y2="140" stroke="currentColor" opacity="0.4" />
            <line x1="20" y1="140" x2="156" y2="140" stroke="currentColor" opacity="0.4" />
            <line x1="54" y1="12" x2="54" y2="140" stroke="#F97316" strokeDasharray="4 3" opacity="0.7" />
            <text x="54" y="10" textAnchor="middle" fontSize="9" fontWeight="700" fill="#F97316">{tr('ККМ')}</text>
            <path d="M20,24 Q34,76 54,104 L152,104" fill="none" stroke="#0EA5E9" strokeWidth="2.4" />
            <circle cx={20 + (ratio / 4) * 132} cy={140 - ((gamma - 20) / 60) * 124} r="5.5" fill="#EF4444" stroke="#FFF" strokeWidth="1.8" />
            <text x="88" y="158" textAnchor="middle" className="exp-cap">c / {tr('ККМ')}</text>
            <text x="12" y="80" textAnchor="middle" transform="rotate(-90 12 80)" className="exp-cap">γ, {tr('мН/м')}</text>
          </g>
        </svg>
      </div>
    </Frame>
  )
}

/** 3. Интерактивная тепловая карта рубашки реактора и скребков. */
export function JacketHeatmapWidget() {
  const [visPas, setVisPas] = useState(12)
  const [scraperRpm, setScraperRpm] = useState(22)
  const [coolantC, setCoolantC] = useState(14)

  // Толщина холодного пристеночного слоя (мм): растёт с вязкостью, счищается скребками
  const crustMm = Number(Math.max(1.2, Math.min(26, (visPas * 1.15) / (0.6 + scraperRpm * 0.14))).toFixed(1))
  // Эффективный коэффициент теплопередачи U, Вт/(м²·К)
  const uCoeff = Math.round(Math.max(45, Math.min(480, 520 / (1 + crustMm * 0.34))))
  // Оценка времени охлаждения 500 кг крема 75 -> 35 °C
  const dTln = Math.max(8, (75 - 35) / Math.log(Math.max(1.2, (75 - coolantC) / Math.max(4, 35 - coolantC))))
  const coolMin = Math.round((500 * 3800 * 40) / (uCoeff * 2.8 * dTln * 60))

  const crustPx = Math.min(28, Math.max(4, crustMm * 1.1))

  return (
    <Frame
      title={tr('Тепловая карта рубашки реактора: пристеночный слой и скребки')}
      note={tr('Высоковязкий крем застывает у холодной стенки в изолирующую «шубу». Якорная мешалка со скребками срезает этот слой, в разы поднимая теплопередачу U и ускоряя охлаждение партии.')}
    >
      <div className="wgrid">
        <div>
          <Slider label={tr('Вязкость продукта у стенки')} value={visPas} min={1} max={35} step={1} onChange={setVisPas} show={`${visPas} ${tr('Па·с')}`} />
          <Slider label={tr('Скорость скребков (якорь)')} value={scraperRpm} min={0} max={45} step={1} onChange={setScraperRpm} show={`${scraperRpm} ${tr('об/мин')}`} />
          <Slider label={tr('Температура хладагента')} value={coolantC} min={5} max={25} step={1} onChange={setCoolantC} show={`${coolantC} °C`} />
          <dl className="readout">
            <div>
              <dt>{tr('Холодный пристеночный слой')}</dt>
              <dd className="num"><b>{crustMm}</b> <small>{tr('мм')}</small></dd>
            </div>
            <div>
              <dt>{tr('Теплопередача U · охлаждение 500 кг')}</dt>
              <dd className="num"><b>{uCoeff}</b> <small>{tr('Вт/(м²·К)')} · ~{coolMin} {tr('мин')}</small></dd>
            </div>
          </dl>
        </div>

        <svg viewBox="0 0 240 200" className="exp-svg" role="img" aria-label={tr('Тепловая карта сечения реактора')}>
          <defs>
            <radialGradient id="exp-core-heat">
              <stop offset="0%" stopColor="#EF4444" />
              <stop offset="68%" stopColor="#F97316" />
              <stop offset="100%" stopColor="#FDE047" />
            </radialGradient>
          </defs>
          {/* Рубашка охлаждения */}
          <circle cx="120" cy="96" r="82" fill="#0EA5E9" opacity="0.28" stroke="#0284C7" strokeWidth="3" />
          {/* Холодная пристеночная «шуба» продукта */}
          <circle cx="120" cy="96" r="72" fill="#38BDF8" opacity="0.72" />
          {/* Горячее ядро массы */}
          <circle cx="120" cy="96" r={Math.max(36, 72 - crustPx)} fill="url(#exp-core-heat)" />
          {/* Якорные скребки */}
          <g transform="translate(120,96)" className={scraperRpm > 0 ? 'exp-spin-slow' : ''}>
            <line x1="-68" y1="0" x2="68" y2="0" stroke="#1E293B" strokeWidth="4" strokeLinecap="round" />
            <rect x="-71" y="-10" width="6" height="20" rx="2" fill="#F8FAFC" stroke="#1E293B" strokeWidth="1.5" />
            <rect x="65" y="-10" width="6" height="20" rx="2" fill="#F8FAFC" stroke="#1E293B" strokeWidth="1.5" />
            <circle cx="0" cy="0" r="7" fill="#1E293B" />
          </g>
          <text x="120" y="192" textAnchor="middle" className="exp-cap">
            {tr('Ядро 72 °C')} · {tr('Слой')} {crustMm} {tr('мм')} · {tr('Рубашка')} {coolantC} °C
          </text>
        </svg>
      </div>
    </Frame>
  )
}

/** 4. Смачивание порошков и краевой угол Юнга (θ). */
export function WettingContactWidget() {
  const en = language === 'en'
  const [theta, setTheta] = useState(55) // градусы 15..135

  const rad = (theta * Math.PI) / 180
  const cosT = Number(Math.cos(rad).toFixed(2))
  const spreads = theta < 90
  // Аппроксимация профиля капли на поверхности порошка
  const baseHalf = Math.max(18, 68 - (theta - 15) * 0.42)
  const apexH = Math.max(12, 10 + (theta / 135) * 62)

  return (
    <Frame
      title={tr('Смачивание порошка и краевой угол Юнга (θ)')}
      note={tr('При θ < 90° (cos θ > 0) жидкость сама втягивается в капилляры между частицами порошка (уравнение Уошбёрна). При θ > 90° порошок плавает «комком» на поверхности и требует смачивателя или гликоля.')}
    >
      <div className="wgrid">
        <div>
          <Slider label={tr('Краевой угол смачивания θ')} value={theta} min={15} max={135} step={5} onChange={setTheta} show={`${theta}°`} />
          <dl className="readout">
            <div>
              <dt>cos θ ({tr('движущая сила капилляров')})</dt>
              <dd className="num" style={{ color: spreads ? '#059669' : '#DC2626' }}><b>{cosT > 0 ? `+${cosT}` : cosT}</b></dd>
            </div>
            <div>
              <dt>{tr('Поведение порошка / пигмента')}</dt>
              <dd><b>{spreads ? (en ? 'Spontaneous wetting & immersion' : 'Самопроизвольное смачивание и пропитка') : (en ? 'Non-wetting — clumps float on surface!' : 'Не смачивается — комки плавают сверху!')}</b></dd>
            </div>
          </dl>
        </div>

        <svg viewBox="0 0 320 170" className="exp-svg" role="img" aria-label={`θ = ${theta}°`}>
          {/* Слой порошка */}
          <rect x="20" y="122" width="280" height="32" rx="8" fill="rgba(148,163,184,0.22)" stroke="rgba(148,163,184,0.5)" />
          {Array.from({ length: 14 }).map((_, i) => (
            <circle key={i} cx={36 + i * 19} cy={138} r="5" fill="#94A3B8" opacity="0.65" />
          ))}
          {/* Капля жидкости */}
          <path
            d={`M${160 - baseHalf},122 Q160,${122 - apexH * 1.9} ${160 + baseHalf},122 Z`}
            fill={spreads ? 'rgba(14,165,233,0.45)' : 'rgba(249,115,22,0.45)'}
            stroke={spreads ? '#0284C7' : '#EA580C'}
            strokeWidth="2.4"
          />
          {/* Стрелка капиллярной пропитки */}
          {spreads && (
            <path d="M160,124 L160,148" stroke="#059669" strokeWidth="2.4" strokeDasharray="3 2" />
          )}
          <text x="160" y="28" textAnchor="middle" className="exp-cap num">
            θ = {theta}° · cos θ = {cosT}
          </text>
        </svg>
      </div>
    </Frame>
  )
}
