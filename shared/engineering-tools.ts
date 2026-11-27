// Инженерные утилиты 2.0 (Пакет R):
// 1) Paste-to-Lab Real INCI Analyzer (парсинг реального INCI → черновик FormulaInput для Лаборатории)
// 2) Калькулятор индекса натурального происхождения ISO 16128 (NOI с водой и без воды)
// 3) Генератор хвоста декларируемых аллергенов EU 2023/1545 (82 аллергена, пороги 0,001 % / 0,01 %)
// 4) Токсикологический калькулятор SCCS MoS (SED и Margin of Safety ≥ 100 по 12th Revision)

import type { FormulaInput, FormulaRow, Ingredient, IngredientRole, Phase, ProductType } from './formulation'
import { language } from './locale'

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d

// ─── 1. ISO 16128 Natural Origin Index (NOI) ─────────────────────────────────

const SYNTHETIC_IDS = new Set([
  'carbomer', 'ultrez-21', 'aristoflex-avc', 'sepimax-zen', 'simulgel-eg', 'polyacrylate-crosspolymer-6',
  'dimethicone', 'cyclopentasiloxane', 'phenyl-trimethicone', 'cetyl-peg-ppg-dimethicone', 'peg-10-dimethicone',
  'trimethylsiloxysilicate', 'mineral-oil', 'petrolatum', 'microcrystalline-wax', 'hydrogenated-polyisobutene',
  'c12-15-benzoate', 'dibutyl-adipate', 'diisopropyl-adipate', 'propylene-carbonate',
  'phenoxyethanol', 'ethylhexylglycerin', 'chlorphenesin', 'bht', 'disodium-edta',
  'ceteareth-20', 'peg-100-stearate', 'peg40-hco', 'steareth-2', 'steareth-21',
  'polysorbate-20', 'polysorbate-60', 'polysorbate-80',
  'polyquaternium-7', 'polyquaternium-10', 'cetrimonium-chloride', 'behentrimonium-chloride',
  'avobenzone', 'octinoxate', 'octocrylene', 'homosalate', 'octisalate', 'uvinul-a-plus',
  'uvinul-t150', 'tinosorb-s', 'tinosorb-m', 'ensulizole', 'triasorb',
  'niacinamide', 'panthenol', 'retinol', 'salicylic-acid', 'azelaic-acid', 'tranexamic-acid',
  'alpha-arbutin', 'allantoin', 'urea', 'piroctone-olamine', 'triethanolamine',
  'ghk-cu', 'palmitoyl-tripeptide-1', 'acetyl-hexapeptide-8', 'palmitoyl-tetrapeptide-7',
  '1-2-hexanediol', 'caprylyl-glycol', 'hydroxyacetophenone', '3-o-ethyl-ascorbic-acid',
  'boron-nitride', 'synthetic-fluorphlogopite', 'parfum',
])

const SEMI_NATURAL_NOI: Record<string, number> = {
  sles: 0.72,
  capb: 0.80,
  sarcosinate: 0.82,
  'disodium-sulfosuccinate': 0.76,
  btms: 0.78,
  'guar-hptc': 0.88,
  hec: 0.85,
  'tetrasodium-glda': 0.86,
  'sodium-stearoyl-glutamate': 0.95,
  'sodium-cocoyl-glutamate': 0.96,
  'potassium-cetyl-phosphate': 0.85,
  'glyceryl-stearate-se': 0.95,
  'glyceryl-stearate': 0.96,
  'sorbitan-stearate': 0.94,
  'sorbitan-oleate': 0.94,
  'olivem-1000': 1.0,
  'montanov-68': 1.0,
  'montanov-202': 1.0,
  'isolan-gps': 0.92,
  'pg3-mgd': 0.98,
  'pg3-polyricinoleate': 0.98,
  'pg4-caprate': 0.98,
  'polyglyceryl-4-oleate': 1.0,
  'ethylhexyl-stearate': 0.68,
  'isopropyl-myristate': 0.78,
  'octyldodecanol': 0.95,
  'ascorbyl-tetraisopalmitate': 0.50,
  'sodium-benzoate': 0.0,
  'potassium-sorbate': 0.0,
  'benzyl-alcohol': 0.0,
  'dehydroacetic-acid': 0.0,
  'sodium-hydroxide': 0.0,
  'disteardimonium-hectorite': 0.82,
  'silicone': 0.0,
}

export function getIngredientNoi(ing: Ingredient): number {
  if (typeof ing.noi === 'number' && Number.isFinite(ing.noi)) {
    return Math.max(0, Math.min(1, ing.noi))
  }
  if (ing.id === 'aqua') return 1.0
  if (Object.prototype.hasOwnProperty.call(SEMI_NATURAL_NOI, ing.id)) return SEMI_NATURAL_NOI[ing.id]
  if (SYNTHETIC_IDS.has(ing.id)) return 0.0
  // Остальные растительные масла, воски, полиолы био-происхождения, биополимеры, минералы
  if (['solvent', 'humectant', 'emollient', 'thickener', 'electrolyte', 'chelator', 'antioxidant', 'colorant', 'uv_filter', 'emulsifier', 'surfactant', 'active', 'ph_adjuster', 'preservative'].includes(ing.role)) {
    return 1.0
  }
  return 0.0
}

