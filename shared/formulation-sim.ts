// Детерминированное прогнозирование внешнего вида на 5 стадиях варки,
// сравнение рецептур «До/После», галерея антипаттернов и математика калькулятора технолога.

import {
  evaluateFormula,
  type FormulaEvaluation,
  type FormulaInput,
  type Ingredient,
} from './formulation'

export type StageId = 'phaseA' | 'phaseB' | 'emulsify' | 'coolingC' | 'final24h'
export type VisualOpacity = 'clear' | 'opalescent' | 'milky' | 'opaque'
export type VisualDefect =
  | 'phase-split'
  | 'flocculation'
  | 'gel-collapse'
  | 'unmelted-wax'
  | 'haze'
  | 'yellowing'
  | 'crystals'
  | 'bubbles'
  | 'soaping'

export type MicroscopeType =
  | 'solution'
  | 'fine-emulsion'
  | 'coarse-emulsion'
  | 'flocculated'
  | 'crystals'
  | 'micelles'

export interface ProcessStageVisual {
  id: StageId
  stepNo: number
  title: string
  tempC: number
  colorHex: string
  topLayerHex?: string
  opacity: VisualOpacity
  textureLabel: string
  viscosityBand: string
  summary: string
  defects: VisualDefect[]
  microscopeType: MicroscopeType
  microscopeCaption: string
}

export interface ProcessAppearanceForecast {
  systemKind: 'emulsion' | 'surfactant' | 'gel' | 'solution'
  stages: ProcessStageVisual[]
}

const r2 = (n: number) => Number(n.toFixed(2))

