// Детерминированные модули «Лаборатории 3.0»:
// 1) Симулятор ускоренного старения (центрифуга, термоциклы, термостат +45 °C, фотостабильность)
// 2) Сенсорный профиль («Сенсорная паутинка» по 6 осям)
// 3) Генератор пошагового протокола варки (SOP) с критическими контрольными точками (CCP)
// 4) Подбор аналогов сырья

import type { FormulaEvaluation, FormulaInput, Ingredient, Phase } from './formulation'
import { language, tr } from './locale'

export type StabilityVerdict = 'pass' | 'warn' | 'fail'
export type TubeVisual = 'uniform' | 'creaming' | 'split' | 'crystals' | 'darkened' | 'syneresis'

export interface StabilityTestResult {
  id: 'centrifuge' | 'freeze-thaw' | 'oven45' | 'photostability'
  title: string
  condition: string
  verdict: StabilityVerdict
  tubeVisual: TubeVisual
  headline: string
  mechanism: string
  advice: string
}

export interface SensoryAxis {
  id: 'spreadability' | 'lightness' | 'nonSticky' | 'noSoaping' | 'velvet' | 'absorption'
  label: string
  shortLabel: string
  score: number // 0..100
  note: string
}

export interface SensoryProfile {
  axes: SensoryAxis[]
  archetype: string
  summary: string
}

export interface ProtocolStep {
  stepNo: number
  phase: Phase | 'EMUL' | 'QC'
  title: string
  tempTarget: string
  mixing: string
  actions: string[]
  ccp?: string
}

export interface SubstituteSuggestion {
  ingredient: Ingredient
  reason: string
  deltaNote: string
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)))

/**
 * Моделирует 4 стандартных ускоренных испытания стабильности для текущей формулы:
 * центрифуга 3000 об/мин, 3 цикла заморозка/оттаивание, термостат +45 °C (30 сут.) и фототест.
 */
