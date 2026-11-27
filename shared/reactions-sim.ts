// Детерминированное численное ядро раздела «Реакции и механизмы» (Направление K):
// — Решатель систем ОДУ методом Рунге–Кутты 4-го порядка (RK4)
// — Уравнение Аррениуса, кислотно-основные/дебаевские равновесия и псевдофазный мицеллярный катализ
// — Готово к будущему подключению RDKit.js (WASM): каждая реакция хранит метаданные SMILES.

import { language } from './locale'

export type ReactionId =
  | 'saponification-stearate'
  | 'carbomer-neutralization'
  | 'lipid-peroxidation'
  | 'urea-niacinamide-hydrolysis'
  | 'ascorbic-retinol-degradation'
  | 'micellar-schiff-interfacial'

export interface ReactionParamSpec {
  id: string
  labelRu: string
  labelEn: string
  unitRu: string
  unitEn: string
  min: number
  max: number
  step: number
  defaultValue: number
}

export interface ReactionMolecule {
  nameRu: string
  nameEn: string
  formula: string
  smiles: string
  role: 'reactant' | 'catalyst' | 'product' | 'byproduct'
}

export interface ReactionDefinition {
  id: ReactionId
  categoryRu: string
  categoryEn: string
  titleRu: string
  titleEn: string
  subtitleRu: string
  subtitleEn: string
  equation: string
  mechanismSummaryRu: string
  mechanismSummaryEn: string
  timeUnitRu: string
  timeUnitEn: string
  relatedTopicIds: string[]
  molecules: ReactionMolecule[]
  params: ReactionParamSpec[]
}

export interface KineticSeries {
  id: string
  labelRu: string
  labelEn: string
  color: string
  values: number[]
}

export interface ReactionKpi {
  labelRu: string
  labelEn: string
  value: string
  tone?: 'ok' | 'warn' | 'bad' | 'neutral'
}

export interface ReactionSimulationResult {
  times: number[]
  tMax: number
  series: KineticSeries[]
  yMax: number
  yUnitRu: string
  yUnitEn: string
  kpis: ReactionKpi[]
  swatchHex?: string
  swatchLabelRu?: string
  swatchLabelEn?: string
  /** Интенсивность / стадия для живой SVG-анимации механизма (0..1). */
  progressRatio: number
  shieldingRatio: number
  collapseRatio: number
  verdictRu: string
  verdictEn: string
  stepsRu: string[]
  stepsEn: string[]
}

const R_GAS = 8.3144626e-3 // кДж / (моль·К)
const r1 = (n: number) => Number(n.toFixed(1))
const r2 = (n: number) => Number(n.toFixed(2))
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Коэффициент скорости по уравнению Аррениуса относительно опорной температуры T_ref (°C). */
export function arrheniusFactor(eaKJ: number, tempC: number, refTempC = 25): number {
  const T = tempC + 273.15
  const Tref = refTempC + 273.15
  return Math.exp((-eaKJ / R_GAS) * (1 / T - 1 / Tref))
}

/** Классический численный решатель систем ОДУ методом Рунге–Кутты 4-го порядка (RK4). */
export function solveOdeRK4(
  y0: number[],
  deriv: (t: number, y: number[]) => number[],
  tMax: number,
  steps = 60,
): { times: number[]; states: number[][] } {
  const n = y0.length
  const dt = tMax / steps
  const times: number[] = [0]
  const states: number[][] = [y0.slice()]
  let y = y0.slice()

  for (let i = 0; i < steps; i++) {
    const t = i * dt
    const k1 = deriv(t, y)
    const y2 = y.map((v, j) => Math.max(0, v + 0.5 * dt * k1[j]))
    const k2 = deriv(t + 0.5 * dt, y2)
    const y3 = y.map((v, j) => Math.max(0, v + 0.5 * dt * k2[j]))
    const k3 = deriv(t + 0.5 * dt, y3)
    const y4 = y.map((v, j) => Math.max(0, v + dt * k3[j]))
    const k4 = deriv(t + dt, y4)

    y = y.map((v, j) => Math.max(0, v + (dt / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j])))
    times.push(r2((i + 1) * dt))
    states.push(y.slice())
  }
  return { times, states }
}