/** Прогнозирует внешний вид полупродукта на 5 узловых стадиях и готового продукта через 24 ч. */
export function predictProcessAppearance(ev: FormulaEvaluation, input: FormulaInput): ProcessAppearanceForecast {
  const pctMap = new Map<string, number>()
  for (const r of ev.rows) pctMap.set(r.ingredient.id, (pctMap.get(r.ingredient.id) ?? 0) + r.pct)
  const pctOf = (id: string) => pctMap.get(id) ?? 0
  const has = (id: string) => pctOf(id) > 0
  const hasCode = (prefix: string) => ev.issues.some((i) => i.code === prefix || i.code.startsWith(prefix))

  const hasSurfactants = ev.rows.some((r) => r.pct > 0 && r.ingredient.role === 'surfactant')
  const hasOil = ev.oilPhasePct >= 1
  const hasThickenersA = ev.rows.some((r) => r.pct > 0 && r.phase === 'A' && r.ingredient.role === 'thickener')
  const hasThickWaxes = (pctOf('cetearyl-alcohol') + pctOf('beeswax') + pctOf('shea-butter')) >= 4
  const systemKind: ProcessAppearanceForecast['systemKind'] = hasOil
    ? 'emulsion'
    : hasSurfactants
      ? 'surfactant'
      : hasThickenersA
        ? 'gel'
        : 'solution'

  const ionicConflict = hasCode('conflict:anionic-cationic') || hasCode('conflict:carbomer-cationic')
  const carbomerCollapse =
    hasCode('conflict:carbomer-electrolyte') ||
    ev.issues.some((i) => i.severity === 'error' && ['ph:carbomer', 'ph:ultrez-21', 'ph:aristoflex-avc', 'ph:simulgel-eg'].includes(i.code))
  const phaseSplit = hasCode('hlb:no-emulsifier') || hasCode('hlb:mismatch')
  const hlbDrift = hasCode('hlb:drift')
  const unmeltedWax = hasCode('melt:phase-b')
  const hazeParfum = hasCode('haze:parfum')
  const crystals = hasCode('solubility:allantoin')
  const yellowing =
    (has('ascorbic-acid') && (input.targetPh > 3.5 || input.phaseTempC.C > 35)) ||
    (has('retinol') && (input.phaseTempC.C > 35 || input.targetPh < 5.0)) ||
    ev.issues.some((i) => i.code === 'conflict:avobenzone-octinoxate' && i.severity === 'warn') ||
    hasCode('temp:')
  const soapingRisk =
    systemKind === 'emulsion' &&
    (has('montanov-68') || pctOf('cetearyl-alcohol') >= 4) &&
    !has('dimethicone') &&
    !has('coco-caprylate')

  // Стадия 1: Фаза A
  const phaseADefects: VisualDefect[] = []
  if (crystals) phaseADefects.push('crystals')
  const stageA: ProcessStageVisual = {
    id: 'phaseA',
    stepNo: 1,
    title: 'Подготовка водной фазы A',
    tempC: input.phaseTempC.A,
    colorHex: hasThickenersA ? '#E4F4F2' : '#DDF3FA',
    opacity: hasThickenersA ? 'opalescent' : 'clear',
    textureLabel: hasThickenersA ? 'Однородная полимерная дисперсия' : 'Прозрачный водный раствор',
    viscosityBand: hasThickenersA ? '0,5–3 Па·с' : '< 0,05 Па·с',
    summary: hasThickenersA
      ? 'Полимер диспергирован в водной фазе с увлажнителями; перед эмульгированием важно отсутствие комков («рыбьих глаз»).'
      : 'Прозрачная бесцветная водная фаза, нагретая до рабочей температуры.',
    defects: phaseADefects,
    microscopeType: crystals ? 'crystals' : 'solution',
    microscopeCaption: crystals ? 'Игольчатые кристаллы избыточного аллантоина' : 'Однородная водная среда без дисперсной фазы',
  }

  // Стадия 2: Фаза B
  const phaseBDefects: VisualDefect[] = []
  if (unmeltedWax) phaseBDefects.push('unmelted-wax')
  const stageB: ProcessStageVisual = {
    id: 'phaseB',
    stepNo: 2,
    title: 'Подготовка масляной фазы B',
    tempC: input.phaseTempC.B,
    colorHex: hasOil ? (has('zinc-oxide') || has('titanium-dioxide') ? '#F6F4EE' : '#F4D58D') : '#ECE9F2',
    opacity: !hasOil ? 'clear' : unmeltedWax ? 'milky' : has('zinc-oxide') ? 'opaque' : 'clear',
    textureLabel: !hasOil
      ? 'Масляная фаза отсутствует'
      : unmeltedWax
        ? 'Мутный неполный расплав с крупинками воска'
        : has('zinc-oxide')
          ? 'Белая масляная суспензия минерального фильтра'
          : 'Прозрачный янтарный масляный расплав',
    viscosityBand: !hasOil ? '—' : unmeltedWax ? 'неоднородная' : '0,05–0,3 Па·с',
    summary: !hasOil
      ? 'Рецептура не содержит масляной фазы — переход сразу к водно-ПАВ смешиванию.'
      : unmeltedWax
        ? 'Температура ниже 68 °C: твёрдые воски/жирные спирты не полностью расплавлены.'
        : 'Эмоленты, эмульгаторы и жирорастворимые фильтры полностью расплавлены в однородную фазу.',
    defects: phaseBDefects,
    microscopeType: unmeltedWax ? 'crystals' : 'solution',
    microscopeCaption: unmeltedWax ? 'Нерасплавленные частицы воска/жирных спиртов' : 'Однородный расплав липофильной фазы',
  }

  // Стадия 3: Эмульгирование / смешивание A + B
  const emulDefects: VisualDefect[] = []
  if (phaseSplit) emulDefects.push('phase-split')
  if (ionicConflict) emulDefects.push('flocculation')
  if (hasSurfactants) emulDefects.push('bubbles')
  const stageEmul: ProcessStageVisual = {
    id: 'emulsify',
    stepNo: 3,
    title: hasOil ? 'Эмульгирование и гомогенизация (A + B)' : 'Смешивание основной базы',
    tempC: Math.round((input.phaseTempC.A + input.phaseTempC.B) / 2),
    colorHex: ionicConflict
      ? '#E7E4DC'
      : hasOil
        ? '#FFFDF8'
        : hasSurfactants
          ? '#E6F5F3'
          : '#E4F4F2',
    topLayerHex: phaseSplit ? '#F2C14E' : undefined,
    opacity: hasOil ? 'opaque' : ionicConflict ? 'milky' : hasThickenersA ? 'opalescent' : 'clear',
    textureLabel: ionicConflict
      ? 'Мутная взвесь с хлопьями осадка'
      : phaseSplit
        ? 'Грубая нестабильная эмульсия с отслоением масла'
        : hasOil
          ? 'Горячая текучая первичная эмульсия (молочко)'
          : hasSurfactants
            ? 'Прозрачный раствор ПАВ с поверхностной пеной'
            : 'Однородная гелевая база',
    viscosityBand: phaseSplit ? 'нестабильная' : hasOil ? '0,8–3 Па·с (горячая)' : '0,5–4 Па·с',
    summary: ionicConflict
      ? 'Анионные и катионные компоненты образуют нерастворимый ионный комплекс прямо при смешивании.'
      : phaseSplit
        ? 'Без подходящего по ГЛБ эмульгатора капли масла быстро сливаются и всплывают наверх.'
        : hasOil
          ? 'Диспергирование фазы B в A при высоком сдвиге формирует первичные капли 2–5 мкм; основная вязкость наберётся при охлаждении.'
          : 'Мягкое перемешивание без захвата воздуха объединяет базу.',
    defects: emulDefects,
    microscopeType: ionicConflict
      ? 'flocculated'
      : phaseSplit || hlbDrift
        ? 'coarse-emulsion'
        : hasOil
          ? 'fine-emulsion'
          : hasSurfactants
            ? 'micelles'
            : 'solution',
    microscopeCaption: ionicConflict
      ? 'Агрегаты и хлопья ионного комплекса'
      : phaseSplit
        ? 'Крупные коалесцирующие капли > 25 мкм'
        : hasOil
          ? 'Первичные капли масла 2–5 мкм в водной фазе'
          : 'Мицеллярный / полимерный раствор',
  }

  // Стадия 4: Охлаждение и ввод фазы C
  const coolDefects: VisualDefect[] = []
  if (carbomerCollapse) coolDefects.push('gel-collapse')
  if (ionicConflict) coolDefects.push('flocculation')
  if (yellowing) coolDefects.push('yellowing')
  if (hazeParfum) coolDefects.push('haze')
  if (phaseSplit) coolDefects.push('phase-split')
  const stageCool: ProcessStageVisual = {
    id: 'coolingC',
    stepNo: 4,
    title: 'Охлаждение и ввод фазы C',
    tempC: input.phaseTempC.C,
    colorHex: yellowing ? '#F7E3B5' : hasOil ? '#FFFCF5' : hazeParfum ? '#EDEFF2' : '#E5F6F5',
    topLayerHex: phaseSplit ? '#F2C14E' : undefined,
    opacity: hasOil ? 'opaque' : ionicConflict || hazeParfum ? 'milky' : hasThickenersA ? 'opalescent' : 'clear',
    textureLabel: carbomerCollapse
      ? 'Резкое разжижение геля (коллапс карбомера)'
      : yellowing
        ? 'Пожелтение / риск деградации термолабильной фазы C'
        : hazeParfum
          ? 'Помутнение из-за несолюбилизированной отдушки'
          : hasOil
            ? 'Загустевающий крем при кристаллизации ламеллярной сетки'
            : 'Охлаждённый гель / раствор с введёнными активами',
    viscosityBand: carbomerCollapse ? '< 0,3 Па·с (обвал)' : hasOil ? (hasThickWaxes ? '10–22 Па·с' : '4–12 Па·с') : '1–6 Па·с',
    summary: carbomerCollapse
      ? 'При вводе электролитов или pH < 5,5 полимерная сетка карбомера схлопывается, продукт становится водянистым.'
      : yellowing
        ? 'Температура или pH выходят за окно стабильности активов — ускоряется окисление и изменение цвета.'
        : 'Медленное охлаждение ниже 40 °C сохраняет активность фазы C и позволяет структуре набрать вязкость.',
    defects: coolDefects,
    microscopeType: ionicConflict
      ? 'flocculated'
      : phaseSplit || hlbDrift
        ? 'coarse-emulsion'
        : hazeParfum
          ? 'coarse-emulsion'
          : hasOil
            ? 'fine-emulsion'
            : 'micelles',
    microscopeCaption: hazeParfum
      ? 'Несолюбилизированные капли отдушки 2–5 мкм'
      : hasOil
        ? 'Стабилизированные капли эмульсии на стадии охлаждения'
        : 'Структура базы после ввода фазы C',
  }

  // Стадия 5: Готовый продукт через 24 ч
  const finalDefects: VisualDefect[] = []
  if (phaseSplit) finalDefects.push('phase-split')
  if (ionicConflict) finalDefects.push('flocculation')
  if (carbomerCollapse) finalDefects.push('gel-collapse')
  if (yellowing) finalDefects.push('yellowing')
  if (hazeParfum) finalDefects.push('haze')
  if (crystals) finalDefects.push('crystals')
  if (soapingRisk && !phaseSplit) finalDefects.push('soaping')

  const finalColor = yellowing
    ? '#F2D69B'
    : hasOil
      ? (has('shea-butter') || has('avobenzone') ? '#FCF6E6' : '#FFFFFF')
      : ionicConflict || hazeParfum
        ? '#E6EAEF'
        : '#E8F7F6'

  let finalTexture = 'Прозрачный косметический раствор'
  let finalVisc = '< 0,1 Па·с'
  if (phaseSplit) {
    finalTexture = 'Расслоившаяся эмульсия (масляный слой сверху)'
    finalVisc = 'неоднородная (брак)'
  } else if (ionicConflict) {
    finalTexture = 'Мутная система с белыми хлопьями на дне'
    finalVisc = 'нестабильная (брак)'
  } else if (carbomerCollapse) {
    finalTexture = 'Разжиженная сыворотка (коллапс геля)'
    finalVisc = '0,1–0,4 Па·с'
  } else if (systemKind === 'emulsion') {
    if (hasThickWaxes || ev.oilPhasePct >= 18) {
      finalTexture = soapingRisk ? 'Плотный белый крем (возможен мыльный след)' : 'Плотный глянцевый крем O/W'
      finalVisc = '18–35 Па·с'
    } else if (ev.oilPhasePct >= 8) {
      finalTexture = 'Лёгкий увлажняющий крем / лосьон O/W'
      finalVisc = '6–16 Па·с'
    } else {
      finalTexture = 'Лёгкий флюид / эмульсионная сыворотка'
      finalVisc = '1,5–5 Па·с'
    }
  } else if (systemKind === 'surfactant') {
    finalTexture = hazeParfum ? 'Мутный очищающий гель' : 'Прозрачный вязкий очищающий гель'
    finalVisc = has('sodium-chloride') ? '2,5–6 Па·с' : '0,5–2 Па·с'
  } else if (systemKind === 'gel') {
    finalTexture = has('sepimax-zen') || has('carbomer') ? 'Прозрачный / опалесцирующий гель' : 'Мягкий биополимерный гель'
    finalVisc = '3–12 Па·с'
  }

  const stageFinal: ProcessStageVisual = {
    id: 'final24h',
    stepNo: 5,
    title: 'Готовый продукт (через 24 ч)',
    tempC: 22,
    colorHex: finalColor,
    topLayerHex: phaseSplit ? '#E8B647' : undefined,
    opacity: hasOil ? 'opaque' : ionicConflict || hazeParfum ? 'milky' : hasThickenersA ? 'opalescent' : 'clear',
    textureLabel: finalTexture,
    viscosityBand: finalVisc,
    summary: finalDefects.length === 0
      ? 'После 24 часов созревания продукт однороден, стабилен по внешнему виду и готов к испытаниям стабильности (40 °C / циклы).'
      : `Обнаружены визуальные риски (${finalDefects.length}): проверьте панель диагностики ниже и скорректируйте состав или режим.`,
    defects: finalDefects,
    microscopeType: ionicConflict
      ? 'flocculated'
      : crystals
        ? 'crystals'
        : phaseSplit || hlbDrift || hazeParfum
          ? 'coarse-emulsion'
          : hasOil
            ? 'fine-emulsion'
            : hasSurfactants
              ? 'micelles'
              : 'solution',
    microscopeCaption: phaseSplit
      ? 'Коалесценция: крупные капли масла > 30 мкм, разделение фаз'
      : ionicConflict
        ? 'Хлопья осадка несовместимых ионов'
        : crystals
          ? 'Кристаллы нерастворённого актива в матрице'
          : hlbDrift
            ? 'Полидисперсные капли 8–18 мкм (риск расслоения при 40 °C)'
            : hasOil
              ? 'Тонкая однородная эмульсия: капли 1–3 мкм'
              : 'Однородная изотропная среда без крупных включений',
  }

  return {
    systemKind,
    stages: [stageA, stageB, stageEmul, stageCool, stageFinal],
  }
}