export function simulateAcceleratedStability(
  ev: FormulaEvaluation,
  input: FormulaInput,
): StabilityTestResult[] {
  const pctMap = new Map<string, number>()
  for (const r of ev.rows) pctMap.set(r.ingredient.id, (pctMap.get(r.ingredient.id) ?? 0) + r.pct)
  const pctOf = (id: string) => pctMap.get(id) ?? 0
  const has = (id: string) => pctOf(id) > 0
  const hasCode = (prefix: string) => ev.issues.some((i) => i.code === prefix || i.code.startsWith(prefix))

  const hasOil = ev.oilPhasePct >= 1
  const hasThickenerA = ev.rows.some((r) => r.pct > 0 && r.phase === 'A' && r.ingredient.role === 'thickener')
  const hasWaxStruct = (pctOf('cetearyl-alcohol') + pctOf('cetyl-alcohol') + pctOf('behenyl-alcohol') + pctOf('beeswax') + pctOf('candelilla-wax')) >= 2
  const hasAntioxidant = ev.rows.some((r) => r.pct > 0 && r.ingredient.role === 'antioxidant')
  const hasChelator = ev.rows.some((r) => r.pct > 0 && r.ingredient.role === 'chelator')
  const hasPreservative = ev.rows.some((r) => r.pct > 0 && r.ingredient.role === 'preservative')

  const phaseSplit = hasCode('hlb:no-emulsifier') || hasCode('hlb:mismatch')
  const hlbDrift = hasCode('hlb:drift')
  const gelCollapse =
    hasCode('conflict:carbomer-electrolyte') ||
    ev.issues.some((i) => i.severity === 'error' && ['ph:carbomer', 'ph:ultrez-21', 'ph:aristoflex-avc', 'ph:simulgel-eg'].includes(i.code))
  const ionicConflict = hasCode('conflict:anionic-cationic') || hasCode('conflict:carbomer-cationic')
  const unmeltedWax = hasCode('melt:phase-b')
  const hasMinerals = pctOf('zinc-oxide') + pctOf('titanium-dioxide') >= 2
  const hasSuspender = has('veegum') || has('xanthan-gum') || has('sclerotium-gum') || has('sepimax-zen') || has('carbomer')

  // 1. Центрифуга 3000 об/мин, 20 мин
  let centVerdict: StabilityVerdict = 'pass'
  let centVisual: TubeVisual = 'uniform'
  let centHead = 'Без признаков расслоения и осадка'
  let centMech = 'Дисперсная фаза удерживается межфазным слоем и пределом текучести матрицы.'
  let centAdv = 'Базовый экспресс-тест пройден; подтвердите стабильность в термостате.'

  if (phaseSplit || ionicConflict) {
    centVerdict = 'fail'
    centVisual = 'split'
    centHead = 'Мгновенное расслоение / осадок на дне'
    centMech = ionicConflict
      ? 'Несовместимые ионы образовали нерастворимый комплекс, быстро осевший под действием центробежного ускорения.'
      : 'Межфазная плёнка не сформирована (нет эмульгатора или критический промах по ГЛБ): капли сливаются по закону Стокса.'
    centAdv = ionicConflict
      ? 'Разведите анионные и катионные компоненты по разным продуктам или замените ПАВ на неионогенные.'
      : 'Подберите пару эмульгаторов так, чтобы |ΔГЛБ| ≤ 1,0, и добавьте 2–3 % структурообразователя.'
  } else if (gelCollapse) {
    centVerdict = 'fail'
    centVisual = 'syneresis'
    centHead = 'Потеря вязкости и выделение сыворотки'
    centMech = 'Сетка полиакрилата сжалась из-за электролитов или низкого pH — предел текучести упал почти до нуля.'
    centAdv = 'Замените карбомер на Sepimax Zen, ксантан или склероций камедь, либо скорректируйте pH ≥ 5,5.'
  } else if (hlbDrift || (hasOil && !hasThickenerA && !hasWaxStruct) || (hasMinerals && !hasSuspender)) {
    centVerdict = 'warn'
    centVisual = 'creaming'
    centHead = hasMinerals && !hasSuspender ? 'Седиментация минеральных частиц на дне' : 'Начальные сливки в верхней зоне пробирки'
    centMech = hasMinerals && !hasSuspender
      ? 'Высокая плотность ZnO/TiO₂ (> 4 г/см³) вызывает оседание без тиксотропного загустителя.'
      : 'Небольшой дрейф ГЛБ или низкий предел текучести внешней фазы ускоряют всплывание крупных капель.'
    centAdv = hasMinerals && !hasSuspender
      ? 'Добавьте 0,5–1 % Veegum или 0,3 % ксантановой камеди для удержания суспензии.'
      : 'Уточните баланс ГЛБ до |Δ| ≤ 0,8 и добавьте 0,2–0,4 % полимера в водную фазу.'
  }

  // 2. Термоциклирование (3 цикла −18 °C / +25 °C)
  let ftVerdict: StabilityVerdict = 'pass'
  let ftVisual: TubeVisual = 'uniform'
  let ftHead = 'Текстура восстановилась после 3 циклов'
  let ftMech = 'Кристаллы льда не разрушили межфазную оболочку; перекристаллизации активов не отмечено.'
  let ftAdv = 'Устойчивость к зимней логистике подтверждена.'

  const crystalRisk = pctOf('allantoin') > 0.5 || pctOf('caffeine') > 2.0 || (pctOf('salicylic-acid') > 0.5 && pctOf('propanediol') + pctOf('pentylene-glycol') < 3)
  if (phaseSplit || ionicConflict || gelCollapse) {
    ftVerdict = 'fail'
    ftVisual = 'split'
    ftHead = 'Необратимое разрушение эмульсии при оттаивании'
    ftMech = 'Вымораживание воды концентрирует капли масла и соли, окончательно ломая нестабильную систему.'
    ftAdv = 'Сначала устраните базовые ошибки эмульгирования и несовместимости.'
  } else if (crystalRisk || unmeltedWax) {
    ftVerdict = 'fail'
    ftVisual = 'crystals'
    ftHead = 'Выпадение игольчатых кристаллов / крупинок'
    ftMech = unmeltedWax
      ? 'Воски не были полностью расплавлены при варке — при охлаждении сформировались твёрдые зёрна.'
      : 'При −18 °C концентрация малорастворимого актива (аллантоин/кофеин/салициловая к-та) превысила предел растворимости.'
    ftAdv = unmeltedWax
      ? 'Поднимите температуру фазы B выше точки плавления восков (≥ 72–75 °C).'
      : 'Снизьте ввод актива до безопасного порога (аллантоин ≤ 0,5 %, кофеин ≤ 2 %) или добавьте сорастворитель (пропандиол/пентиленгликоль).'
  } else if (hlbDrift || (hasOil && pctOf('glycerin') + pctOf('propanediol') + pctOf('pentylene-glycol') < 2)) {
    ftVerdict = 'warn'
    ftVisual = 'syneresis'
    ftHead = 'Лёгкий синерезис (отпотевание капель воды)'
    ftMech = 'Малая доля полиолов-криопротекторов повышает размер кристаллов льда при заморозке.'
    ftAdv = 'Добавьте 3–5 % глицерина или пропандиола в фазу A для защиты от криодестабилизации.'
  }

  // 3. Термостат +45 °C, 30 суток (ускоренное старение ≈ 6–12 мес.)
  let ovenVerdict: StabilityVerdict = 'pass'
  let ovenVisual: TubeVisual = 'uniform'
  let ovenHead = 'Стабильна 30 сут. при +45 °C (ΔpH ≤ 0,2)'
  let ovenMech = 'Вязкость, цвет, запах и микробиологическая устойчивость в норме.'
  let ovenAdv = 'Рецептура готова к постановке на реальное хранение и Challenge Test (ISO 11930).'

  const oxidationRisk =
    (has('ascorbic-acid') && (input.targetPh > 3.5 || !hasAntioxidant)) ||
    (has('retinol') && (!hasAntioxidant || input.targetPh < 5.0)) ||
    (has('kojic-acid') && (!hasChelator || !hasAntioxidant)) ||
    ((has('rosehip-oil') || has('almond-oil') || has('sunflower-oil')) && !hasAntioxidant)
  const needsPreservative = pctOf('aqua') >= 5 && !hasPreservative
  const presFail = needsPreservative || hasCode('ph:sodium-benzoate') || hasCode('ph:potassium-sorbate') || hasCode('ph:dehydroacetic-acid')
  const ureaDrift = has('urea') && (input.targetPh > 6.2 || input.phaseTempC.C > 45)
  const niacinHydrolysis = has('niacinamide') && input.targetPh < 4.5

  if (phaseSplit || gelCollapse || needsPreservative) {
    ovenVerdict = 'fail'
    ovenVisual = needsPreservative ? 'darkened' : 'split'
    ovenHead = needsPreservative ? 'Микробиологическая порча и газообразование' : 'Расслоение и резкое падение вязкости при +45 °C'
    ovenMech = needsPreservative
      ? 'Водная система без консервантов при тёплом хранении становится питательной средой для бактерий и плесени.'
      : 'При +45 °C вязкость внешней фазы падает в 2–3 раза, ускоряя коалесценцию нестабильной эмульсии.'
    ovenAdv = needsPreservative
      ? 'Введите консервирующую систему (например, Phenoxyethanol 0,8 % + Ethylhexylglycerin 0,1 % + хелатор).'
      : 'Стабилизируйте эмульгатор (|ΔГЛБ| ≤ 1,0) и добавьте термостойкий структурообразователь.'
  } else if (oxidationRisk || presFail || ureaDrift || niacinHydrolysis) {
    ovenVerdict = 'warn'
    ovenVisual = oxidationRisk ? 'darkened' : 'creaming'
    ovenHead = oxidationRisk
      ? 'Пожелтение / окисление при +45 °C'
      : presFail
        ? 'Риск провала консерванта на 28-й день'
        : ureaDrift
          ? 'Дрейф pH вверх (гидролиз мочевины)'
          : 'Гидролиз ниацинамида в кислой среде'
    ovenMech = oxidationRisk
      ? 'Чувствительные активы или ненасыщенные масла окисляются ускоренно при повышенной температуре без защиты антиоксидантом/хелатором.'
      : presFail
        ? 'Кислотный консервант при текущем pH перешёл в неактивную солевую форму.'
        : ureaDrift
          ? 'Мочевина распадается с образованием аммиака и CO₂, поднимая pH продукта.'
          : 'При pH < 4,5 и +45 °C ниацинамид частично переходит в никотиновую кислоту (вызывает покраснение кожи).'
    ovenAdv = oxidationRisk
      ? 'Добавьте 0,2–0,5 % Tocopherol и 0,1 % Disodium EDTA/Sodium Phytate; скорректируйте рабочее окно pH.'
      : presFail
        ? 'Снизьте pH в рабочее окно кислоты (≤ 5,2) или замените консервант на Phenoxyethanol / Chlorphenesin.'
        : ureaDrift
          ? 'Забуферьте систему лактатным буфером (pH 5,0–5,8) и вводите мочевину при ≤ 40 °C.'
          : 'Поднимите pH до 5,0–6,5 либо разведите ниацинамид и сильные кислоты по разным продуктам.'
  }

  // 4. Фотостабильность (дневной свет / УФ, 14 сут.)
  let photoVerdict: StabilityVerdict = 'pass'
  let photoVisual: TubeVisual = 'uniform'
  let photoHead = 'Цвет и активность стабильны на свету'
  let photoMech = 'В составе нет незащищённых фотолабильных пар.'
  let photoAdv = 'Допустима стандартная непрозрачная или УФ-защищённая туба.'

  const avoUnstable =
    ev.issues.some((i) => i.code === 'conflict:avobenzone-octinoxate' && i.severity === 'warn') ||
    (has('avobenzone') && pctOf('octocrylene') < 2 && pctOf('tinosorb-s') < 1.5)
  const photoActives = has('retinol') || has('ascorbic-acid') || has('kojic-acid')

  if (avoUnstable) {
    photoVerdict = 'fail'
    photoVisual = 'darkened'
    photoHead = 'Фотодеградация UVA-фильтра (> 40 % потерь)'
    photoMech = 'Авобензон без фотостабилизатора (особенно в паре с октиноксатом) быстро разрушается под УФ-излучением.'
    photoAdv = 'Уберите октиноксат из пары с авобензоном и добавьте Tinosorb S (≥ 2 %) или октокрилен (≥ 3 %), либо замените на Uvinul A Plus.'
  } else if (photoActives) {
    photoVerdict = 'warn'
    photoVisual = 'darkened'
    photoHead = 'Потемнение и потеря актива в прозрачной таре'
    photoMech = 'Ретинол, L-аскорбиновая и койевая кислоты чувствительны к свету и кислороду воздуха.'
    photoAdv = 'Обязательна светонепроницаемая безвоздушная упаковка (airless-флакон) + антиоксидант и хелатор.'
  }

  return [
    {
      id: 'centrifuge',
      title: 'Центрифуга',
      condition: '3000 об/мин · 20 мин',
      verdict: centVerdict,
      tubeVisual: centVisual,
      headline: centHead,
      mechanism: centMech,
      advice: centAdv,
    },
    {
      id: 'freeze-thaw',
      title: 'Заморозка / оттаивание',
      condition: '3 цикла · −18 °C / +25 °C',
      verdict: ftVerdict,
      tubeVisual: ftVisual,
      headline: ftHead,
      mechanism: ftMech,
      advice: ftAdv,
    },
    {
      id: 'oven45',
      title: 'Термостат +45 °C',
      condition: '30 суток (ускоренное старение)',
      verdict: ovenVerdict,
      tubeVisual: ovenVisual,
      headline: ovenHead,
      mechanism: ovenMech,
      advice: ovenAdv,
    },
    {
      id: 'photostability',
      title: 'Фотостабильность',
      condition: 'Свет / УФ · 14 суток',
      verdict: photoVerdict,
      tubeVisual: photoVisual,
      headline: photoHead,
      mechanism: photoMech,
      advice: photoAdv,
    },
  ]
}