/** Каталог из 6 ключевых органических и коллоидных реакций косметической химии. */
export const REACTIONS_CATALOG: ReactionDefinition[] = [
  {
    id: 'saponification-stearate',
    categoryRu: 'Межфазная органика · Эмульгирование',
    categoryEn: 'Interfacial Organic · Emulsification',
    titleRu: 'In-situ омыление стеариновой кислоты (TEA / KOH)',
    titleEn: 'In-Situ Saponification of Stearic Acid (TEA / KOH)',
    subtitleRu: 'Образование анионного мыла-эмульгатора прямо на границе фаз масло/вода',
    subtitleEn: 'Formation of anionic soap emulsifier directly at the oil/water interface',
    equation: 'C₁₇H₃₅COOH (масло) + N(CH₂CH₂OH)₃ (вода) ⇌ C₁₇H₃₅COO⁻ [HN⁺(CH₂CH₂OH)₃] (граница фаз)',
    mechanismSummaryRu: 'Липофильная стеариновая кислота диффундирует из масляной капли к границе раздела, где протонирует водорастворимый триэтаноламин (TEA). Возникающий амфифильный стеарат TEA резко снижает межфазное натяжение и самособирается в плёнку O/W.',
    mechanismSummaryEn: 'Lipophilic stearic acid diffuses from oil droplets to the interface, where it protonates water-soluble triethanolamine (TEA). The resulting amphiphilic TEA-stearate sharply lowers interfacial tension and self-assembles into an O/W film.',
    timeUnitRu: 'мин',
    timeUnitEn: 'min',
    relatedTopicIds: ['emulsifier-selection', 'emulsification', 'lamellar-gel-network'],
    molecules: [
      { nameRu: 'Стеариновая кислота', nameEn: 'Stearic Acid', formula: 'C₁₈H₃₆O₂', smiles: 'CCCCCCCCCCCCCCCCCC(=O)O', role: 'reactant' },
      { nameRu: 'Триэтаноламин (TEA)', nameEn: 'Triethanolamine (TEA)', formula: 'C₆H₁₅NO₃', smiles: 'OCCN(CCO)CCO', role: 'reactant' },
      { nameRu: 'Стеарат TEA (эмульгатор)', nameEn: 'TEA-Stearate (emulsifier)', formula: 'C₂₄H₅₁NO₅', smiles: 'CCCCCCCCCCCCCCCCCC(=O)[O-].OCC[NH+](CCO)CCO', role: 'product' },
    ],
    params: [
      { id: 'tempC', labelRu: 'Температура эмульгирования', labelEn: 'Emulsification temperature', unitRu: '°C', unitEn: '°C', min: 45, max: 85, step: 1, defaultValue: 75 },
      { id: 'baseRatio', labelRu: 'Мольное отношение TEA / кислота', labelEn: 'Molar ratio TEA / acid', unitRu: 'моль/моль', unitEn: 'mol/mol', min: 0.2, max: 1.4, step: 0.05, defaultValue: 0.55 },
      { id: 'shearRpm', labelRu: 'Обороты гомогенизатора (площадь границы)', labelEn: 'Homogenizer speed (interfacial area)', unitRu: 'об/мин', unitEn: 'rpm', min: 200, max: 3000, step: 100, defaultValue: 1800 },
    ],
  },
  {
    id: 'carbomer-neutralization',
    categoryRu: 'Полимерная коллоидная химия · Реология',
    categoryEn: 'Polymer Colloid Chemistry · Rheology',
    titleRu: 'Нейтрализация карбомера (ПАК + OH⁻) и солевой коллапс',
    titleEn: 'Carbomer Neutralization (PAA + OH⁻) & Salt Collapse',
    subtitleRu: 'Депротонирование карбоксильных групп, распрямление полимерного клубка и экранирование электролитом',
    subtitleEn: 'Carboxyl deprotonation, electrostatic coil expansion, and electrolyte Debye screening',
    equation: '—[CH₂—CH(COOH)]ₙ— + n OH⁻ ⇌ —[CH₂—CH(COO⁻)]ₙ— + n H₂O   (+ Na⁺ → сжатие ДЭС)',
    mechanismSummaryRu: 'При pH 3–4 сшитая полиакриловая кислота свёрнута в плотные клубки. Ввод щёлочи ионизирует группы —COOH → —COO⁻: электростатическое отталкивание расправляет цепи в 10 раз, формируя гель с пределом текучести. Ионы Na⁺ сжимают двойной электрический слой (κ⁻¹) и мгновенно схлопывают гель.',
    mechanismSummaryEn: 'At pH 3–4 cross-linked polyacrylic acid stays tightly coiled. Adding base ionizes —COOH → —COO⁻: electrostatic repulsion unfolds chains 10× into a yield-stress hydrogel. Na⁺ ions compress the electrical double layer (κ⁻¹) and collapse the gel.',
    timeUnitRu: 'pH',
    timeUnitEn: 'pH',
    relatedTopicIds: ['polymer-thickeners', 'ionic-strength', 'ph-buffers'],
    molecules: [
      { nameRu: 'Карбомер (кислотная форма)', nameEn: 'Carbomer (acid form)', formula: '(C₃H₄O₂)ₙ', smiles: 'C=CC(=O)O', role: 'reactant' },
      { nameRu: 'Гидроксид натрия', nameEn: 'Sodium Hydroxide', formula: 'NaOH', smiles: '[Na+].[OH-]', role: 'catalyst' },
      { nameRu: 'Полиакрилат-ион (гель)', nameEn: 'Polyacrylate network (gel)', formula: '(C₃H₃O₂⁻)ₙ', smiles: 'C=CC(=O)[O-]', role: 'product' },
    ],
    params: [
      { id: 'targetPh', labelRu: 'Текущий pH нейтрализации', labelEn: 'Target neutralization pH', unitRu: 'pH', unitEn: 'pH', min: 3.0, max: 9.5, step: 0.1, defaultValue: 6.4 },
      { id: 'polymerPct', labelRu: 'Концентрация карбомера', labelEn: 'Carbomer concentration', unitRu: '%', unitEn: '%', min: 0.1, max: 1.0, step: 0.05, defaultValue: 0.5 },
      { id: 'saltPct', labelRu: 'Концентрация электролита (NaCl)', labelEn: 'Electrolyte load (NaCl)', unitRu: '%', unitEn: '%', min: 0, max: 2.5, step: 0.05, defaultValue: 0.05 },
    ],
  },
  {
    id: 'lipid-peroxidation',
    categoryRu: 'Радикальная органика · Стабильность масел',
    categoryEn: 'Free-Radical Organic · Lipid Stability',
    titleRu: 'Цепное перекисное окисление ПНЖК и обрыв цепи',
    titleEn: 'PUFA Lipid Peroxidation & Antioxidant Chain-Breaking',
    subtitleRu: 'Инициация ионами металлов, автокаталитический рост гидропероксидов и защита токоферолом + EDTA',
    subtitleEn: 'Metal-catalyzed initiation, autocatalytic hydroperoxide propagation, and tocopherol + EDTA quenching',
    equation: 'LH → L• + O₂ → LOO• → LOOH (прогоркание);   LOO• + ArOH (Vit E) → LOOH + ArO• (обрыв)',
    mechanismSummaryRu: 'Полиненасыщенные масла (линолевая, линоленовая к-ты) имеют уязвимые бис-аллильные связи C—H. Следы Fe²⁺/Cu²⁺ запускают цепь радикалов LOO•. Пока жив токоферол, идёт индукционный период; как только он исчерпан, пероксидное число (PV) растёт лавинообразно. EDTA связывает металлы и продлевает защиту в разы.',
    mechanismSummaryEn: 'Polyunsaturated oils have weak bis-allylic C—H bonds. Trace Fe²⁺/Cu²⁺ sparks LOO• radical chains. Tocopherol sustains an induction period until depleted, after which peroxide value (PV) surges exponentially. EDTA chelates metals and multiplies shelf life.',
    timeUnitRu: 'дн.',
    timeUnitEn: 'days',
    relatedTopicIds: ['oil-oxidation', 'anhydrous-sticks-balms', 'stability-testing'],
    molecules: [
      { nameRu: 'Линолевая кислота (ПНЖК)', nameEn: 'Linoleic Acid (PUFA)', formula: 'C₁₈H₃₂O₂', smiles: 'CCCCCC=CCC=CCCCCCCCC(=O)O', role: 'reactant' },
      { nameRu: 'α-Токоферол (витамин E)', nameEn: 'α-Tocopherol (Vitamin E)', formula: 'C₂₉H₅₀O₂', smiles: 'Cc1c(C)c2c(c(C)c1O)CCC(C)(CCCC(C)CCCC(C)CCCC(C)C)O2', role: 'catalyst' },
      { nameRu: 'Гидропероксид липида (LOOH)', nameEn: 'Lipid Hydroperoxide (LOOH)', formula: 'C₁₈H₃₂O₄', smiles: 'CCCCCC=CC=CC(OO)CCCCCCCC(=O)O', role: 'byproduct' },
    ],
    params: [
      { id: 'tempC', labelRu: 'Температура хранения', labelEn: 'Storage temperature', unitRu: '°C', unitEn: '°C', min: 20, max: 55, step: 1, defaultValue: 40 },
      { id: 'pufaPct', labelRu: 'Доля непредельных масел (ПНЖК)', labelEn: 'Unsaturated PUFA oil share', unitRu: '%', unitEn: '%', min: 10, max: 100, step: 5, defaultValue: 50 },
      { id: 'tocopherolPct', labelRu: 'Антиоксидант (токоферол)', labelEn: 'Antioxidant (tocopherol)', unitRu: '%', unitEn: '%', min: 0, max: 0.6, step: 0.05, defaultValue: 0.2 },
      { id: 'edtaPct', labelRu: 'Хелатор металлов (Disodium EDTA)', labelEn: 'Metal chelator (Disodium EDTA)', unitRu: '%', unitEn: '%', min: 0, max: 0.2, step: 0.02, defaultValue: 0.1 },
    ],
  },
  {
    id: 'urea-niacinamide-hydrolysis',
    categoryRu: 'Кинетика активов · Буферные системы',
    categoryEn: 'Active Kinetics · Buffer Systems',
    titleRu: 'Гидролиз мочевины и ниацинамида (дрейф pH)',
    titleEn: 'Urea & Niacinamide Hydrolysis (pH Drift)',
    subtitleRu: 'Выделение аммиака из мочевины, никотиновая кислота при кислом pH и роль лактатного буфера',
    subtitleEn: 'Ammonia release from urea, nicotinic acid formation at acidic pH, and lactate buffer defense',
    equation: 'CO(NH₂)₂ + H₂O → 2 NH₃↑ + CO₂ (рост pH);   Niacinamide + H₂O →(H⁺) Nicotinic Acid (гиперемия)',
    mechanismSummaryRu: 'Мочевина гидролизуется с выделением аммиака, который защелачивает крем и дополнительно ускоряет распад (автокатализ) — спасением служит лактатный/цитратный буфер при pH 6,0. Ниацинамид, напротив, стабилен при pH 5–7, но при pH < 4,5 и нагреве гидролизуется в никотиновую кислоту, вызывающую покраснение кожи.',
    mechanismSummaryEn: 'Urea hydrolyzes into ammonia, pushing pH upward in an autocatalytic loop — stabilized by a pH 6.0 lactate/citrate buffer. Niacinamide is stable at pH 5–7, but below pH 4.5 and elevated heat hydrolyzes into flushing nicotinic acid.',
    timeUnitRu: 'дн.',
    timeUnitEn: 'days',
    relatedTopicIds: ['unstable-actives', 'ph-buffers', 'stability-testing'],
    molecules: [
      { nameRu: 'Мочевина (карбамид)', nameEn: 'Urea', formula: 'CH₄N₂O', smiles: 'NC(=O)N', role: 'reactant' },
      { nameRu: 'Ниацинамид', nameEn: 'Niacinamide', formula: 'C₆H₆N₂O', smiles: 'NC(=O)c1cccnc1', role: 'reactant' },
      { nameRu: 'Никотиновая кислота', nameEn: 'Nicotinic Acid', formula: 'C₆H₅NO₂', smiles: 'O=C(O)c1cccnc1', role: 'byproduct' },
    ],
    params: [
      { id: 'tempC', labelRu: 'Температура хранения', labelEn: 'Storage temperature', unitRu: '°C', unitEn: '°C', min: 20, max: 50, step: 1, defaultValue: 40 },
      { id: 'initialPh', labelRu: 'Начальный pH формулы', labelEn: 'Initial formula pH', unitRu: 'pH', unitEn: 'pH', min: 3.0, max: 7.5, step: 0.1, defaultValue: 6.0 },
      { id: 'bufferPct', labelRu: 'Мощность лактатного буфера', labelEn: 'Lactate buffer capacity', unitRu: '%', unitEn: '%', min: 0, max: 100, step: 5, defaultValue: 60 },
    ],
  },
  {
    id: 'ascorbic-retinol-degradation',
    categoryRu: 'Окислительная кинетика · Цвет и упаковка',
    categoryEn: 'Oxidative Kinetics · Color & Packaging',
    titleRu: 'Деградация L-аскорбиновой кислоты (L-AA → ДГК → ДКГ)',
    titleEn: 'L-Ascorbic Acid Degradation (L-AA → DHA → DKG)',
    subtitleRu: 'Последовательное окисление в янтарные хромофоры и синергия pH ≤ 3,5 + феруловая + Airless',
    subtitleEn: 'Sequential oxidation to amber chromophores and synergy of pH ≤ 3.5 + ferulic acid + Airless',
    equation: 'L-AA (прозрачная) →(O₂, OH⁻) DHA → DKG + фураны (пожелтение / потемнение)',
    mechanismSummaryRu: 'При pH > 3,5 растёт доля аскорбат-аниона (pKa₁ = 4,1), который окисляется кислородом воздуха на порядок быстрее протонированной формы. Дегидроаскорбиновая кислота (ДГК) необратимо размыкает кольцо до 2,3-дикетогулоновой кислоты (ДКГ), окрашивая сыворотку от соломенного до тёмно-янтарного.',
    mechanismSummaryEn: 'Above pH 3.5 the ascorbate anion fraction (pKa₁ = 4.1) rises and oxidizes an order of magnitude faster with dissolved O₂. Dehydroascorbic acid (DHA) irreversibly ring-opens to 2,3-diketogulonic acid (DKG), turning serum from pale straw to dark amber.',
    timeUnitRu: 'дн.',
    timeUnitEn: 'days',
    relatedTopicIds: ['unstable-actives', 'packaging-compatibility', 'ph-buffers'],
    molecules: [
      { nameRu: 'L-Аскорбиновая кислота', nameEn: 'L-Ascorbic Acid', formula: 'C₆H₈O₆', smiles: 'O=C1OC(C(O)CO)C(O)=C1O', role: 'reactant' },
      { nameRu: 'Феруловая кислота (стабилизатор)', nameEn: 'Ferulic Acid (stabilizer)', formula: 'C₁₀H₁₀O₄', smiles: 'COc1cc(/C=C/C(=O)O)ccc1O', role: 'catalyst' },
      { nameRu: '2,3-Дикетогулоновая кислота', nameEn: '2,3-Diketogulonic Acid (DKG)', formula: 'C₆H₈O₇', smiles: 'O=C(O)C(=O)C(=O)C(O)C(O)CO', role: 'byproduct' },
    ],
    params: [
      { id: 'tempC', labelRu: 'Температура хранения', labelEn: 'Storage temperature', unitRu: '°C', unitEn: '°C', min: 4, max: 45, step: 1, defaultValue: 25 },
      { id: 'pH', labelRu: 'pH сыворотки', labelEn: 'Serum pH', unitRu: 'pH', unitEn: 'pH', min: 2.5, max: 6.5, step: 0.1, defaultValue: 3.3 },
      { id: 'oxygenPct', labelRu: 'Доступ кислорода (0 = Airless, 100 = пипетка)', labelEn: 'Oxygen exposure (0 = Airless, 100 = dropper)', unitRu: '%', unitEn: '%', min: 5, max: 100, step: 5, defaultValue: 20 },
      { id: 'ferulicSynergy', labelRu: 'Защита (0,5 % феруловая + 1 % вит. E)', labelEn: 'Protection (0.5% ferulic + 1% Vit E)', unitRu: '%', unitEn: '%', min: 0, max: 100, step: 10, defaultValue: 80 },
    ],
  },
  {
    id: 'micellar-schiff-interfacial',
    categoryRu: 'Коллоидный катализ · Отдушки и цвет',
    categoryEn: 'Colloidal Catalysis · Fragrances & Color',
    titleRu: 'Основания Шиффа и мицеллярное экранирование отдушки',
    titleEn: 'Schiff Base Discoloration & Micellar Shielding',
    subtitleRu: 'Реакция альдегидов отдушек (ванилин) с аминами и защита за счёт солюбилизации в ядре мицелл выше ККМ',
    subtitleEn: 'Fragrance aldehyde (vanillin) + amine condensation and compartmentalization inside micelles above CMC',
    equation: 'R—CHO (альдегид) + R′—NH₂ (амин/пептид) ⇌ R—CH=N—R′ (основание Шиффа, жёлтое) + H₂O',
    mechanismSummaryRu: 'Альдегиды отдушек (ванилин, коричный альдегид, цитраль) конденсируются с первичными аминами (аминокислоты, пептиды, TEA), образуя жёлто-коричневые основания Шиффа. Выше ККМ липофильный альдегид распределяется в гидрофобное ядро мицелл неионогенного ПАВ, физически изолируясь от водорастворимых аминов (псевдофазная модель Березина).',
    mechanismSummaryEn: 'Fragrance aldehydes (vanillin, cinnamal, citral) condense with primary amines (amino acids, peptides, TEA) into yellow-brown Schiff bases. Above CMC, lipophilic aldehydes partition into nonionic micelle cores, physically shielding them from aqueous amines (Berezin pseudophase model).',
    timeUnitRu: 'дн.',
    timeUnitEn: 'days',
    relatedTopicIds: ['fragrances-allergens', 'micellar-solubility', 'surface-tension'],
    molecules: [
      { nameRu: 'Ванилин (альдегид отдушки)', nameEn: 'Vanillin (fragrance aldehyde)', formula: 'C₈H₈O₃', smiles: 'COc1cc(C=O)ccc1O', role: 'reactant' },
      { nameRu: 'Глицин / аминодонор', nameEn: 'Glycine / amine donor', formula: 'C₂H₅NO₂', smiles: 'NCC(=O)O', role: 'reactant' },
      { nameRu: 'Основание Шиффа (хромофор)', nameEn: 'Schiff Base (chromophore)', formula: 'C₁₀H₁₁NO₄', smiles: 'COc1cc(/C=N/CC(=O)O)ccc1O', role: 'byproduct' },
    ],
    params: [
      { id: 'tempC', labelRu: 'Температура хранения', labelEn: 'Storage temperature', unitRu: '°C', unitEn: '°C', min: 20, max: 50, step: 1, defaultValue: 35 },
      { id: 'pH', labelRu: 'pH системы', labelEn: 'System pH', unitRu: 'pH', unitEn: 'pH', min: 4.0, max: 8.5, step: 0.1, defaultValue: 6.2 },
      { id: 'cmcRatio', labelRu: 'Концентрация солюбилизатора (× ККМ)', labelEn: 'Solubilizer concentration (× CMC)', unitRu: '×ККМ', unitEn: '×CMC', min: 0, max: 8, step: 0.5, defaultValue: 3.0 },
      { id: 'aminePct', labelRu: 'Доля аминодоноров (пептиды/TEA)', labelEn: 'Amine donor load (peptides/TEA)', unitRu: '%', unitEn: '%', min: 0.1, max: 2.0, step: 0.1, defaultValue: 0.8 },
    ],
  },
]