export interface FormulaDiff {
  costDelta: number
  errorsDelta: number
  warningsDelta: number
  hlbDeltaChange: string
  added: string[]
  removed: string[]
  changed: { id: string; name: string; beforePct: number; afterPct: number; beforePhase: string; afterPhase: string }[]
}

/** Сравнение двух рецептур «До / После». */
export function diffFormulas(before: FormulaInput, after: FormulaInput, catalog: Ingredient[]): FormulaDiff {
  const evA = evaluateFormula(before, catalog)
  const evB = evaluateFormula(after, catalog)
  const byId = new Map(catalog.map((i) => [i.id, i]))

  const mapA = new Map<string, { pct: number; phase: string }>()
  for (const r of before.rows) mapA.set(r.ingredientId, { pct: r2((mapA.get(r.ingredientId)?.pct ?? 0) + r.pct), phase: r.phase })
  const mapB = new Map<string, { pct: number; phase: string }>()
  for (const r of after.rows) mapB.set(r.ingredientId, { pct: r2((mapB.get(r.ingredientId)?.pct ?? 0) + r.pct), phase: r.phase })

  const added: string[] = []
  const removed: string[] = []
  const changed: FormulaDiff['changed'] = []

  for (const id of new Set([...mapA.keys(), ...mapB.keys()])) {
    const a = mapA.get(id)
    const b = mapB.get(id)
    const name = byId.get(id)?.name ?? id
    if (!a && b) added.push(`${name} (${b.pct} %, фаза ${b.phase})`)
    else if (a && !b) removed.push(`${name} (${a.pct} %)`)
    else if (a && b && (Math.abs(a.pct - b.pct) > 0.001 || a.phase !== b.phase)) {
      changed.push({ id, name, beforePct: a.pct, afterPct: b.pct, beforePhase: a.phase, afterPhase: b.phase })
    }
  }

  const hlbBefore = evA.hlbDelta !== null ? `Δ=${evA.hlbDelta}` : '—'
  const hlbAfter = evB.hlbDelta !== null ? `Δ=${evB.hlbDelta}` : '—'

  return {
    costDelta: r2(evB.costPerKg - evA.costPerKg),
    errorsDelta: evB.errorsCount - evA.errorsCount,
    warningsDelta: evB.warningsCount - evA.warningsCount,
    hlbDeltaChange: `${hlbBefore} → ${hlbAfter}`,
    added,
    removed,
    changed,
  }
}