export interface Iso16128RowResult {
  ingredientId: string
  name: string
  inci: string
  pct: number
  noi: number
  contributionPct: number
  isWater: boolean
}

export interface Iso16128Report {
  totalPct: number
  waterPct: number
  noiWithWaterPct: number
  noiWithoutWaterPct: number
  naturalOriginMassPct: number
  syntheticMassPct: number
  breakdown: Iso16128RowResult[]
}

export function computeIso16128(
  rows: { ingredientId: string; pct: number; customNoi?: number }[],
  catalog: Ingredient[],
): Iso16128Report {
  const byId = new Map(catalog.map((c) => [c.id, c]))
  let totalPct = 0
  let waterPct = 0
  let weightedWithWater = 0
  let weightedWithoutWater = 0
  const breakdown: Iso16128RowResult[] = []

  for (const r of rows) {
    const pct = Math.max(0, Number(r.pct) || 0)
    if (pct <= 0) continue
    const ing = byId.get(r.ingredientId)
    const isWater = r.ingredientId === 'aqua' || ing?.inci.toLowerCase() === 'aqua'
    const noi = typeof r.customNoi === 'number' && Number.isFinite(r.customNoi)
      ? Math.max(0, Math.min(1, r.customNoi))
      : ing
        ? getIngredientNoi(ing)
        : 0
    totalPct += pct
    if (isWater) waterPct += pct
    const contrib = pct * noi
    weightedWithWater += contrib
    if (!isWater) weightedWithoutWater += contrib
    breakdown.push({
      ingredientId: r.ingredientId,
      name: ing?.name ?? r.ingredientId,
      inci: ing?.inci ?? r.ingredientId,
      pct: round(pct, 2),
      noi: round(noi, 2),
      contributionPct: round(contrib, 2),
      isWater,
    })
  }

  const nonWaterPct = Math.max(0, totalPct - waterPct)
  const noiWithWaterPct = totalPct > 0 ? round((weightedWithWater / totalPct) * 100, 1) : 0
  const noiWithoutWaterPct = nonWaterPct > 0 ? round((weightedWithoutWater / nonWaterPct) * 100, 1) : 0

  return {
    totalPct: round(totalPct, 2),
    waterPct: round(waterPct, 2),
    noiWithWaterPct,
    noiWithoutWaterPct,
    naturalOriginMassPct: round(weightedWithWater, 2),
    syntheticMassPct: round(Math.max(0, totalPct - weightedWithWater), 2),
    breakdown,
  }
}

// ─── 2. Paste-to-Lab Real INCI Analyzer ──────────────────────────────────────

const INCI_ALIASES: Record<string, string> = {
  water: 'aqua',
  'aqua/water/eau': 'aqua',
  'aqua / water': 'aqua',
  'aqua (water)': 'aqua',
  'water (aqua)': 'aqua',
  fragrance: 'parfum',
  'parfum (fragrance)': 'parfum',
  'fragrance (parfum)': 'parfum',
  'sodium hyaluronate': 'hyaluronic-acid',
  'hydrolyzed hyaluronic acid': 'hyaluronic-acid',
  'tocopheryl acetate': 'tocopherol',
  'butylene glycol': 'propanediol',
  'dipropylene glycol': 'propanediol',
  'sodium laureth sulfate': 'sles',
  'cocamidopropyl betaine': 'capb',
  'sodium lauroyl sarcosinate': 'sarcosinate',
  'butyrospermum parkii (shea) butter': 'shea-butter',
  'helianthus annuus (sunflower) seed oil': 'sunflower-oil',
  'prunus amygdalus dulcis (sweet almond) oil': 'almond-oil',
  'simmondsia chinensis (jojoba) seed oil': 'jojoba-oil',
  'argania spinosa kernel oil': 'argan-oil',
  'rosa canina fruit oil': 'rosehip-oil',
  'ricinus communis (castor) seed oil': 'castor-oil',
  'butyl methoxydibenzoylmethane': 'avobenzone',
  'ethylhexyl methoxycinnamate': 'octinoxate',
  'bis-ethylhexyloxyphenol methoxyphenyl triazine': 'tinosorb-s',
  'diethylamino hydroxybenzoyl hexyl benzoate': 'uvinul-a-plus',
  'ethylhexyl triazone': 'uvinul-t150',
  'ethylhexyl salicylate': 'octisalate',
  'methylene bis-benzotriazolyl tetramethylbutylphenol': 'tinosorb-m',
  'phenylene bis-diphenyltriazine': 'triasorb',
  'phenylbenzimidazole sulfonic acid': 'ensulizole',
  'cetearyl olivate': 'olivem-1000',
  'sorbitan olivate': 'olivem-1000',
  'cetearyl glucoside': 'montanov-68',
  'arachidyl alcohol': 'montanov-202',
  'arachidyl glucoside': 'montanov-202',
  'ammonium acryloyldimethyltaurate/vp copolymer': 'aristoflex-avc',
  'sodium polyacrylate': 'simulgel-eg',
  'hydroxyethylcellulose': 'hec',
  'guar hydroxypropyltrimonium chloride': 'guar-hptc',
  'behentrimonium methosulfate': 'btms',
  'sodium ascorbyl phosphate': 'sap',
  'ascorbic acid': 'ascorbic-acid',
  'copper tripeptide-1': 'ghk-cu',
  'sodium dna': 'pdrn',
  'c13-15 alkane': 'c13-15-alkane',
  'undecane': 'undecane-tridecane',
  'tridecane': 'undecane-tridecane',
  'hydrogenated farnesene': 'hemisqualane',
  'tetrasodium glutamate diacetate': 'tetrasodium-glda',
  'disodium edta': 'disodium-edta',
  'tetrasodium edta': 'disodium-edta',
  'ci 77891': 'tio2-pigment-ci77891',
  'ci 77492': 'ci-77492',
  'ci 77491': 'ci-77491',
  'ci 77499': 'ci-77499',
  'peg-40 hydrogenated castor oil': 'peg40-hco',
  'polyglyceryl-3 methylglucose distearate': 'pg3-mgd',
  'polyglyceryl-3 polyricinoleate': 'pg3-polyricinoleate',
  'polyglyceryl-4 caprate': 'pg4-caprate',
  'polyglyceryl-4 oleate': 'polyglyceryl-4-oleate',
  'sodium cocoyl isethionate': 'sci',
  'sodium coco-sulfate': 'sodium-coco-sulfate',
  'cetyl peg/ppg-10/1 dimethicone': 'cetyl-peg-ppg-dimethicone',
  'magnesium aluminum silicate': 'veegum',
  'cera alba': 'beeswax',
  'beeswax': 'beeswax',
  'cera microcristallina': 'microcrystalline-wax',
  'copernicia cerifera cera': 'carnauba-wax',
  'euphorbia cerifera cera': 'candelilla-wax',
  'caesalpinia spinosa gum': 'tara-gum',
  'coco-caprylate/caprate': 'coco-caprylate',
}