export function getDefaultReactionParams(id: ReactionId): Record<string, number> {
  const def = REACTIONS_CATALOG.find((r) => r.id === id) ?? REACTIONS_CATALOG[0]
  const out: Record<string, number> = {}
  for (const p of def.params) out[p.id] = p.defaultValue
  return out
}

/** Интерполяция цвета сыворотки/крема по индексу пожелтения (0..1). */
function yellowingSwatch(index: number): string {
  const t = clamp(index, 0, 1)
  // От светло-молочного/прозрачного #F8FAFC → соломенного #FDE68A → янтарного #B45309
  if (t < 0.5) {
    const u = t * 2
    const R = Math.round(248 + (253 - 248) * u)
    const G = Math.round(250 + (230 - 250) * u)
    const B = Math.round(252 + (138 - 252) * u)
    return `rgb(${R}, ${G}, ${B})`
  }
  const u = (t - 0.5) * 2
  const R = Math.round(253 + (180 - 253) * u)
  const G = Math.round(230 + (83 - 230) * u)
  const B = Math.round(138 + (9 - 138) * u)
  return `rgb(${R}, ${G}, ${B})`
}

/** Выполняет детерминированный численный расчёт выбранной органической / коллоидной реакции. */
export function simulateReaction(
  id: ReactionId,
  rawParams: Record<string, number>,
): ReactionSimulationResult {
  const defaults = getDefaultReactionParams(id)
  const p = (k: string) => (Number.isFinite(rawParams[k]) ? rawParams[k] : defaults[k])

  if (id === 'saponification-stearate') {
    const tempC = p('tempC')
    const baseRatio = p('baseRatio')
    const shearRpm = p('shearRpm')
    // Ниже 68 °C стеариновая кислота частично твёрдая → резкое торможение массопереноса
    const meltFactor = tempC < 66 ? 0.14 : tempC < 70 ? 0.55 : 1.0
    const areaFactor = Math.pow(shearRpm / 1200, 0.72)
    const kFwd = 0.24 * arrheniusFactor(44, tempC, 75) * meltFactor * areaFactor
    const kRev = 0.012

    const tMax = 20 // минут
    const { times, states } = solveOdeRK4(
      [100, baseRatio * 100, 0],
      (_t, [acid, base, soap]) => {
        const rate = kFwd * (acid / 100) * (base / 100) * 100 - kRev * soap
        return [-rate, -rate, rate]
      },
      tMax,
      60,
    )

    const finalSoap = states[states.length - 1][2]
    const finalExcessTea = states[states.length - 1][1]
    const conversionPct = r1(clamp(finalSoap, 0, 100))
    const estPh = r2(clamp(5.6 + baseRatio * 2.1 + (finalExcessTea / 100) * 1.1, 5.4, 9.2))
    const d50Um = r1(clamp(18 / (1 + (conversionPct / 28) * Math.sqrt(shearRpm / 800)), 1.6, 22))
    const halfIdx = states.findIndex((s) => s[2] >= Math.min(50, conversionPct * 0.5))
    const halfTime = halfIdx > 0 ? times[halfIdx] : tMax

    const tonePh = estPh > 8.2 ? 'bad' : estPh > 7.6 ? 'warn' : 'ok'
    const toneConv = conversionPct < 35 ? 'warn' : 'ok'

    return {
      times,
      tMax,
      yMax: Math.max(105, Math.ceil(baseRatio * 105)),
      yUnitRu: '% от кислоты',
      yUnitEn: '% of acid',
      series: [
        { id: 'acid', labelRu: 'Стеариновая кислота (масло)', labelEn: 'Stearic acid (oil)', color: '#F59E0B', values: states.map((s) => r1(s[0])) },
        { id: 'soap', labelRu: 'Стеарат TEA (эмульгатор)', labelEn: 'TEA-Stearate (emulsifier)', color: '#0EA5E9', values: states.map((s) => r1(s[2])) },
        { id: 'base', labelRu: 'Свободный TEA (вода)', labelEn: 'Free TEA (water)', color: '#8B5CF6', values: states.map((s) => r1(s[1])) },
      ],
      kpis: [
        { labelRu: 'Выход мыла-эмульгатора', labelEn: 'Soap emulsifier yield', value: `${conversionPct} %`, tone: toneConv },
        { labelRu: 'Время полупревращения t₁/₂', labelEn: 'Half-time t₁/₂', value: `${halfTime} ${language === 'en' ? 'min' : 'мин'}`, tone: 'neutral' },
        { labelRu: 'Расчётный pH эмульсии', labelEn: 'Estimated emulsion pH', value: `${estPh}`, tone: tonePh },
        { labelRu: 'Прогноз размера капель d₅₀', labelEn: 'Predicted droplet d₅₀', value: `${d50Um} ${language === 'en' ? 'μm' : 'мкм'}`, tone: d50Um <= 4.5 ? 'ok' : 'warn' },
      ],
      progressRatio: clamp(conversionPct / 100, 0, 1),
      shieldingRatio: clamp(shearRpm / 3000, 0, 1),
      collapseRatio: tempC < 68 ? 0.85 : 0,
      verdictRu:
        tempC < 68
          ? 'Температура ниже точки плавления стеариновой кислоты (~69 °C): реакция заторможена, эмульгатор не успевает закрыть поверхность капель.'
          : baseRatio > 1.05
            ? 'Избыток TEA (> 1,0 моль/моль) поднимает pH выше 8,0 — риск раздражения кожи и нежелательных нитрозаминов.'
            : baseRatio < 0.35
              ? 'Недостаток щёлочи (< 0,35 моль/моль): мало анионного стеарата, преобладает свободная кислота — эмульсия склонна к коалесценции.'
              : 'Оптимальный режим in-situ (0,4–0,7 моль TEA на 1 моль кислоты при 75 °C): свободная стеариновая кислота работает соэмульгатором LGN, а стеарат TEA стабилизирует капли 2–4 мкм.',
      verdictEn:
        tempC < 68
          ? 'Below stearic acid melting point (~69 °C): interfacial transfer stalls and emulsifier coverage stays incomplete.'
          : baseRatio > 1.05
            ? 'Excess TEA (> 1.0 mol/mol) pushes pH above 8.0 — skin irritation and nitrosamine compliance risk.'
            : baseRatio < 0.35
              ? 'Under-neutralized (< 0.35 mol/mol): insufficient anionic stearate soap — emulsion tends to coalesce.'
              : 'Optimal in-situ window (0.4–0.7 mol TEA per mol acid at 75 °C): unreacted stearic acid builds LGN structure while TEA-stearate stabilizes 2–4 μm droplets.',
      stepsRu: [
        '1. Расплав стеариновой кислоты (T ≥ 70 °C) дробится ротором на капли.',
        '2. Молекулы R—COOH выходят на границу масло/вода и отдают протон TEA.',
        '3. Возникает плотный межфазный слой стеарата TEA, резко снижая γ и закрепляя эмульсию.',
      ],
      stepsEn: [
        '1. Molten stearic acid (T ≥ 70 °C) shears into fine oil droplets.',
        '2. R—COOH diffuses to the oil/water interface and protonates aqueous TEA.',
        '3. Dense interfacial TEA-stearate film drops γ and locks in fine O/W droplets.',
      ],
    }
  }

  if (id === 'carbomer-neutralization') {
    const targetPh = p('targetPh')
    const polymerPct = p('polymerPct')
    const saltPct = p('saltPct')

    // Кривая вязкости и ионизации по шкале pH от 3.0 до 9.5 (33 точки)
    const times: number[] = []
    const ionCurve: number[] = []
    const visCurve: number[] = []
    // Ионная сила (М) и длина Дебая κ⁻¹ (нм)
    const ionicStrengthM = 0.004 + (saltPct * 10) / 58.44
    const debyeNm = r2(0.304 / Math.sqrt(ionicStrengthM))
    // Экспоненциальное сжатие клубка электролитом
    const saltRetention = Math.exp(-saltPct * 3.1)

    const calcPoint = (phVal: number) => {
      const alpha = 100 / (1 + Math.pow(10, 5.4 - phVal))
      // Выше pH 8.5 избыток NaOH сам повышает ионную силу и снижает вязкость
      const overBasePenalty = phVal > 8.2 ? Math.exp(-(phVal - 8.2) * 0.72) : 1
      const coilExpand = Math.pow(alpha / 100, 1.45) * saltRetention * overBasePenalty
      const visPas = r2(0.05 + polymerPct * 68 * coilExpand)
      return { alpha: r1(alpha), visPas, coilExpand }
    }

    for (let i = 0; i <= 32; i++) {
      const phVal = r2(3.0 + (6.5 * i) / 32)
      const pt = calcPoint(phVal)
      times.push(phVal)
      ionCurve.push(pt.alpha)
      visCurve.push(pt.visPas)
    }

    const cur = calcPoint(targetPh)
    const visMPas = Math.round(cur.visPas * 1000)
    const yieldPa = r1(cur.visPas * 0.85)
    const collapsed = saltPct >= 0.4 || targetPh < 5.0 || targetPh > 8.8

    return {
      times,
      tMax: 9.5,
      yMax: Math.max(40, Math.ceil(Math.max(...visCurve, 100) * 1.05)),
      yUnitRu: 'Па·с / %',
      yUnitEn: 'Pa·s / %',
      series: [
        { id: 'vis', labelRu: 'Вязкость геля (Па·с)', labelEn: 'Gel viscosity (Pa·s)', color: '#0EA5E9', values: visCurve },
        { id: 'ion', labelRu: 'Ионизация —COO⁻ (%)', labelEn: 'Ionization —COO⁻ (%)', color: '#10B981', values: ionCurve },
      ],
      kpis: [
        { labelRu: 'Ионизация —COO⁻ при pH ' + targetPh, labelEn: 'Ionization —COO⁻ at pH ' + targetPh, value: `${cur.alpha} %`, tone: cur.alpha >= 60 ? 'ok' : 'warn' },
        { labelRu: 'Длина Дебая κ⁻¹', labelEn: 'Debye length κ⁻¹', value: `${debyeNm} ${language === 'en' ? 'nm' : 'нм'}`, tone: debyeNm < 1.2 ? 'bad' : 'ok' },
        { labelRu: 'Вязкость геля', labelEn: 'Gel viscosity', value: `${visMPas.toLocaleString(language === 'en' ? 'en-US' : 'ru-RU')} ${language === 'en' ? 'mPa·s' : 'мПа·с'}`, tone: collapsed ? 'bad' : 'ok' },
        { labelRu: 'Предел текучести τ₀', labelEn: 'Yield stress τ₀', value: `${yieldPa} ${language === 'en' ? 'Pa' : 'Па'}`, tone: yieldPa >= 8 ? 'ok' : 'warn' },
      ],
      progressRatio: clamp(cur.coilExpand, 0, 1),
      shieldingRatio: clamp(1 - saltRetention, 0, 1),
      collapseRatio: collapsed ? clamp(1 - cur.coilExpand, 0.25, 1) : 0,
      verdictRu:
        saltPct >= 0.4
          ? `Солевой коллапс! ${saltPct} % NaCl сжимает двойной слой до κ⁻¹ = ${debyeNm} нм — цепи теряют отталкивание и гель превращается в воду.`
          : targetPh < 5.0
            ? 'Карбомер недонейтрализован (pH < 5,0): группы —COOH протонированы, полимерные клубки остаются сжатыми.'
            : targetPh > 8.6
              ? 'Перещелачивание (pH > 8,6): избыток катионов Na⁺ сам начинает экранировать цепи и ронять вязкость.'
              : 'Оптимальное плато нейтрализации (pH 5,8–7,5, без солей): максимальное распрямление макромолекул и стабильный прозрачный гель.',
      verdictEn:
        saltPct >= 0.4
          ? `Electrolyte collapse! ${saltPct}% NaCl compresses the double layer to κ⁻¹ = ${debyeNm} nm — chains lose repulsion and gel liquefies.`
          : targetPh < 5.0
            ? 'Under-neutralized carbomer (pH < 5.0): —COOH groups stay protonated and polymer coils remain collapsed.'
            : targetPh > 8.6
              ? 'Over-neutralized (pH > 8.6): excess Na⁺ counter-ions screen polymer charges and cut viscosity.'
              : 'Optimal neutralization plateau (pH 5.8–7.5, salt-free): fully expanded polymer network and stable crystal-clear gel.',
      stepsRu: [
        '1. Дисперсия в воде (pH ~3): цепи сшитой ПАК свёрнуты в компактные клубки.',
        '2. Ввод NaOH/TEA (pH 5,5–7,5): ионизация —COO⁻ распирает сетку зарядом.',
        '3. Попадание электролитов (NaCl / алоэ / экстракты): катионы сжимают κ⁻¹ и рушат вязкость.',
      ],
      stepsEn: [
        '1. Aqueous dispersion (pH ~3): cross-linked PAA chains stay tightly coiled.',
        '2. Base addition (pH 5.5–7.5): —COO⁻ repulsion expands the hydrogel mesh.',
        '3. Electrolyte intrusion (NaCl / aloe / salts): cations shrink κ⁻¹ and collapse viscosity.',
      ],
    }
  }

  if (id === 'lipid-peroxidation') {
    const tempC = p('tempC')
    const pufaPct = p('pufaPct')
    const tocopherolPct = p('tocopherolPct')
    const edtaPct = p('edtaPct')

    const tMax = 180 // дней
    const arr = arrheniusFactor(62, tempC, 25)
    // EDTA резко гасит инициирование ионами Fe²⁺/Cu²⁺
    const metalFactor = 1 / (1 + edtaPct * 42)
    const pufaFactor = 0.25 + (pufaPct / 100) * 1.4
    const ki = 0.0085 * arr * metalFactor * pufaFactor
    const kp = 0.048 * arr * pufaFactor
    const kinh = 0.22 // скорость обрыва цепи токоферолом

    // y = [IntactOil_%, PeroxideValue_meq, Tocopherol_rel_%]
    const { times, states } = solveOdeRK4(
      [100, 0.5, tocopherolPct * 160],
      (_t, [lh, pv, aox]) => {
        const lhFrac = lh / 100
        // Когда антиоксидант исчерпан, автокаталитический распад LOOH ускоряет окисление
        const inhib = 1 / (1 + aox * kinh)
        const rateOx = (ki + kp * pv * 0.032) * lhFrac * inhib
        const dPv = rateOx * 18
        const dLh = -rateOx * 1.8
        const dAox = aox > 0 ? -Math.min(aox, (ki * 22 + kp * pv * 0.09) * (aox / (aox + 2))) : 0
        return [dLh, dPv, dAox]
      },
      tMax,
      60,
    )

    const pvAt90 = r1(states[30][1])
    const pvEnd = r1(states[states.length - 1][1])
    const intactEnd = r1(states[states.length - 1][0])
    const aoxLeftPct = tocopherolPct > 0 ? r1((states[states.length - 1][2] / (tocopherolPct * 160)) * 100) : 0
    const rancidIdx = states.findIndex((s) => s[1] >= 10)
    const inductionDays = rancidIdx === -1 ? tMax : Math.round(times[rancidIdx])

    const tone = inductionDays >= 150 ? 'ok' : inductionDays >= 60 ? 'warn' : 'bad'
    return {
      times,
      tMax,
      yMax: Math.max(25, Math.min(120, Math.ceil(Math.max(100, ...states.map((s) => s[1])) * 1.05))),
      yUnitRu: '% / мэкв/кг',
      yUnitEn: '% / meq/kg',
      series: [
        { id: 'lh', labelRu: 'Неокисленные липиды (%)', labelEn: 'Intact lipids (%)', color: '#10B981', values: states.map((s) => r1(s[0])) },
        { id: 'pv', labelRu: 'Пероксидное число PV (мэкв/кг)', labelEn: 'Peroxide Value PV (meq/kg)', color: '#EF4444', values: states.map((s) => r1(Math.min(120, s[1]))) },
        { id: 'aox', labelRu: 'Запас токоферола (отн. ед.)', labelEn: 'Tocopherol reserve (rel.)', color: '#F59E0B', values: states.map((s) => r1(s[2])) },
      ],
      kpis: [
        { labelRu: 'Индукционный период (PV < 10)', labelEn: 'Induction period (PV < 10)', value: rancidIdx === -1 ? `> ${tMax} ${language === 'en' ? 'd' : 'дн.'}` : `${inductionDays} ${language === 'en' ? 'd' : 'дн.'}`, tone },
        { labelRu: 'PV через 90 дней', labelEn: 'PV at 90 days', value: `${pvAt90} ${language === 'en' ? 'meq/kg' : 'мэкв/кг'}`, tone: pvAt90 < 10 ? 'ok' : 'bad' },
        { labelRu: 'Сохранность масел (180 дн.)', labelEn: 'Intact oils (180 d)', value: `${intactEnd} %`, tone: intactEnd >= 92 ? 'ok' : 'warn' },
        { labelRu: 'Остаток токоферола', labelEn: 'Tocopherol remaining', value: `${aoxLeftPct} %`, tone: aoxLeftPct > 20 ? 'ok' : 'warn' },
      ],
      progressRatio: clamp(pvEnd / 25, 0, 1),
      shieldingRatio: clamp((tocopherolPct / 0.4) * 0.6 + (edtaPct / 0.15) * 0.4, 0, 1),
      collapseRatio: pvAt90 >= 10 ? 0.85 : 0,
      verdictRu:
        tocopherolPct === 0 && edtaPct === 0
          ? 'Незащищённая масляная фаза: без антиоксиданта и хелатора прогоркание наступает стремительно.'
          : pvAt90 >= 10
            ? `При ${tempC} °C и ${pufaPct} % ПНЖК запас антиоксиданта срабатывается слишком рано — усильте связку токоферол + EDTA или снизьте долю ПНЖК.`
            : 'Синергия токоферола (обрыв радикалов LOO•) и EDTA (хелатирование Fe²⁺/Cu²⁺) удерживает пероксидное число ниже порога прогоркания (10 мэкв/кг).',
      verdictEn:
        tocopherolPct === 0 && edtaPct === 0
          ? 'Unprotected lipid phase: without antioxidant and chelator, rancidity erupts rapidly.'
          : pvAt90 >= 10
            ? `At ${tempC} °C and ${pufaPct}% PUFA, antioxidant depletes too fast — boost tocopherol + EDTA synergy or reduce PUFA load.`
            : 'Tocopherol (LOO• quenching) + EDTA (Fe²⁺/Cu²⁺ chelation) synergy holds Peroxide Value safely below the 10 meq/kg rancidity threshold.',
      stepsRu: [
        '1. Инициация: след Fe²⁺/УФ отрывает атом H от бис-аллильной группы ПНЖК → радикал L•.',
        '2. Рост цепи: L• + O₂ → LOO• атакует соседнюю молекулу масла с образованием LOOH.',
        '3. Обрыв: токоферол отдаёт H• радикалу LOO•, а EDTA запирает металлы-катализаторы.',
      ],
      stepsEn: [
        '1. Initiation: trace Fe²⁺/UV abstracts bis-allylic H from PUFA → radical L•.',
        '2. Propagation: L• + O₂ → LOO• attacks neighbor lipid forming hydroperoxide LOOH.',
        '3. Termination: tocopherol donates H• to quench LOO• while EDTA cages metal catalysts.',
      ],
    }
  }

  if (id === 'urea-niacinamide-hydrolysis') {
    const tempC = p('tempC')
    const initialPh = p('initialPh')
    const bufferPct = p('bufferPct')

    const tMax = 180 // дней
    const arr = arrheniusFactor(76, tempC, 25)
    // Буфер гасит рост pH от выделяемого аммиака
    const driftResistance = 1 + (bufferPct / 100) * 14

    // y = [Urea_%, Niacinamide_%, NicotinicAcid_%, pH_val]
    const { times, states } = solveOdeRK4(
      [100, 100, 0, initialPh],
      (_t, [urea, niac, _nicAcid, ph]) => {
        // Мочевина минимально распадается у pH 6.0, резко ускоряется при pH < 4.5 или > 7.2
        const ureaPhFactor = 1 + 0.55 * Math.pow(ph - 6.0, 2)
        const kUrea = 0.00042 * arr * ureaPhFactor
        const dUrea = -kUrea * urea
        // Аммиак сдвигает pH вверх (ограничено ~9.0)
        const dPh = (-dUrea * 0.19) / driftResistance * (ph < 9.0 ? 1 : 0)

        // Ниацинамид гидролизуется в никотиновую к-ту при кислом pH (< 4.8)
        const acidCat = Math.pow(10, Math.max(0, 4.7 - ph))
        const kNiac = 0.00012 * arr * (0.2 + acidCat * 1.8)
        const dNiac = -kNiac * niac
        const dNicAcid = -dNiac
        return [dUrea, dNiac, dNicAcid, dPh]
      },
      tMax,
      60,
    )

    const ureaEnd = r1(states[states.length - 1][0])
    const niacEnd = r1(states[states.length - 1][1])
    const nicAcidPpm = Math.round(states[states.length - 1][2] * 400) // при вводе 4 % ниацинамида
    const finalPh = r2(states[states.length - 1][3])
    const phDrift = r2(finalPh - initialPh)
    const t90UreaIdx = states.findIndex((s) => s[0] < 90)
    const t90Days = t90UreaIdx === -1 ? tMax : Math.round(times[t90UreaIdx])

    return {
      times,
      tMax,
      yMax: 105,
      yUnitRu: '% сохранности',
      yUnitEn: '% remaining',
      series: [
        { id: 'urea', labelRu: 'Сохранность мочевины (%)', labelEn: 'Urea remaining (%)', color: '#0EA5E9', values: states.map((s) => r1(s[0])) },
        { id: 'niac', labelRu: 'Сохранность ниацинамида (%)', labelEn: 'Niacinamide remaining (%)', color: '#10B981', values: states.map((s) => r1(s[1])) },
        { id: 'ph', labelRu: 'pH × 10 (дрейф среды)', labelEn: 'pH × 10 (medium drift)', color: '#F97316', values: states.map((s) => r1(s[3] * 10)) },
      ],
      kpis: [
        { labelRu: 'Остаток мочевины (180 дн.)', labelEn: 'Urea left (180 d)', value: `${ureaEnd} %`, tone: ureaEnd >= 90 ? 'ok' : 'bad' },
        { labelRu: 'Дрейф pH за 180 дн.', labelEn: 'pH drift (180 d)', value: `${initialPh} → ${finalPh} (+${phDrift})`, tone: phDrift > 0.6 ? 'bad' : phDrift > 0.25 ? 'warn' : 'ok' },
        { labelRu: 'Никотиновая к-та (при 4 %)', labelEn: 'Nicotinic acid (at 4%)', value: `${nicAcidPpm} ppm`, tone: nicAcidPpm > 500 ? 'bad' : 'ok' },
        { labelRu: 'Срок t₉₀ мочевины', labelEn: 'Urea t₉₀ shelf life', value: t90UreaIdx === -1 ? `> 180 ${language === 'en' ? 'd' : 'дн.'}` : `${t90Days} ${language === 'en' ? 'd' : 'дн.'}`, tone: t90Days >= 150 ? 'ok' : 'warn' },
      ],
      progressRatio: clamp((100 - Math.min(ureaEnd, niacEnd)) / 35, 0, 1),
      shieldingRatio: clamp(bufferPct / 100, 0, 1),
      collapseRatio: phDrift > 0.7 || nicAcidPpm > 500 ? 0.8 : 0,
      verdictRu:
        nicAcidPpm > 500
          ? `При pH ${initialPh} ниацинамид заметно гидролизуется в никотиновую кислоту (${nicAcidPpm} ppm > 500 ppm) — высокий риск жжения и покраснения (niacin flush).`
          : phDrift > 0.6
            ? `Слабый буфер (${bufferPct} %): выделяемый из мочевины аммиак защелачивает крем до pH ${finalPh} — введите лактатный/цитратный буфер при pH 6,0.`
            : 'Оптимальная зона pH 5,8–6,3 с буфером: оба актива сохраняют > 90 % активности, дрейф pH и образование никотиновой кислоты минимальны.',
      verdictEn:
        nicAcidPpm > 500
          ? `At pH ${initialPh}, niacinamide hydrolyzes into nicotinic acid (${nicAcidPpm} ppm > 500 ppm) — high risk of skin redness (niacin flush).`
          : phDrift > 0.6
            ? `Weak buffer (${bufferPct}%): ammonia released from urea drives pH up to ${finalPh} — add a pH 6.0 lactate/citrate buffer.`
            : 'Optimal pH 5.8–6.3 buffered window: both actives stay > 90% intact with minimal pH drift and negligible nicotinic acid.',
      stepsRu: [
        '1. Нуклеофильная атака воды на карбонил мочевины → карбамат аммония → 2 NH₃ + CO₂.',
        '2. Без буфера NH₃ поднимает pH, ускоряя распад и вызывая вздутие тубы.',
        '3. При pH < 4,5 протонирование амидной группы ниацинамида ведёт к никотиновой кислоте.',
      ],
      stepsEn: [
        '1. Nucleophilic water attack on urea carbonyl → ammonium carbamate → 2 NH₃ + CO₂.',
        '2. Without buffer, NH₃ raises pH, accelerating autocatalysis and tube bloating.',
        '3. Below pH 4.5, acid-catalyzed amide hydrolysis converts niacinamide into nicotinic acid.',
      ],
    }
  }

  if (id === 'ascorbic-retinol-degradation') {
    const tempC = p('tempC')
    const ph = p('pH')
    const oxygenPct = p('oxygenPct')
    const ferulicSynergy = p('ferulicSynergy')

    const tMax = 180 // дней
    const arr = arrheniusFactor(66, tempC, 25)
    // Доля быстро окисляемого аскорбат-аниона (pKa1 = 4.1)
    const anionFrac = 1 / (1 + Math.pow(10, 4.1 - ph))
    const phMult = 0.25 + anionFrac * 4.2
    const o2Mult = 0.12 + (oxygenPct / 100) * 1.9
    const stabMult = 1 - (ferulicSynergy / 100) * 0.68

    const k1 = 0.0052 * arr * phMult * o2Mult * stabMult
    const k2 = 0.018 * arr * (0.4 + anionFrac * 1.4)

    // Последовательная реакция L-AA → DHA → DKG (жёлто-коричневая)
    const { times, states } = solveOdeRK4(
      [100, 0, 0],
      (_t, [laa, dha]) => {
        const r1Rate = k1 * laa
        const r2Rate = k2 * dha
        return [-r1Rate, r1Rate - r2Rate, r2Rate]
      },
      tMax,
      60,
    )

    const laa90 = r1(states[30][0])
    const laa180 = r1(states[states.length - 1][0])
    const dkg180 = r1(states[states.length - 1][2])
    const yellowIdx = clamp(dkg180 / 38, 0, 1)
    const t90Idx = states.findIndex((s) => s[0] < 90)
    const t90Days = t90Idx === -1 ? tMax : Math.round(times[t90Idx])

    return {
      times,
      tMax,
      yMax: 105,
      yUnitRu: '% от исходной L-AA',
      yUnitEn: '% of initial L-AA',
      series: [
        { id: 'laa', labelRu: 'Активная L-аскорбиновая (%)', labelEn: 'Active L-Ascorbic (%)', color: '#0EA5E9', values: states.map((s) => r1(s[0])) },
        { id: 'dha', labelRu: 'Дегидроаскорбиновая ДГК (%)', labelEn: 'Dehydroascorbic DHA (%)', color: '#F59E0B', values: states.map((s) => r1(s[1])) },
        { id: 'dkg', labelRu: 'ДКГ — пожелтение (%)', labelEn: 'DKG — yellowing (%)', color: '#B45309', values: states.map((s) => r1(s[2])) },
      ],
      kpis: [
        { labelRu: 'Остаток L-AA (90 дн.)', labelEn: 'Active L-AA (90 d)', value: `${laa90} %`, tone: laa90 >= 88 ? 'ok' : laa90 >= 70 ? 'warn' : 'bad' },
        { labelRu: 'Остаток L-AA (180 дн.)', labelEn: 'Active L-AA (180 d)', value: `${laa180} %`, tone: laa180 >= 80 ? 'ok' : 'bad' },
        { labelRu: 'Срок t₉₀ (90 % актива)', labelEn: 'Shelf life t₉₀', value: t90Idx === -1 ? `> 180 ${language === 'en' ? 'd' : 'дн.'}` : `${t90Days} ${language === 'en' ? 'd' : 'дн.'}`, tone: t90Days >= 120 ? 'ok' : 'warn' },
        { labelRu: 'Накопление ДКГ (цвет)', labelEn: 'DKG chromophores', value: `${dkg180} %`, tone: dkg180 < 8 ? 'ok' : dkg180 < 20 ? 'warn' : 'bad' },
      ],
      swatchHex: yellowingSwatch(yellowIdx),
      swatchLabelRu: yellowIdx < 0.2 ? 'Прозрачная / без оттенка' : yellowIdx < 0.55 ? 'Соломенно-жёлтая (начало окисления)' : 'Тёмно-янтарная (брак по цвету)',
      swatchLabelEn: yellowIdx < 0.2 ? 'Clear / water-white' : yellowIdx < 0.55 ? 'Pale straw (early oxidation)' : 'Deep amber (color failure)',
      progressRatio: clamp(dkg180 / 45, 0, 1),
      shieldingRatio: clamp((1 - oxygenPct / 100) * 0.5 + (ferulicSynergy / 100) * 0.5, 0, 1),
      collapseRatio: yellowIdx > 0.55 ? yellowIdx : 0,
      verdictRu:
        ph > 3.8
          ? `pH ${ph} близок или выше pKa₁ (4,1): преобладает легко окисляемый аскорбат-анион — сыворотка быстро темнеет.`
          : oxygenPct > 50
            ? 'Флакон с пипеткой постоянно подсасывает O₂: переведите продукт в airless-диспенсер или продувку азотом.'
            : 'Оптимальная защита (pH ≤ 3,5 + феруловая/витамин E + низкий O₂): сыворотка сохраняет прозрачность и > 85 % активной L-AA.',
      verdictEn:
        ph > 3.8
          ? `pH ${ph} approaches/exceeds pKa₁ (4.1): fast-oxidizing ascorbate anion dominates and browns the serum.`
          : oxygenPct > 50
            ? 'Dropper bottle repeatedly introduces O₂: switch to an opaque airless pump or nitrogen headspace purge.'
            : 'Optimal protection (pH ≤ 3.5 + ferulic/Vit E + low O₂): serum remains pale and retains > 85% active L-AA.',
      stepsRu: [
        '1. Кислород окисляет енедиольную группу L-AA (2e⁻, 2H⁺) → обратимая ДГК.',
        '2. ДГК необратимо гидролизуется с раскрытием лактонного кольца → 2,3-ДКГ.',
        '3. Дальнейшая дегидратация ДКГ рождает фурфурол и бурые полимерные пигменты.',
      ],
      stepsEn: [
        '1. Dissolved O₂ oxidizes the L-AA enediol group (2e⁻, 2H⁺) → reversible DHA.',
        '2. DHA irreversibly opens its lactone ring by hydrolysis → 2,3-DKG.',
        '3. DKG dehydrates into furfural and dark amber-brown chromophores.',
      ],
    }
  }

  // 6. micellar-schiff-interfacial
  const tempC = p('tempC')
  const ph = p('pH')
  const cmcRatio = p('cmcRatio')
  const aminePct = p('aminePct')

  const tMax = 90 // дней
  const arr = arrheniusFactor(54, tempC, 25)
  // Колоколообразный pH-профиль образования оснований Шиффа (максимум около pH 5.5–6.5)
  const phBell = 0.25 + 1.15 * Math.exp(-Math.pow((ph - 6.0) / 1.6, 2))
  // Псевдофазное распределение Березина: выше 1× ККМ альдегид уходит в гидрофобное ядро мицеллы
  const micellarExcess = Math.max(0, cmcRatio - 1)
  const shieldedFraction = micellarExcess / (micellarExcess + 0.75)
  const freeAldehydeFrac = 1 - shieldedFraction

  const kFwd = 0.016 * arr * phBell * aminePct * freeAldehydeFrac
  const kRev = 0.0045 * arr

  const { times, states } = solveOdeRK4(
    [100, 0],
    (_t, [ald, schiff]) => {
      const rate = kFwd * ald - kRev * schiff
      return [-rate, rate]
    },
    tMax,
    60,
  )

  const schiffEnd = r1(states[states.length - 1][1])
  const aldEnd = r1(states[states.length - 1][0])
  const shieldedPct = r1(shieldedFraction * 100)
  const colorIdx = clamp(schiffEnd / 55, 0, 1)

  return {
    times,
    tMax,
    yMax: 105,
    yUnitRu: '% альдегида',
    yUnitEn: '% of aldehyde',
    series: [
      { id: 'ald', labelRu: 'Исходный альдегид отдушки (%)', labelEn: 'Intact fragrance aldehyde (%)', color: '#0EA5E9', values: states.map((s) => r1(s[0])) },
      { id: 'schiff', labelRu: 'Основание Шиффа — потемнение (%)', labelEn: 'Schiff base — discoloration (%)', color: '#B45309', values: states.map((s) => r1(s[1])) },
    ],
    kpis: [
      { labelRu: 'Доля в ядре мицелл (экран)', labelEn: 'Micelle-shielded share', value: `${shieldedPct} %`, tone: shieldedPct >= 60 ? 'ok' : 'warn' },
      { labelRu: 'Выход основания Шиффа (90 дн.)', labelEn: 'Schiff base formed (90 d)', value: `${schiffEnd} %`, tone: schiffEnd < 12 ? 'ok' : schiffEnd < 28 ? 'warn' : 'bad' },
      { labelRu: 'Сохранность аромата', labelEn: 'Fragrance intact', value: `${aldEnd} %`, tone: aldEnd >= 85 ? 'ok' : 'warn' },
      { labelRu: 'Режим солюбилизатора', labelEn: 'Solubilizer regime', value: cmcRatio >= 1 ? `> ККМ (${cmcRatio}×)` : `< ККМ`, tone: cmcRatio >= 2 ? 'ok' : 'warn' },
    ],
    swatchHex: yellowingSwatch(colorIdx),
    swatchLabelRu: colorIdx < 0.2 ? 'Белый крем (стабильный цвет)' : colorIdx < 0.5 ? 'Кремово-бежевое пожелтение' : 'Коричневое потемнение (Шифф)',
    swatchLabelEn: colorIdx < 0.2 ? 'White cream (color stable)' : colorIdx < 0.5 ? 'Cream-beige tinting' : 'Brown discoloration (Schiff)',
    progressRatio: clamp(schiffEnd / 60, 0, 1),
    shieldingRatio: shieldedFraction,
    collapseRatio: colorIdx > 0.5 ? colorIdx : 0,
    verdictRu:
      cmcRatio < 1
        ? 'Ниже ККМ мицелл нет: свободный ванилин напрямую реагирует с аминами в водной фазе — крем желтеет и теряет исходный аромат.'
        : schiffEnd >= 25
          ? 'Высокая нагрузка аминов и нагрев перевешивают защиту: увеличьте солюбилизатор (> 4× ККМ) или замените отдушку на безванилиновую.'
          : `Выше ККМ (${cmcRatio}×) около ${shieldedPct} % альдегида спрятано в гидрофобном ядре мицелл — межфазное разделение реагентов резко тормозит потемнение.`,
    verdictEn:
      cmcRatio < 1
        ? 'Below CMC no micelles form: free vanillin condenses directly with aqueous amines — cream browns and loses top notes.'
        : schiffEnd >= 25
          ? 'High amine load and heat overwhelm shielding: raise solubilizer (> 4× CMC) or switch to a vanillin-free fragrance.'
          : `Above CMC (${cmcRatio}×), ~${shieldedPct}% of aldehyde partitions into hydrophobic micelle cores — compartmentalization sharply slows browning.`,
    stepsRu: [
      '1. Нуклеофильная атака амина R′—NH₂ по карбонильному углероду альдегида → карбиноламин.',
      '2. Отщепление H₂O (катализ при pH 5–7) даёт сопряжённый имин R—CH=N—R′ (хромофор).',
      '3. Ввод неионогенного ПАВ выше ККМ запирает альдегид в ядре мицелл и разводит реагенты по фазам.',
    ],
    stepsEn: [
      '1. Nucleophilic amine R′—NH₂ attacks aldehyde carbonyl → carbinolamine intermediate.',
      '2. Dehydration (catalyzed around pH 5–7) yields conjugated imine R—CH=N—R′ (chromophore).',
      '3. Nonionic surfactant above CMC sequesters aldehyde in micelle cores, separating reactants across pseudophases.',
    ],
  }
}