export interface AntipatternCard {
  id: string
  title: string
  symptom: string
  mechanism: string
  fixHint: string
  formula: FormulaInput
}

/** Библиотека типичных «антипаттернов» рецептур с загрузкой в Песочницу в 1 клик. */
export const ANTIPATTERNS: AntipatternCard[] = [
  {
    id: 'anti-soaping',
    title: 'Мыльный след (Soaping) на коже',
    symptom: 'Крем долго растирается белыми полосами и плохо впитывается.',
    mechanism: 'Высокая доля глюкозидного эмульгатора / жирных спиртов при высоком поверхностном натяжении без силикона или лёгких эфиров.',
    fixHint: 'Добавьте 1–2 % Dimethicone или 3–4 % Coco-Caprylate/Caprate и сбалансируйте эмульгатор.',
    formula: {
      productType: 'leave-on',
      targetPh: 5.5,
      batchGrams: 500,
      phaseTempC: { A: 75, B: 75, C: 38 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 74.2 },
        { ingredientId: 'glycerin', phase: 'A', pct: 4.0 },
        { ingredientId: 'caprylic-triglyceride', phase: 'B', pct: 7.0 },
        { ingredientId: 'shea-butter', phase: 'B', pct: 5.0 },
        { ingredientId: 'cetearyl-alcohol', phase: 'B', pct: 4.5 },
        { ingredientId: 'montanov-68', phase: 'B', pct: 4.5 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
      ],
    },
  },
  {
    id: 'anti-carbomer-salt',
    title: 'Коллапс карбомера от электролитов',
    symptom: 'Плотный прозрачный гель мгновенно превращается в воду при вводе актива.',
    mechanism: 'Ионы электролита (соли витамина C, NaCl, бензоат) сжимают двойной электрический слой полиакрилата.',
    fixHint: 'Замените Carbomer на электролитоустойчивый Sepimax Zen (Polyacrylate Crosspolymer-6) или Xanthan Gum.',
    formula: {
      productType: 'leave-on',
      targetPh: 6.2,
      batchGrams: 500,
      phaseTempC: { A: 40, B: 40, C: 35 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 91.5 },
        { ingredientId: 'glycerin', phase: 'A', pct: 5.0 },
        { ingredientId: 'carbomer', phase: 'A', pct: 0.5 },
        { ingredientId: 'sap', phase: 'C', pct: 2.0 },
        { ingredientId: 'sodium-hydroxide', phase: 'C', pct: 0.2 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
      ],
    },
  },
  {
    id: 'anti-vitc-brown',
    title: 'Потемнение сыворотки с витамином C',
    symptom: 'Через 2 недели сыворотка с L-аскорбиновой кислотой желтеет и буреет.',
    mechanism: 'Высокий pH (> 3,5) и ввод при повышенной температуре ускоряют окисление L-AA до дегидроаскорбиновой кислоты.',
    fixHint: 'Снизьте pH до 3,2–3,4, охладите фазу C до ≤ 32 °C и добавьте хелатор (Disodium EDTA) + антиоксидант.',
    formula: {
      productType: 'leave-on',
      targetPh: 5.4,
      batchGrams: 300,
      phaseTempC: { A: 50, B: 50, C: 45 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 80.7 },
        { ingredientId: 'propanediol', phase: 'A', pct: 8.0 },
        { ingredientId: 'sepimax-zen', phase: 'A', pct: 0.5 },
        { ingredientId: 'ascorbic-acid', phase: 'C', pct: 10.0 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
      ],
    },
  },
  {
    id: 'anti-anion-cation',
    title: 'Хлопья осадка (анионный + катионный ПАВ)',
    symptom: 'При смешивании кондиционирующей добавки в шампунь выпадает белый творожистый осадок.',
    mechanism: 'Анионный SLES и катионный BTMS/цетримоний образуют нерастворимый электронейтральный комплекс.',
    fixHint: 'Уберите катионный ПАВ из анионной моющей системы либо переведите базу на неионогенные глюкозиды + HEC.',
    formula: {
      productType: 'rinse-off',
      targetPh: 5.0,
      batchGrams: 1000,
      phaseTempC: { A: 40, B: 40, C: 35 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 82.7 },
        { ingredientId: 'sles', phase: 'A', pct: 10.0 },
        { ingredientId: 'capb', phase: 'A', pct: 4.0 },
        { ingredientId: 'btms', phase: 'B', pct: 1.5 },
        { ingredientId: 'sodium-chloride', phase: 'C', pct: 1.0 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
      ],
    },
  },
  {
    id: 'anti-allantoin-crystals',
    title: 'Игольчатые кристаллы аллантоина',
    symptom: 'Через сутки в креме появляются колючие микрокристаллы на коже.',
    mechanism: 'Концентрация аллантоина превысила предел растворимости в воде при комнатной температуре (~0,5 %).',
    fixHint: 'Снизьте ввод Allantoin до ≤ 0,5 % и доведите воду до 100 %.',
    formula: {
      productType: 'leave-on',
      targetPh: 5.5,
      batchGrams: 500,
      phaseTempC: { A: 75, B: 75, C: 38 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 92.2 },
        { ingredientId: 'glycerin', phase: 'A', pct: 5.0 },
        { ingredientId: 'allantoin', phase: 'A', pct: 1.5 },
        { ingredientId: 'xanthan-gum', phase: 'A', pct: 0.5 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
      ],
    },
  },
  {
    id: 'anti-uv-photodeg',
    title: 'Фотодеградация SPF-крема (Авобензон + Октиноксат)',
    symptom: 'Реальная защита UVA быстро падает на солнце, а лимит авобензона превышен.',
    mechanism: 'Октиноксат дестабилизирует авобензон под УФ; кроме того, ввод > 5 % нарушает EU Annex VI / ТР ТС Прил. 5.',
    fixHint: 'Снизьте авобензон до ≤ 3–4 % и добавьте фотостабилизатор (Octocrylene ≥ 3 % или Tinosorb S ≥ 2 %).',
    formula: {
      productType: 'leave-on',
      targetPh: 6.0,
      batchGrams: 500,
      phaseTempC: { A: 75, B: 75, C: 38 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 66.2 },
        { ingredientId: 'glycerin', phase: 'A', pct: 3.0 },
        { ingredientId: 'c12-15-benzoate', phase: 'B', pct: 10.0 },
        { ingredientId: 'avobenzone', phase: 'B', pct: 5.5 },
        { ingredientId: 'octinoxate', phase: 'B', pct: 7.5 },
        { ingredientId: 'cetearyl-alcohol', phase: 'B', pct: 2.0 },
        { ingredientId: 'steareth-2', phase: 'B', pct: 2.0 },
        { ingredientId: 'steareth-21', phase: 'B', pct: 3.0 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
      ],
    },
  },
]