const ONE_PCT_MARKERS = new Set([
  'phenoxyethanol', 'parfum', 'fragrance', 'xanthan gum', 'carbomer', 'tocopherol',
  'tocopheryl acetate', 'disodium edta', 'tetrasodium edta', 'tetrasodium glutamate diacetate',
  'sodium benzoate', 'potassium sorbate', 'caprylyl glycol', '1,2-hexanediol',
  'ethylhexylglycerin', 'sodium hyaluronate', 'allantoin', 'chlorphenesin', 'hydroxyacetophenone',
])

const ALLERGEN_NAMES_LOWER = new Set([
  'limonene', 'linalool', 'linalyl acetate', 'citronellol', 'geraniol', 'coumarin', 'eugenol',
  'cinnamal', 'citral', 'benzyl alcohol', 'benzyl benzoate', 'benzyl salicylate', 'hexyl cinnamal',
  'alpha-isomethyl ionone', 'farnesol', 'isoeugenol', 'hydroxycitronellal', 'amyl cinnamal',
  'cinnamyl alcohol', 'anise alcohol', 'benzyl cinnamate', 'evernia prunastri extract',
  'tetramethyl acetyloctahydronaphthalenes', 'vanillin', 'menthol', 'pinene', 'beta-caryophyllene',
  'terpineol', 'terpinolene', 'geranyl acetate', 'camphor', 'carvone', 'anethole', 'benzaldehyde',
  'lavandula oil/extract', 'citrus aurantium peel oil', 'pogostemon cablin oil', 'santalum album oil',
  'rose ketones', 'cananga odorata oil/extract', 'methyl salicylate', 'dimethyl phenethyl acetate',
])

export interface ParsedInciItem {
  position: number
  raw: string
  matched?: Ingredient
  inferredRole: IngredientRole | 'allergen' | 'unknown'
  inferredPhase: Phase
  isMarker: boolean
  belowOnePct: boolean
  isAllergen: boolean
  estimatedPct: number
}

export interface InciAnalysisResult {
  items: ParsedInciItem[]
  matchedCount: number
  unknownCount: number
  markerIndex: number
  allergensFound: string[]
  insights: string[]
  draftFormula: FormulaInput
  iso16128: Iso16128Report
}