/**
 * Детерминированный расчёт сенсорного профиля продукта по 6 осям («Сенсорная паутинка»).
 */
export function computeSensoryProfile(ev: FormulaEvaluation, input: FormulaInput): SensoryProfile {
  const pctMap = new Map<string, number>()
  for (const r of ev.rows) pctMap.set(r.ingredient.id, (pctMap.get(r.ingredient.id) ?? 0) + r.pct)
  const pct = (id: string) => pctMap.get(id) ?? 0

  const lightEmollients =
    pct('caprylic-triglyceride') + pct('coco-caprylate') + pct('isoamyl-laurate') +
    pct('dicaprylyl-carbonate') + pct('dicaprylyl-ether') + pct('isopropyl-myristate') +
    pct('c12-15-benzoate') + pct('squalane')
  const silicones = pct('dimethicone') + pct('cyclopentasiloxane') + pct('phenyl-trimethicone')
  const heavyOcclusives =
    pct('shea-butter') + pct('mineral-oil') + pct('petrolatum') + pct('beeswax') +
    pct('candelilla-wax') + pct('castor-oil')
  const fattyAlcohols = pct('cetearyl-alcohol') + pct('cetyl-alcohol') + pct('behenyl-alcohol')
  const stickyHumectants = pct('glycerin') + pct('panthenol') * 0.7 + pct('hyaluronic-acid') * 4 + pct('xanthan-gum') * 6
  const antiSticky = pct('propanediol') + pct('pentylene-glycol') + pct('betaine') + pct('silica-matting') * 2 + silicones * 1.5
  const soapingEmul = pct('montanov-68') + pct('olivem-1000') + pct('cetearyl-alcohol') * 0.6 + pct('glyceryl-stearate-se') * 0.7
  const antiSoaping = silicones * 3 + pct('coco-caprylate') * 0.6 + pct('dicaprylyl-carbonate') * 0.7 + pct('montanov-202') * 0.8

  const spreadability = clamp(52 + lightEmollients * 2.6 + silicones * 6 - heavyOcclusives * 3.5 - fattyAlcohols * 2.5, 15, 98)
  const lightness = clamp(90 - ev.oilPhasePct * 2.1 - heavyOcclusives * 3.2 - fattyAlcohols * 2.2 + pct('silica-matting') * 4 + silicones * 2, 12, 98)
  const nonSticky = clamp(86 - Math.max(0, stickyHumectants - 3.5) * 4.8 + antiSticky * 2.4, 15, 98)
  const noSoaping = clamp(
    ev.oilPhasePct < 1 ? 94 : 84 - Math.max(0, soapingEmul - 2) * 5.2 + antiSoaping * 4.5,
    18,
    98,
  )
  const velvet = clamp(
    45 + silicones * 8 + pct('silica-matting') * 7 + pct('squalane') * 3 + pct('dicaprylyl-carbonate') * 2.8 +
    pct('coco-caprylate') * 2.2 + pct('montanov-202') * 3 + pct('cetyl-alcohol') * 2 + pct('polyquaternium-7') * 4,
    20,
    98,
  )
  const absorption = clamp(
    84 - heavyOcclusives * 4.2 - fattyAlcohols * 2.6 - Math.max(0, ev.oilPhasePct - 10) * 1.6 +
    lightEmollients * 1.4 + pct('cyclopentasiloxane') * 4 + pct('silica-matting') * 3,
    15,
    98,
  )

  const axes: SensoryAxis[] = [
    {
      id: 'spreadability',
      label: 'Растекаемость',
      shortLabel: 'Растекаемость',
      score: spreadability,
      note: spreadability >= 70 ? 'Легко распределяется без усилия.' : 'Требует более долгого распределения из-за плотных липидов/восков.',
    },
    {
      id: 'lightness',
      label: 'Лёгкость (нежирность)',
      shortLabel: 'Лёгкость',
      score: lightness,
      note: lightness >= 70 ? 'Ощущается лёгкой, без тяжёлой масляной плёнки.' : 'Насыщенная питательная/окклюзивная текстура.',
    },
    {
      id: 'nonSticky',
      label: 'Чистый финиш (без липкости)',
      shortLabel: 'Без липкости',
      score: nonSticky,
      note: nonSticky >= 70 ? 'Минимальная липкость после высыхания.' : 'Возможна остаточная липкость от высоких доз глицерина/ксантана/гиалуроната.',
    },
    {
      id: 'noSoaping',
      label: 'Без эффекта мыльности',
      shortLabel: 'Без мыльности',
      score: noSoaping,
      note: noSoaping >= 70 ? 'Впитывается ровно без белых полос.' : 'Риск белых разводов (soaping): добавьте 0,5–1 % диметикона или 3 % лёгкого эфира.',
    },
    {
      id: 'velvet',
      label: 'Бархатистость и скольжение',
      shortLabel: 'Бархатистость',
      score: velvet,
      note: velvet >= 70 ? 'Шелковистое тактильное скольжение.' : 'Базовый нейтральный финиш — можно усилить скваланом, силикой или дикаприлилкарбонатом.',
    },
    {
      id: 'absorption',
      label: 'Скорость впитывания',
      shortLabel: 'Впитывание',
      score: absorption,
      note: absorption >= 70 ? 'Впитывается быстро (сухой/полуматовый финиш).' : 'Долгое впитывание — подходит для ночных кремов и защитных бальзамов.',
    },
  ]

  const hasSurfactants = ev.rows.some((r) => r.pct > 0 && r.ingredient.role === 'surfactant')
  let archetype = 'Сбалансированный повседневный крем'
  if (input.productType === 'rinse-off' && hasSurfactants) {
    archetype = 'Смываемая очищающая / кондиционирующая система'
  } else if (ev.oilPhasePct < 1) {
    archetype = nonSticky >= 70 ? 'Свежий водный гель / сыворотка' : 'Интенсивно увлажняющая сыворотка (возможна липкость)'
  } else if (lightness >= 72 && absorption >= 70) {
    archetype = 'Лёгкий быстро впитывающийся флюид / крем-гель'
  } else if (lightness < 50 || heavyOcclusives >= 6) {
    archetype = 'Плотный питательный / барьерный крем-бальзам'
  } else if (velvet >= 72) {
    archetype = 'Шелковистая ламеллярная эмульсия с бархатным финишем'
  }

  const weakest = [...axes].sort((a, b) => a.score - b.score)[0]
  const summary = language === 'en'
    ? `Profile is closest to "${tr(archetype)}". Weakest sensory axis: ${tr(weakest.label).toLowerCase()} (${weakest.score}/100) — ${tr(weakest.note)}`
    : `Профиль ближе всего к категории «${archetype}». Слабая точка сенсорики: ${weakest.label.toLowerCase()} (${weakest.score}/100) — ${weakest.note}`

  return { axes, archetype, summary }
}