// ===== Математика для выдвижного «Калькулятора технолога» =====

/** Правило креста: расчёт долей двух эмульгаторов для достижения целевого ГЛБ. */
export function solveHlbMix(hlb1: number, hlb2: number, targetHlb: number, totalPct: number) {
  if (!Number.isFinite(hlb1) || !Number.isFinite(hlb2) || !Number.isFinite(targetHlb) || !Number.isFinite(totalPct) || totalPct <= 0) {
    return null
  }
  const low = Math.min(hlb1, hlb2), high = Math.max(hlb1, hlb2)
  if (high === low || targetHlb < low || targetHlb > high) return null
  const share1 = (targetHlb - hlb2) / (hlb1 - hlb2)
  const share2 = 1 - share1
  return {
    share1Pct: r2(share1 * 100),
    share2Pct: r2(share2 * 100),
    pct1: r2(totalPct * share1),
    pct2: r2(totalPct * share2),
  }
}

/** Пересчёт товарной формы сырья (например, 27 % SLES) на массу загрузки для нужного % активного вещества. */
export function convertCommercialRaw(targetActivePct: number, commercialAssayPct: number, batchGrams: number) {
  if (
    !Number.isFinite(targetActivePct) || targetActivePct < 0 ||
    !Number.isFinite(commercialAssayPct) || commercialAssayPct <= 0 || commercialAssayPct > 100 ||
    targetActivePct > commercialAssayPct ||
    !Number.isFinite(batchGrams) || batchGrams <= 0
  ) return null
  const commercialPct = (targetActivePct / commercialAssayPct) * 100
  const commercialGrams = (batchGrams * commercialPct) / 100
  const carriedWaterGrams = commercialGrams - (batchGrams * targetActivePct) / 100
  return {
    commercialPct: r2(commercialPct),
    commercialGrams: r2(commercialGrams),
    carriedWaterGrams: r2(carriedWaterGrams),
  }
}