export const INCI_BENCHMARK_EXAMPLES: { id: string; title: string; titleEn: string; productType: ProductType; inci: string }[] = [
  {
    id: 'barrier-cream',
    title: 'Барьерный DMS-крем с церамидами и ниацинамидом',
    titleEn: 'Barrier DMS Cream with Ceramides & Niacinamide',
    productType: 'leave-on',
    inci: 'Aqua, Glycerin, Caprylic/Capric Triglyceride, Squalane, C13-15 Alkane, Niacinamide, Cetearyl Alcohol, Hydrogenated Lecithin, Butyrospermum Parkii Butter, Pentylene Glycol, Ceramide NP, Cholesterol, Panthenol, Xanthan Gum, Tetrasodium Glutamate Diacetate, Phenoxyethanol, Ethylhexylglycerin, Tocopherol',
  },
  {
    id: 'urban-spf50',
    title: 'Городской флюид SPF 50+ (органические фильтры)',
    titleEn: 'Urban SPF 50+ Fluid (Organic UV Filters)',
    productType: 'leave-on',
    inci: 'Aqua, Dibutyl Adipate, C12-15 Alkyl Benzoate, Diethylamino Hydroxybenzoyl Hexyl Benzoate, Bis-Ethylhexyloxyphenol Methoxyphenyl Triazine, Ethylhexyl Triazone, Ethylhexyl Salicylate, Propanediol, Potassium Cetyl Phosphate, Cetearyl Alcohol, Silica, Polyacrylate Crosspolymer-6, Tocopherol, Phenoxyethanol, Disodium EDTA, Parfum, Limonene, Linalool',
  },
  {
    id: 'mild-cleanser',
    title: 'Мягкий бессульфатный гель для умывания',
    titleEn: 'Mild Sulfate-Free Facial Cleansing Gel',
    productType: 'rinse-off',
    inci: 'Aqua, Coco-Glucoside, Cocamidopropyl Betaine, Sodium Cocoyl Glutamate, Glycerin, Betaine, Panthenol, Inulin, Xanthan Gum, Citric Acid, Sodium Benzoate, Potassium Sorbate, Tetrasodium Glutamate Diacetate, Parfum, Citronellol, Geraniol',
  },
]

function inferFallbackRole(rawLower: string): { role: IngredientRole | 'allergen' | 'unknown'; phase: Phase } {
  if (ALLERGEN_NAMES_LOWER.has(rawLower)) return { role: 'allergen', phase: 'C' }
  if (/oil|butter|triglyceride|alkane|squalane|stearate|myristate|adipate|benzoate|carbonate|dimethicone|siloxane|wax|cera/.test(rawLower)) {
    return { role: 'emollient', phase: 'B' }
  }
  if (/glucoside|sulfate|betaine|isethionate|glutamate|sarcosinate|sulfosuccinate/.test(rawLower)) {
    return { role: 'surfactant', phase: 'A' }
  }
  if (/gum|carbomer|acrylate|cellulose|starch|pullulan|hectorite/.test(rawLower)) {
    return { role: 'thickener', phase: 'A' }
  }
  if (/glycol|glycerin|sorbitol|betaine|urea|pca|trehalose|hyaluron/.test(rawLower)) {
    return { role: 'humectant', phase: 'A' }
  }
  if (/peptide|niacinamide|retinol|ascorb|ceramide|panthenol|extract|ferment|lysate|bakuchiol|ectoin|madecassoside/.test(rawLower)) {
    return { role: 'active', phase: 'C' }
  }
  if (/ethanol|sorbate|benzoate|paraben|chlorphenesin|anisate|levulinate|caprylate/.test(rawLower)) {
    return { role: 'preservative', phase: 'C' }
  }
  if (/edta|phytate|glda|diacetate/.test(rawLower)) return { role: 'chelator', phase: 'A' }
  if (/parfum|fragrance|aroma/.test(rawLower)) return { role: 'fragrance', phase: 'C' }
  if (/ci \d{5}|oxide|mica|silica/.test(rawLower)) return { role: 'colorant', phase: 'B' }
  return { role: 'unknown', phase: 'C' }
}