/**
 * Генерирует пошаговый производственный протокол варки (SOP) с критическими контрольными точками (CCP).
 */
export function generateBatchProtocol(ev: FormulaEvaluation, input: FormulaInput): ProtocolStep[] {
  const en = language === 'en'
  const fmtG = (g: number) => en ? `${g} g` : `${g} г`
  const byPhase = (ph: Phase) => ev.rows.filter((r) => r.phase === ph && r.pct > 0)
  const rowsA = byPhase('A')
  const rowsB = byPhase('B')
  const rowsC = byPhase('C')
  const hasOil = ev.oilPhasePct >= 1
  const hasCarbomer = rowsA.some((r) => r.ingredient.id === 'carbomer' || r.ingredient.id === 'ultrez-21')
  const hasGums = rowsA.some((r) => ['xanthan-gum', 'sclerotium-gum', 'hec', 'guar-hptc'].includes(r.ingredient.id))
  const hasWaxes = rowsB.some((r) => ['beeswax', 'candelilla-wax', 'cetearyl-alcohol', 'behenyl-alcohol', 'ceramide-np'].includes(r.ingredient.id))

  const steps: ProtocolStep[] = []
  let no = 1

  // Шаг 1: Подготовка фазы A
  const actionsA: string[] = [
    en
      ? `Weigh purified water and liquid Phase A components into the main vessel (total ${fmtG(ev.phaseTotals.A.grams)}).`
      : `Отвесить в основной реактор очищенную воду и жидкие компоненты фазы A (всего ${fmtG(ev.phaseTotals.A.grams)}).`,
  ]
  if (hasGums) {
    actionsA.push('Загустители (камеди/ГЭЦ/гуар) предварительно диспергировать в глицерине/пропандиоле и ввести в воронку при перемешивании без комков.')
  }
  if (hasCarbomer) {
    actionsA.push('Карбомер равномерно рассыпать по поверхности воды и выдержать до полного смачивания (15–20 мин) ДО ввода электролитов и нейтрализации.')
  }
  actionsA.push(
    en
      ? `Phase A composition: ${rowsA.map((r) => `${r.ingredient.name} — ${fmtG(r.grams)}`).join('; ') || 'no components'}.`
      : `Состав фазы A: ${rowsA.map((r) => `${r.ingredient.name} — ${fmtG(r.grams)}`).join('; ') || 'нет компонентов'}.`,
  )
  steps.push({
    stepNo: no++,
    phase: 'A',
    title: 'Подготовка и нагрев водной фазы A',
    tempTarget: `${input.phaseTempC.A} °C`,
    mixing: hasCarbomer || hasGums ? 'Якорь 40–60 об/мин + короткий сдвиг до однородности' : 'Якорная мешалка 30–50 об/мин',
    actions: actionsA,
    ccp: hasCarbomer ? 'CCP-1: Проверить отсутствие негидратированных «рыбьих глазков» полимера до эмульгирования.' : undefined,
  })

  // Шаг 2: Подготовка фазы B (если есть)
  if (rowsB.length > 0) {
    const hasCeramide = rowsB.some((r) => r.ingredient.id === 'ceramide-np')
    const minMelt = hasCeramide ? 82 : hasWaxes ? 75 : 70
    steps.push({
      stepNo: no++,
      phase: 'B',
      title: 'Плавка и выравнивание масляной фазы B',
      tempTarget: `${input.phaseTempC.B} °C`,
      mixing: 'Перемешивание до полной прозрачности расплава',
      actions: [
        en
          ? `Charge Phase B components into the premix melter (total ${fmtG(ev.phaseTotals.B.grams)}): ${rowsB.map((r) => `${r.ingredient.name} — ${fmtG(r.grams)}`).join('; ')}.`
          : `Загрузить в плавильник компоненты фазы B (всего ${fmtG(ev.phaseTotals.B.grams)}): ${rowsB.map((r) => `${r.ingredient.name} — ${fmtG(r.grams)}`).join('; ')}.`,
        'Нагреть до полного расплавления всех твёрдых эмульгаторов, жирных спиртов и восков.',
      ],
      ccp: hasWaxes
        ? (en
            ? `CCP-2: Hold melt temperature ≥ ${minMelt} °C and confirm no solid wax/ceramide grains remain.`
            : `CCP-2: Выдержать температуру расплава ≥ ${minMelt} °C и убедиться в отсутствии твёрдых крупинок воска/церамидов.`)
        : 'CCP-2: Разница температур между фазами A и B перед слиянием не должна превышать ±3 °C.',
    })
  }

  // Шаг 3: Эмульгирование / смешивание
  if (hasOil && rowsB.length > 0) {
    steps.push({
      stepNo: no++,
      phase: 'EMUL',
      title: 'Эмульгирование и гомогенизация',
      tempTarget: `${Math.round((input.phaseTempC.A + input.phaseTempC.B) / 2)} °C → 45 °C`,
      mixing: 'Ротор-статор 3000–4500 об/мин (3–5 мин под умеренным вакуумом −0,40…−0,45 бар без вскипания воды), затем якорь 30–40 об/мин при охлаждении (вакуум до −0,65 бар при T < 60 °C)',
      actions: [
        'Ввести масляную фазу B в водную фазу A тонкой струёй при работающем гомогенизаторе под умеренным вакуумом.',
        'После образования первичной эмульсии перевести реактор в режим плавного охлаждения (1–2 °C/мин) при скребковом перемешивании.',
        ...(hasCarbomer ? ['При температуре 55–60 °C провести нейтрализацию карбомера до начала структурирования сетки.'] : []),
      ],
      ccp: 'CCP-3: При 70–75 °C держать вакуум −0,40…−0,45 бар (выше давления пара воды ~38 кПа), а глубокую деаэрацию (−0,65 бар) включать при охлаждении < 60 °C.',
    })
  }

  // Шаг 4: Фаза C (активы и консерванты)
  if (rowsC.length > 0) {
    steps.push({
      stepNo: no++,
      phase: 'C',
      title: 'Ввод термолабильных активов, консервантов и отдушки (Фаза C)',
      tempTarget: `≤ ${input.phaseTempC.C} °C`,
      mixing: 'Якорная мешалка 25–35 об/мин, без повторной высокосдвиговой гомогенизации',
      actions: [
        en
          ? `Cool batch to ${input.phaseTempC.C} °C and add Phase C components sequentially (total ${fmtG(ev.phaseTotals.C.grams)}): ${rowsC.map((r) => `${r.ingredient.name} — ${fmtG(r.grams)}`).join('; ')}.`
          : `Охладить массу до ${input.phaseTempC.C} °C и последовательно ввести компоненты фазы C (всего ${fmtG(ev.phaseTotals.C.grams)}): ${rowsC.map((r) => `${r.ingredient.name} — ${fmtG(r.grams)}`).join('; ')}.`,
        'Каждый компонент вводить после полного распределения предыдущего (отдушку при отсутствии масла предварительно смешать с солюбилизатором 1:4).',
      ],
      ccp: en
        ? `CCP-4: Verify bulk temperature before adding Phase C (≤ ${Math.min(40, input.phaseTempC.C)} °C for heat-sensitive actives).`
        : `CCP-4: Контроль температуры массы перед вводом фазы C (не выше ${Math.min(40, input.phaseTempC.C)} °C для термолабильных активов).`,
    })
  }

  // Шаг 5: Финальная доводка pH и выгрузка (QC)
  steps.push({
    stepNo: no++,
    phase: 'QC',
    title: 'Контроль pH, вязкости и разрешение на фасовку (ОКК)',
    tempTarget: '20–25 °C',
    mixing: 'Деаэрация под вакуумом 5 мин перед выгрузкой',
    actions: [
      en
        ? `Measure pH at 20–25 °C (target window: ${input.targetPh} ± 0.2) and adjust with 10% acid/base solution if needed.`
        : `Проверить pH при 20–25 °C (целевое окно: ${input.targetPh} ± 0,2) и при необходимости скорректировать 10 % раствором кислоты/щёлочи.`,
      en
        ? `Record finished batch mass (${fmtG(input.batchGrams)}), density, appearance, and Brookfield viscosity after 24 h maturation.`
        : `Зафиксировать массу готовой партии (${fmtG(input.batchGrams)}), плотность, органолептику и вязкость по Брукфильду через 24 ч созревания.`,
      'Отобрать арбитражную пробу (минимум 2×100 г) и передать образец в микробиологическую лабораторию.',
    ],
    ccp: en
      ? `CCP-5: Release for filling only after verifying pH (${input.targetPh} ± 0.2), zero centrifuge separation, and microbiological purity.`
      : `CCP-5: Выпуск на фасовку разрешён только при соответствии pH (${input.targetPh} ± 0,2), отсутствии расслоения на центрифуге и чистоте микробиологии.`,
  })

  return steps
}