/** Разведение концентрированного раствора (C1 -> C2, целевая масса M2). */
export function diluteSolution(c1Pct: number, c2Pct: number, targetGrams: number) {
  if (
    !Number.isFinite(c1Pct) || c1Pct <= 0 || c1Pct > 100 ||
    !Number.isFinite(c2Pct) || c2Pct <= 0 || c2Pct > c1Pct ||
    !Number.isFinite(targetGrams) || targetGrams <= 0
  ) return null
  const stockGrams = (targetGrams * c2Pct) / c1Pct
  const waterGrams = targetGrams - stockGrams
  return {
    stockGrams: r2(stockGrams),
    waterGrams: r2(waterGrams),
  }
}

/**
 * Расчёт окружной скорости мешалки/ротора v_tip = π · D · n / 60 (м/с)
 * и пересчёт оборотов на реактор с диаметром D2 по критерию постоянной v_tip.
 */
export function calcTipSpeedScale(d1Mm: number, rpm1: number, d2Mm: number) {
  if (
    !Number.isFinite(d1Mm) || d1Mm <= 0 ||
    !Number.isFinite(rpm1) || rpm1 <= 0 ||
    !Number.isFinite(d2Mm) || d2Mm <= 0
  ) return null
  const tipSpeedMs = (Math.PI * (d1Mm / 1000) * rpm1) / 60
  const targetRpm2 = (rpm1 * d1Mm) / d2Mm
  const regime = tipSpeedMs < 1.5
    ? 'мягкое перемешивание (якорь / рамная мешалка)'
    : tipSpeedMs < 6
      ? 'средний сдвиг (пропеллер / турбина)'
      : tipSpeedMs < 15
        ? 'диспергирование / предварительное эмульгирование'
        : 'высокий сдвиг (ротор-статор / гомогенизация)'
  return {
    tipSpeedMs: r2(tipSpeedMs),
    targetRpm2: Math.round(targetRpm2),
    regime,
  }
}