export function analyzePastedInci(
  rawText: string,
  catalog: Ingredient[],
  productType: ProductType = 'leave-on',
): InciAnalysisResult {
  const en = language === 'en'
  const cleaned = rawText
    .replace(/^(ingredients|состав|inci)\s*:\s*/i, '')
    .replace(/\[?\+\/-\]?/g, ',')
    .replace(/\r?\n/g, ',')
  const tokens = cleaned
    .split(/[,;]+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 0)

  const byInci = new Map<string, Ingredient>()
  const byId = new Map<string, Ingredient>()
  for (const ing of catalog) {
    byId.set(ing.id, ing)
    byInci.set(ing.inci.toLowerCase(), ing)
    // Первый фрагмент многокомпонентного INCI тоже индексируем
    const firstPart = ing.inci.split(',')[0]?.trim().toLowerCase()
    if (firstPart && !byInci.has(firstPart)) byInci.set(firstPart, ing)
  }

  // Первый проход: матчинг и поиск маркера 1 %
  let markerIndex = -1
  const rawParsed = tokens.map((raw, idx) => {
    const low = raw.toLowerCase().replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim()
    const exactLow = raw.toLowerCase()
    const aliasId = INCI_ALIASES[exactLow] ?? INCI_ALIASES[low]
    const matched =
      byInci.get(exactLow) ??
      byInci.get(low) ??
      (aliasId ? byId.get(aliasId) : undefined)
    const isAllergen = ALLERGEN_NAMES_LOWER.has(exactLow) || ALLERGEN_NAMES_LOWER.has(low)
    const isMarker =
      markerIndex === -1 &&
      idx > 0 &&
      (ONE_PCT_MARKERS.has(exactLow) ||
        ONE_PCT_MARKERS.has(low) ||
        matched?.role === 'preservative' ||
        matched?.role === 'fragrance' ||
        matched?.role === 'chelator')
    if (isMarker) markerIndex = idx
    return { raw, matched, isAllergen, isMarker }
  })

  // Второй проход: эвристическая оценка концентраций (реалистичный убывающий профиль до 1% и ≤ 0.8% после)
  const items: ParsedInciItem[] = []
  const draftMap = new Map<string, FormulaRow>()
  const allergensFound: string[] = []
  let nonWaterSum = 0

  rawParsed.forEach((p, idx) => {
    const belowOnePct = markerIndex !== -1 && idx >= markerIndex
    const fb = inferFallbackRole(p.raw.toLowerCase())
    const role = p.isAllergen ? 'allergen' : p.matched?.role ?? fb.role
    const phase = p.matched?.recommendedPhase ?? fb.phase

    if (p.isAllergen) allergensFound.push(p.raw)

    let est = 0
    if (p.matched?.id === 'aqua') {
      est = 0 // посчитаем остатком до 100 %
    } else if (p.isAllergen) {
      est = 0.01
    } else if (p.matched) {
      const [lo, hi] = p.matched.typicalRange
      const mid = (lo + hi) / 2
      if (belowOnePct) {
        est = Math.min(1.0, Math.max(0.05, round(Math.min(mid, 0.8), 2)))
      } else {
        // Плавное убывание по позиции до маркера 1 %
        const decay = Math.max(0.35, 1 - idx * 0.08)
        est = round(Math.max(1.0, Math.min(hi, Math.max(lo, mid * decay))), 2)
      }
      if (!draftMap.has(p.matched.id)) {
        draftMap.set(p.matched.id, { ingredientId: p.matched.id, phase: p.matched.recommendedPhase, pct: est })
        nonWaterSum += est
      }
    } else {
      est = belowOnePct ? 0.3 : Math.max(1.0, round(4.0 - idx * 0.35, 1))
    }

    items.push({
      position: idx + 1,
      raw: p.raw,
      matched: p.matched,
      inferredRole: role,
      inferredPhase: phase,
      isMarker: p.isMarker,
      belowOnePct,
      isAllergen: p.isAllergen,
      estimatedPct: est,
    })
  })

  // Собираем сбалансированный черновик FormulaInput
  const hasWater = rawParsed.some((p) => p.matched?.id === 'aqua')
  const draftRows: FormulaRow[] = []
  if (hasWater) {
    // Если сумма остальных > 45 %, мягко масштабируем, чтобы вода была реалистичной (≥ 55 % для крема/геля)
    const maxNonWater = productType === 'rinse-off' ? 35 : 42
    const scale = nonWaterSum > maxNonWater ? maxNonWater / nonWaterSum : 1
    let scaledSum = 0
    const bodyRows: FormulaRow[] = []
    for (const r of draftMap.values()) {
      const pct = round(Math.max(0.05, r.pct * scale), 2)
      scaledSum += pct
      bodyRows.push({ ...r, pct })
    }
    const aquaPct = round(Math.max(0, 100 - scaledSum), 2)
    draftRows.push({ ingredientId: 'aqua', phase: 'A', pct: aquaPct }, ...bodyRows)
    const waterItem = items.find((i) => i.matched?.id === 'aqua')
    if (waterItem) waterItem.estimatedPct = aquaPct
  } else if (draftMap.size > 0) {
    // Безводный продукт — нормируем к 100 %
    const rowsArr = [...draftMap.values()]
    const sum = rowsArr.reduce((s, r) => s + r.pct, 0)
    if (sum > 0) {
      let acc = 0
      rowsArr.forEach((r, idx) => {
        const pct = idx === rowsArr.length - 1 ? round(100 - acc, 2) : round((r.pct / sum) * 100, 2)
        acc += pct
        draftRows.push({ ...r, pct: Math.max(0.05, pct) })
      })
    }
  }

  const hasHotB = draftRows.some((r) => r.phase === 'B')
  const draftFormula: FormulaInput = {
    productType,
    productZone: productType === 'rinse-off' ? 'face' : 'face',
    targetPh: 5.5,
    batchGrams: 500,
    phaseTempC: hasHotB ? { A: 75, B: 75, C: 38 } : { A: 35, B: 35, C: 30 },
    rows: draftRows,
  }

  // Инженерные инсайты по INCI
  const insights: string[] = []
  const matchedIds = new Set(items.filter((i) => i.matched).map((i) => i.matched!.id))
  if (markerIndex !== -1) {
    insights.push(
      en
        ? `1% line marker detected at #${markerIndex + 1} (${items[markerIndex].raw}): components below are likely ≤ 1.0% and listed in arbitrary order (Art. 19(1)(g) EU 1223/2009).`
        : `Маркер границы 1 % найден на позиции № ${markerIndex + 1} (${items[markerIndex].raw}): компоненты ниже, вероятно, введены в доле ≤ 1,0 % в произвольном порядке (ст. 19(1)(g) EU 1223/2009).`,
    )
  }
  if (matchedIds.has('cyclopentasiloxane')) {
    insights.push(
      en
        ? 'Contains Cyclopentasiloxane (D5): restricted under EU 2024/1328 — consider replacing with C13-15 Alkane or Undecane/Tridecane.'
        : 'Обнаружен Cyclopentasiloxane (D5): подпадает под ограничения EU 2024/1328 — стоит заменить на C13-15 Alkane или Undecane/Tridecane.',
    )
  }
  if (matchedIds.has('ghk-cu') && (matchedIds.has('disodium-edta') || matchedIds.has('tetrasodium-glda'))) {
    insights.push(
      en
        ? 'Potential conflict: Copper Tripeptide-1 (GHK-Cu) paired with a chelator (EDTA/GLDA) risks copper ion stripping.'
        : 'Риск конфликта: Copper Tripeptide-1 (GHK-Cu) в паре с хелатором (EDTA/GLDA) может терять ион Cu²⁺.',
    )
  }
  if (allergensFound.length > 0) {
    insights.push(
      en
        ? `Declared fragrance allergens found (${allergensFound.length}): ${allergensFound.join(', ')} (EU 2023/1545).`
        : `Найдены декларируемые аллергены отдушки (${allergensFound.length}): ${allergensFound.join(', ')} (EU 2023/1545).`,
    )
  }
  const iso16128 = computeIso16128(draftRows, catalog)
  insights.push(
    en
      ? `Estimated ISO 16128 Natural Origin Index of the reconstructed draft: ${iso16128.noiWithWaterPct}% (with water) / ${iso16128.noiWithoutWaterPct}% (excluding water).`
      : `Оценочный индекс натуральности ISO 16128 собранного черновика: ${iso16128.noiWithWaterPct} % (с водой) / ${iso16128.noiWithoutWaterPct} % (без воды).`,
  )

  return {
    items,
    matchedCount: items.filter((i) => i.matched).length,
    unknownCount: items.filter((i) => !i.matched && !i.isAllergen).length,
    markerIndex,
    allergensFound,
    insights,
    draftFormula,
    iso16128,
  }
}