/**
 * Подбирает до 3 ближайших функциональных аналогов для заданного ингредиента из каталога.
 */
export function findIngredientSubstitutes(
  ingredientId: string,
  catalog: Ingredient[],
): SubstituteSuggestion[] {
  const src = catalog.find((i) => i.id === ingredientId)
  if (!src) return []

  const candidates = catalog
    .filter((c) => c.id !== src.id && c.role === src.role)
    .map((c) => {
      let score = 0
      if (c.recommendedPhase === src.recommendedPhase) score += 30
      if (c.ionic === src.ionic) score += 20
      if (src.hlb !== undefined && c.hlb !== undefined) {
        score += Math.max(0, 30 - Math.abs(src.hlb - c.hlb) * 4)
      }
      if (src.reqHlb !== undefined && c.reqHlb !== undefined) {
        score += Math.max(0, 25 - Math.abs(src.reqHlb - c.reqHlb) * 3)
      }
      if (src.electrolyteSensitive && !c.electrolyteSensitive) score += 15
      if (c.costPerKg <= src.costPerKg) score += 5
      return { c, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  return candidates.map(({ c }) => {
    const en = language === 'en'
    const deltas: string[] = []
    if (src.hlb !== undefined && c.hlb !== undefined) {
      deltas.push(`${en ? 'HLB' : 'ГЛБ'} ${src.hlb} → ${c.hlb}`)
    } else if (src.reqHlb !== undefined && c.reqHlb !== undefined) {
      deltas.push(`reqHLB ${src.reqHlb} → ${c.reqHlb}`)
    }
    if (src.electrolyteSensitive && !c.electrolyteSensitive) {
      deltas.push(en ? 'electrolyte-tolerant' : 'устойчив к электролитам')
    }
    if (c.ionic !== src.ionic) {
      deltas.push(`${en ? 'charge' : 'заряд'}: ${c.ionic}`)
    }
    const priceDiff = c.costPerKg - src.costPerKg
    const unit = en ? 'RUB/kg' : '₽/кг'
    deltas.push(priceDiff === 0 ? (en ? 'same cost' : 'та же цена') : priceDiff > 0 ? `+${priceDiff} ${unit}` : `${priceDiff} ${unit}`)

    return {
      ingredient: c,
      reason: c.note,
      deltaNote: deltas.join(' · '),
    }
  })
}