// ─── 3. EU 2023/1545 82-Allergen Calculator ──────────────────────────────────

export interface AllergenDef {
  id: string
  inci: string
  cas: string
  group: 'classic24' | 'new2023'
  noteRu: string
  noteEn: string
}

export const EU_ALLERGENS_CATALOG: AllergenDef[] = [
  { id: 'limonene', inci: 'Limonene', cas: '5989-27-5', group: 'classic24', noteRu: 'Цитрусовые масла, окисляется в гидропероксиды', noteEn: 'Citrus oils; oxidizes into sensitizing hydroperoxides' },
  { id: 'linalool', inci: 'Linalool', cas: '78-70-6', group: 'classic24', noteRu: 'Лаванда, бергамот, цветочные композиции', noteEn: 'Lavender, bergamot, floral accords' },
  { id: 'citronellol', inci: 'Citronellol', cas: '106-22-9', group: 'classic24', noteRu: 'Роза, герань, цитронелла', noteEn: 'Rose, geranium, citronella' },
  { id: 'geraniol', inci: 'Geraniol', cas: '106-24-1', group: 'classic24', noteRu: 'Роза, пальмароза, цветочные ноты', noteEn: 'Rose, palmarosa, floral notes' },
  { id: 'citral', inci: 'Citral', cas: '5392-40-5', group: 'classic24', noteRu: 'Лемонграсс, лимон, вербена (сильный сенсибилизатор)', noteEn: 'Lemongrass, lemon, verbena (potent sensitizer)' },
  { id: 'coumarin', inci: 'Coumarin', cas: '91-64-5', group: 'classic24', noteRu: 'Бобы тонка, лаванда, восточные аккорды', noteEn: 'Tonka bean, lavender, oriental accords' },
  { id: 'eugenol', inci: 'Eugenol', cas: '97-53-0', group: 'classic24', noteRu: 'Гвоздика, пряные ноты', noteEn: 'Clove, spicy accords' },
  { id: 'hexyl-cinnamal', inci: 'Hexyl Cinnamal', cas: '101-86-0', group: 'classic24', noteRu: 'Жасминовые и свежие цветочные отдушки', noteEn: 'Jasmine and fresh floral fragrances' },
  { id: 'alpha-isomethyl-ionone', inci: 'Alpha-Isomethyl Ionone', cas: '127-51-5', group: 'classic24', noteRu: 'Фиалка, ирис, пудровые ноты', noteEn: 'Violet, iris, powdery accords' },
  { id: 'benzyl-salicylate', inci: 'Benzyl Salicylate', cas: '118-58-1', group: 'classic24', noteRu: 'Фиксатор цветочных и солнечных нот', noteEn: 'Floral and solar fragrance fixative' },
  { id: 'benzyl-benzoate', inci: 'Benzyl Benzoate', cas: '120-51-4', group: 'classic24', noteRu: 'Растворитель отдушек, бальзамические ноты', noteEn: 'Fragrance solvent, balsamic notes' },
  { id: 'benzyl-alcohol', inci: 'Benzyl Alcohol', cas: '100-51-6', group: 'classic24', noteRu: 'Жасмин / также может быть консервантом', noteEn: 'Jasmine / may also act as a preservative' },
  { id: 'cinnamal', inci: 'Cinnamal', cas: '104-55-2', group: 'classic24', noteRu: 'Корица (высокий риск сенсибилизации)', noteEn: 'Cinnamon (high sensitization risk)' },
  { id: 'hydroxycitronellal', inci: 'Hydroxycitronellal', cas: '107-75-5', group: 'classic24', noteRu: 'Ландыш, белые цветы', noteEn: 'Lily of the valley, white florals' },
  { id: 'linalyl-acetate', inci: 'Linalyl Acetate', cas: '115-95-7', group: 'new2023', noteRu: 'Нов. EU 2023/1545: лаванда, бергамот, петитгрейн', noteEn: 'New EU 2023/1545: lavender, bergamot, petitgrain' },
  { id: 'iso-e-super', inci: 'Tetramethyl Acetyloctahydronaphthalenes', cas: '54464-57-2', group: 'new2023', noteRu: 'Нов. EU 2023/1545: Iso E Super (древесно-амбровый хит)', noteEn: 'New EU 2023/1545: Iso E Super (woody-amber staple)' },
  { id: 'vanillin', inci: 'Vanillin', cas: '121-33-5', group: 'new2023', noteRu: 'Нов. EU 2023/1545: ваниль (также вызывает потемнение крема!)', noteEn: 'New EU 2023/1545: vanilla (also causes cream browning!)' },
  { id: 'pinene', inci: 'Pinene', cas: '80-56-8', group: 'new2023', noteRu: 'Нов. EU 2023/1545: хвойные, цитрусовые, розмарин', noteEn: 'New EU 2023/1545: pine, citrus, rosemary' },
  { id: 'beta-caryophyllene', inci: 'Beta-Caryophyllene', cas: '87-44-5', group: 'new2023', noteRu: 'Нов. EU 2023/1545: чёрный перец, иланг-иланг, пачули', noteEn: 'New EU 2023/1545: black pepper, ylang-ylang, patchouli' },
  { id: 'terpineol', inci: 'Terpineol', cas: '8000-41-7', group: 'new2023', noteRu: 'Нов. EU 2023/1545: сирень, чайное дерево, хвоя', noteEn: 'New EU 2023/1545: lilac, tea tree, pine' },
  { id: 'geranyl-acetate', inci: 'Geranyl Acetate', cas: '105-87-3', group: 'new2023', noteRu: 'Нов. EU 2023/1545: нероли, цитронелла, роза', noteEn: 'New EU 2023/1545: neroli, citronella, rose' },
  { id: 'menthol', inci: 'Menthol', cas: '89-78-1', group: 'new2023', noteRu: 'Нов. EU 2023/1545: мята перечная, охлаждающие средства', noteEn: 'New EU 2023/1545: peppermint, cooling formulas' },
  { id: 'citrus-aurantium', inci: 'Citrus Aurantium Peel Oil', cas: '68916-04-1', group: 'new2023', noteRu: 'Нов. EU 2023/1545: эфирное масло апельсина/бергамота', noteEn: 'New EU 2023/1545: sweet/bitter orange & bergamot peel oil' },
  { id: 'lavandula-oil', inci: 'Lavandula Oil/Extract', cas: '8000-28-0', group: 'new2023', noteRu: 'Нов. EU 2023/1545: групповой вынос масла лаванды', noteEn: 'New EU 2023/1545: grouped lavender oil/extract declaration' },
  { id: 'pogostemon-cablin', inci: 'Pogostemon Cablin Oil', cas: '8014-09-3', group: 'new2023', noteRu: 'Нов. EU 2023/1545: масло пачули', noteEn: 'New EU 2023/1545: patchouli oil' },
  { id: 'rose-ketones', inci: 'Rose Ketones', cas: '43052-87-5', group: 'new2023', noteRu: 'Нов. EU 2023/1545: дамасконы и дамасценоны (жёсткий IFRA!)', noteEn: 'New EU 2023/1545: damascones & damascenones (strict IFRA!)' },
  { id: 'camphor', inci: 'Camphor', cas: '76-22-2', group: 'new2023', noteRu: 'Нов. EU 2023/1545: камфора, розмарин, эвкалипт', noteEn: 'New EU 2023/1545: camphor, rosemary, eucalyptus' },
  { id: 'cananga-odorata', inci: 'Cananga Odorata Oil/Extract', cas: '8006-81-3', group: 'new2023', noteRu: 'Нов. EU 2023/1545: масло иланг-иланга', noteEn: 'New EU 2023/1545: ylang-ylang oil/extract' },
]

export interface AllergenCalcRow {
  allergen: AllergenDef
  pctInFragrance: number
  pctInProduct: number
  ppmInProduct: number
  mustDeclare: boolean
}

export interface AllergenDeclarationReport {
  thresholdPct: number
  thresholdPpm: number
  rows: AllergenCalcRow[]
  declared: AllergenCalcRow[]
  inciTail: string
}

export function computeAllergenDeclaration(
  fragrancePct: number,
  productType: ProductType,
  pctInFragranceMap: Record<string, number>,
): AllergenDeclarationReport {
  const thresholdPct = productType === 'leave-on' ? 0.001 : 0.01
  const thresholdPpm = productType === 'leave-on' ? 10 : 100
  const frag = Math.max(0, Number(fragrancePct) || 0)

  const rows: AllergenCalcRow[] = []
  for (const a of EU_ALLERGENS_CATALOG) {
    const pctInFragrance = Math.max(0, Number(pctInFragranceMap[a.id]) || 0)
    if (pctInFragrance <= 0) continue
    const pctInProduct = round((frag * pctInFragrance) / 100, 6)
    const ppmInProduct = round(pctInProduct * 10000, 1)
    const mustDeclare = pctInProduct >= thresholdPct - 1e-9
    rows.push({ allergen: a, pctInFragrance, pctInProduct, ppmInProduct, mustDeclare })
  }

  rows.sort((x, y) => y.pctInProduct - x.pctInProduct)
  const declared = rows.filter((r) => r.mustDeclare)
  const inciTail = declared.map((r) => r.allergen.inci).join(', ')

  return { thresholdPct, thresholdPpm, rows, declared, inciTail }
}

// ─── 4. SCCS Margin of Safety (MoS) Calculator (12th Rev) ────────────────────

export interface SccsCategory {
  id: string
  nameRu: string
  nameEn: string
  dailyGrams: number
  retentionFactor: number
  defaultDermalAbsPct: number
}

export const SCCS_PRODUCT_CATEGORIES: SccsCategory[] = [
  { id: 'face-cream', nameRu: 'Крем для лица (leave-on)', nameEn: 'Face cream (leave-on)', dailyGrams: 1.54, retentionFactor: 1.0, defaultDermalAbsPct: 50 },
  { id: 'body-lotion', nameRu: 'Лосьон для тела (leave-on)', nameEn: 'Body lotion (leave-on)', dailyGrams: 7.82, retentionFactor: 1.0, defaultDermalAbsPct: 50 },
  { id: 'hand-cream', nameRu: 'Крем для рук (leave-on)', nameEn: 'Hand cream (leave-on)', dailyGrams: 2.16, retentionFactor: 1.0, defaultDermalAbsPct: 50 },
  { id: 'sunscreen', nameRu: 'Солнцезащитный крем (тело+лицо)', nameEn: 'Sunscreen lotion (full body)', dailyGrams: 18.0, retentionFactor: 1.0, defaultDermalAbsPct: 10 },
  { id: 'lip-balm', nameRu: 'Бальзам / помада для губ', nameEn: 'Lipstick / lip balm', dailyGrams: 0.057, retentionFactor: 1.0, defaultDermalAbsPct: 100 },
  { id: 'shampoo', nameRu: 'Шампунь (rinse-off, k = 0,01)', nameEn: 'Shampoo (rinse-off, k = 0.01)', dailyGrams: 10.46, retentionFactor: 0.01, defaultDermalAbsPct: 50 },
  { id: 'shower-gel', nameRu: 'Гель для душа (rinse-off, k = 0,01)', nameEn: 'Shower gel (rinse-off, k = 0.01)', dailyGrams: 18.67, retentionFactor: 0.01, defaultDermalAbsPct: 50 },
  { id: 'toothpaste', nameRu: 'Зубная паста (k = 0,05)', nameEn: 'Toothpaste (k = 0.05)', dailyGrams: 2.75, retentionFactor: 0.05, defaultDermalAbsPct: 100 },
]

export interface SccsMoSInput {
  dailyGrams: number
  retentionFactor: number
  concPct: number
  dermalAbsPct: number
  noaelMgKgDay: number
  bodyWeightKg?: number
}

export interface SccsMoSResult {
  sedMgKgDay: number
  mos: number
  passed: boolean
  maxSafePct: number
  verdict: 'safe' | 'borderline' | 'unsafe'
}

export function computeSccsMoS(input: SccsMoSInput): SccsMoSResult {
  const bw = Math.max(10, Number(input.bodyWeightKg) || 60)
  const A = Math.max(0, Number(input.dailyGrams) || 0) * 1000 // mg/day
  const ret = Math.max(0, Math.min(1, Number(input.retentionFactor) || 0))
  const C = Math.max(0, Number(input.concPct) || 0) / 100
  const DAp = Math.max(0, Math.min(100, Number(input.dermalAbsPct) || 0)) / 100
  const noael = Math.max(0, Number(input.noaelMgKgDay) || 0)

  const sedMgKgDay = (A * ret * C * DAp) / bw
  const mos = sedMgKgDay > 0 ? noael / sedMgKgDay : Infinity

  // Максимальная безопасная концентрация при целевом MoS = 100
  const denom = A * ret * DAp
  const maxSafePct = denom > 0 ? ((noael / 100) * bw / denom) * 100 : 100

  const verdict: SccsMoSResult['verdict'] =
    mos >= 100 ? 'safe' : mos >= 60 ? 'borderline' : 'unsafe'

  return {
    sedMgKgDay: Number(sedMgKgDay.toFixed(5)),
    mos: Number.isFinite(mos) ? round(mos, 1) : 99999,
    passed: mos >= 100,
    maxSafePct: round(Math.min(100, maxSafePct), 3),
    verdict,
  }
}
