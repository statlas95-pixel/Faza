// Детерминированный движок сквозных 5-этапных кампаний запуска продукта (Направление H):
// «От R&D-брифа до промышленной серии 500–1000 кг и разбора рекламации».
// Связывает Этап 2 с живой Лабораторией рецептур (evaluateFormula + analyzeSpfAndPigments)
// и переносит последствия решений и параметров рецептуры в Этапы 3–5.

import { evaluateFormula, type FormulaInput, type Ingredient } from './formulation'
import { analyzeSpfAndPigments } from './formulation-lab5'
import { language } from './locale'
import type { CampaignProgressRecord } from './merge'

export type CampaignId = 'spf50-city-fluid' | 'retinol-03-serum'

export interface CampaignChoiceOption {
  id: string
  labelRu: string
  labelEn: string
  detailRu: string
  detailEn: string
  scoreDelta: number // 0..20
  costImpactRubPerKg: number
  riskTag?: string
  feedbackRu: string
  feedbackEn: string
}

export interface CampaignStageDef {
  index: number // 0..4 (Этап 1..5)
  code: string
  titleRu: string
  titleEn: string
  roleRu: string
  roleEn: string
  kind: 'decision' | 'lab-formula'
  promptRu: string
  promptEn: string
  options?: CampaignChoiceOption[]
}

export interface CampaignDefinition {
  id: CampaignId
  badgeRu: string
  badgeEn: string
  titleRu: string
  titleEn: string
  subtitleRu: string
  subtitleEn: string
  batchScaleKg: number
  targetCostRubPerKg: number
  starterFormula: FormulaInput
  referenceGoodFormula: FormulaInput
  stages: CampaignStageDef[]
}

export interface CampaignLabCheckResult {
  score: number // 0..20
  passed: boolean
  costPerKg: number
  errors: number
  spf?: number
  uvaRatio?: number
  checks: { id: string; labelRu: string; labelEn: string; passed: boolean }[]
  notes: string[]
}

export interface CampaignLaunchReport {
  totalScore: number // 0..100
  gradeRu: string
  gradeEn: string
  estimatedCostPerKg: number
  defectRiskPct: number
  carriedConsequencesRu: string[]
  carriedConsequencesEn: string[]
}

export const CAMPAIGNS: CampaignDefinition[] = [
  {
    id: 'spf50-city-fluid',
    badgeRu: 'Кампания 1 · Солнцезащита · 500 кг',
    badgeEn: 'Campaign 1 · Sun Care · 500 kg',
    titleRu: 'SPF 50+ Флюид для города',
    titleEn: 'SPF 50+ Urban Fluid Launch',
    subtitleRu: 'Пройдите путь от маркетингового брифа и реальной сборки рецептуры в Лаборатории до стресс-теста ISO/TR 18811, ЧП в реакторе 500 кг и разбора рекламации с рынка.',
    subtitleEn: 'Take a product from marketing brief and live Formulation Lab bench work through ISO/TR 18811 stability/packaging, a 500 kg pilot reactor emergency, and a post-market complaint.',
    batchScaleKg: 500,
    targetCostRubPerKg: 3400,
    // Стартовый шаблон с реалистичными недоработками (нехватка полярных эфиров, перегрев фазы C, недобор SPF)
    starterFormula: {
      productType: 'leave-on',
      targetPh: 5.8,
      batchGrams: 500,
      phaseTempC: { A: 75, B: 75, C: 44 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 61.9 },
        { ingredientId: 'glycerin', phase: 'A', pct: 3.0 },
        { ingredientId: 'xanthan-gum', phase: 'A', pct: 0.3 },
        { ingredientId: 'disodium-edta', phase: 'A', pct: 0.1 },
        { ingredientId: 'c12-15-benzoate', phase: 'B', pct: 8.0 },
        { ingredientId: 'caprylic-triglyceride', phase: 'B', pct: 4.0 },
        { ingredientId: 'uvinul-a-plus', phase: 'B', pct: 4.5 },
        { ingredientId: 'tinosorb-s', phase: 'B', pct: 3.5 },
        { ingredientId: 'uvinul-t150', phase: 'B', pct: 3.5 },
        { ingredientId: 'montanov-202', phase: 'B', pct: 4.0 },
        { ingredientId: 'cetearyl-alcohol', phase: 'B', pct: 1.5 },
        { ingredientId: 'niacinamide', phase: 'C', pct: 2.0 },
        { ingredientId: 'panthenol', phase: 'C', pct: 1.0 },
        { ingredientId: 'tocopherol', phase: 'C', pct: 0.2 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
        { ingredientId: 'ethylhexylglycerin', phase: 'C', pct: 0.2 },
      ],
    },
    referenceGoodFormula: {
      productType: 'leave-on',
      targetPh: 5.8,
      batchGrams: 500,
      phaseTempC: { A: 75, B: 75, C: 36 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 49.7 },
        { ingredientId: 'glycerin', phase: 'A', pct: 3.0 },
        { ingredientId: 'xanthan-gum', phase: 'A', pct: 0.3 },
        { ingredientId: 'disodium-edta', phase: 'A', pct: 0.1 },
        { ingredientId: 'c12-15-benzoate', phase: 'B', pct: 11.0 },
        { ingredientId: 'dicaprylyl-carbonate', phase: 'B', pct: 10.0 },
        { ingredientId: 'uvinul-a-plus', phase: 'B', pct: 5.0 },
        { ingredientId: 'tinosorb-s', phase: 'B', pct: 4.0 },
        { ingredientId: 'uvinul-t150', phase: 'B', pct: 4.5 },
        { ingredientId: 'montanov-202', phase: 'B', pct: 3.5 },
        { ingredientId: 'peg-100-stearate', phase: 'B', pct: 1.2 },
        { ingredientId: 'cetearyl-alcohol', phase: 'B', pct: 1.5 },
        { ingredientId: 'tinosorb-m', phase: 'C', pct: 3.0 },
        { ingredientId: 'niacinamide', phase: 'C', pct: 1.5 },
        { ingredientId: 'panthenol', phase: 'C', pct: 0.5 },
        { ingredientId: 'tocopherol', phase: 'C', pct: 0.2 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
        { ingredientId: 'ethylhexylglycerin', phase: 'C', pct: 0.2 },
      ],
    },
    stages: [
      {
        index: 0,
        code: 'stage-1-brief',
        titleRu: 'Этап 1 · R&D-бриф и стратегия УФ-фильтров',
        titleEn: 'Stage 1 · R&D Brief & UV Filter Strategy',
        roleRu: 'R&D-менеджер',
        roleEn: 'R&D Lead',
        kind: 'decision',
        promptRu: 'Маркетинг требует невесомый городской флюид SPF 50+ со знаком «UVA в кружке» (UVA-PF ≥ 1/3 SPF, λc ≥ 370 нм), без белого налёта и себестоимостью сырья ≤ 2 400 ₽/кг. Какую УФ-архитектуру закладываете в ТЗ?',
        promptEn: 'Marketing requests a weightless urban SPF 50+ fluid with the EU UVA circle (UVA-PF ≥ 1/3 SPF, λc ≥ 370 nm), zero white cast, and raw material cost ≤ 2,400 RUB/kg. Which UV architecture do you lock into the brief?',
        options: [
          {
            id: 'modern-photostable',
            labelRu: 'Фотостабильная матрица: Uvinul A Plus + Tinosorb S + Uvinul T150 + полярные эфиры',
            labelEn: 'Photostable matrix: Uvinul A Plus + Tinosorb S + Uvinul T150 + polar esters',
            detailRu: 'Высокая фотостабильность, широкий спектр λc > 375 нм, но требует ≥ 18 % полярных эмолентов против кристаллизации.',
            detailEn: 'High photostability and broad spectrum λc > 375 nm, but requires ≥ 18% polar esters against crystallization.',
            scoreDelta: 20,
            costImpactRubPerKg: 0,
            feedbackRu: 'Верное решение: современная триада фильтров перекрывает 290–390 нм без фотодеградации и белого налёта. Главное на Этапе 2 — обеспечить запас полярных растворителей.',
            feedbackEn: 'Solid architecture: this modern filter triad covers 290–390 nm without photodegradation or white cast. Make sure Stage 2 supplies enough polar ester solvency.',
          },
          {
            id: 'avobenzone-octinoxate',
            labelRu: 'Бюджетная классика: Avobenzone + Octinoxate в лёгком силиконе',
            labelEn: 'Low-cost classic: Avobenzone + Octinoxate in light silicone',
            detailRu: 'Дешевле на 350 ₽/кг, но риск фотохимической несовместимости [2+2] на солнце.',
            detailEn: '350 RUB/kg cheaper, but prone to [2+2] photochemical degradation under sunlight.',
            scoreDelta: 7,
            costImpactRubPerKg: -350,
            riskTag: 'photodeg',
            feedbackRu: 'Опасный компромисс: Octinoxate разрушает Avobenzone на свету, роняя UVA-PF на 35–40 %. Это осложнит фотостабильность на Этапе 3 и вызовет рекламацию на Этапе 5.',
            feedbackEn: 'Risky shortcut: Octinoxate photodegrades Avobenzone, slashing UVA-PF by 35–40%. Expect stability setbacks in Stage 3 and market complaints in Stage 5.',
          },
          {
            id: 'mineral-20-bare',
            labelRu: '100 % минеральный ZnO 20 % без полимерного диспергатора',
            labelEn: '100% mineral ZnO 20% without polymeric dispersant',
            detailRu: 'Заявка «100 % mineral», но высокая маслоёмкость, белёсость и вязкость.',
            detailEn: 'Supports a "100% mineral" claim, but brings high oil absorption, white cast, and heavy viscosity.',
            scoreDelta: 9,
            costImpactRubPerKg: 180,
            riskTag: 'agglomeration',
            feedbackRu: 'Слишком вязкий и выбеливающий вариант для «невесомого городского флюида»: без диспергатора появятся агломераты пигмента и загущение в реакторе 500 кг.',
            feedbackEn: 'Too heavy and chalky for a weightless urban fluid: without a dispersant, pigment agglomerates and high viscosity will hit the 500 kg pilot batch.',
          },
        ],
      },
      {
        index: 1,
        code: 'stage-2-lab',
        titleRu: 'Этап 2 · Сборка рецептуры в Лаборатории',
        titleEn: 'Stage 2 · Bench Formulation in Live Lab',
        roleRu: 'Химик-разработчик',
        roleEn: 'Formulation Chemist',
        kind: 'lab-formula',
        promptRu: 'Соберите (или доработайте стартовый шаблон) рецептуру SPF 50+ флюида в Лаборатории: доведите баланс до 100 %, уберите перегрев фазы C, обеспечьте растворимость твёрдых УФ-фильтров полярными эфирами и подтвердите in-silico SPF ≥ 45 и UVA-PF/SPF ≥ 0,33.',
        promptEn: 'Build (or refine the starter template for) the SPF 50+ fluid in the Formulation Lab: reach 100% balance, eliminate Phase C overheating, provide polar ester solvency for solid UV filters, and achieve in-silico SPF ≥ 45 with UVA-PF/SPF ≥ 0.33.',
      },
      {
        index: 2,
        code: 'stage-3-pack',
        titleRu: 'Этап 3 · Ускоренное старение и упаковка (ISO/TR 18811)',
        titleEn: 'Stage 3 · Accelerated Stability & Packaging (ISO/TR 18811)',
        roleRu: 'Технолог по стабильности',
        roleEn: 'Stability Engineer',
        kind: 'decision',
        promptRu: 'Рецептура прошла 30 дней при +4 °C / +45 °C и фототест. Какую первичную упаковку и протокол контроля утверждаете для передачи в производство?',
        promptEn: 'Your formula goes through 30-day +4 °C / +45 °C aging and photostability screening. Which primary packaging and qualification protocol do you sign off?',
        options: [
          {
            id: 'opaque-airless-evoh',
            labelRu: 'Непрозрачный airless PP/EVOH + 3-месячный тест совместимости ISO/TR 18811 (вес, помпа, +4 °C поляризация)',
            labelEn: 'Opaque PP/EVOH airless + 3-month ISO/TR 18811 compatibility (weight loss, pump force, +4 °C polarized check)',
            detailRu: 'Защищает от света/кислорода, исключает втягивание стенок (paneling) и проверяет отсутствие кристаллов УФ.',
            detailEn: 'Blocks light and oxygen, prevents paneling, and screens for cold UV recrystallization.',
            scoreDelta: 20,
            costImpactRubPerKg: 140,
            feedbackRu: 'Эталонный выбор: барьер PP/EVOH не сорбирует полярные эфиры и УФ-фильтры, а контроль при +4 °C под поляризатором вовремя отсекает кристаллизацию.',
            feedbackEn: 'Gold-standard sign-off: PP/EVOH resists polar ester sorption, and +4 °C polarized microscopy catches early UV filter crystallization.',
          },
          {
            id: 'clear-pet-pump',
            labelRu: 'Прозрачный PET-флакон с открытой помпой (чтобы видна была текстура флюида)',
            labelEn: 'Clear PET bottle with dip-tube pump (to showcase fluid aesthetics)',
            detailRu: 'Экономия на таре, но прямой УФ-свет через стенки и контакт с воздухом.',
            detailEn: 'Lower pack cost, but exposes formula to direct UV light and air headspace.',
            scoreDelta: 8,
            costImpactRubPerKg: -60,
            riskTag: 'light-pack',
            feedbackRu: 'Риск фотодеградации на полке магазина и подсыхания флюида в носике дозатора — на Этапе 5 могут прийти жалобы на пожелтение и забивание помпы.',
            feedbackEn: 'High retail shelf photodegradation risk and nozzle crusting — likely to trigger yellowing or clogged-pump complaints in Stage 5.',
          },
          {
            id: 'thin-ldpe-tube',
            labelRu: 'Тонкостенная LDPE-туба без барьерного слоя',
            labelEn: 'Thin-wall monolayer LDPE tube without barrier layer',
            detailRu: 'Самая дешёвая туба, но высокая проницаемость для эфиров и отдушки.',
            detailEn: 'Lowest unit cost, but high permeation to esters and fragrance.',
            scoreDelta: 6,
            costImpactRubPerKg: -90,
            riskTag: 'paneling',
            feedbackRu: 'Полярные эмоленты и УФ-фильтры диффундируют в LDPE: туба втягивается (paneling), становится липкой снаружи, а концентрация фильтров падает.',
            feedbackEn: 'Polar esters and UV filters migrate into LDPE: the tube panels inward, turns greasy outside, and loses effective SPF.',
          },
        ],
      },
      {
        index: 3,
        code: 'stage-4-pilot',
        titleRu: 'Этап 4 · Пилотная варка 500 кг (ЧП в цехе)',
        titleEn: 'Stage 4 · 500 kg Pilot Batch (Plant Emergency)',
        roleRu: 'Начальник смены',
        roleEn: 'Production Lead',
        kind: 'decision',
        promptRu: 'ЧП на пилотной варке 500 кг! Из-за сниженного отношения площади рубашки к объёму охлаждение с 75 °C до 35 °C растянулось до 110 минут, эмульсия густеет на стенках, а оператор предлагает «погонять ротор-статор на 3000 об/мин до самого конца». Ваши действия?',
        promptEn: '500 kg pilot emergency! Lower jacket surface-to-volume ratio stretched cooling (75 → 35 °C) to 110 min, product builds on the wall, and the operator suggests running the rotor-stator at 3,000 rpm all the way down. Your call?',
        options: [
          {
            id: 'vacuum-scraper-phe',
            labelRu: 'Отключить ротор ниже 55 °C, оставить скребки 25 об/мин + вакуум −0,8 бар + контур проточного теплообменника',
            labelEn: 'Stop rotor-stator below 55 °C, keep wall scrapers at 25 rpm + −0.8 bar vacuum + external heat exchanger loop',
            detailRu: 'Сберегает ламеллярную сеть LGN, убирает воздух и сокращает время охлаждения вдвое.',
            detailEn: 'Preserves LGN lamellar structure, removes trapped air, and halves cooling time.',
            scoreDelta: 20,
            costImpactRubPerKg: 35,
            feedbackRu: 'Грамотное масштабирование! Отключение высокого сдвига в зоне кристаллизации жирных спиртов спасает сеть LGN и предотвращает аэрацию, а вакуум и скребки выравнивают температуру.',
            feedbackEn: 'Textbook scale-up! Cutting high shear in the fatty-alcohol crystallization zone preserves LGN structure and avoids air entrapment while scrapers + vacuum keep cooling uniform.',
          },
          {
            id: 'keep-rotor-3000',
            labelRu: 'Оставить ротор-статор на 3000 об/мин до 30 °C, чтобы «разбить загущение»',
            labelEn: 'Keep rotor-stator at 3,000 rpm down to 30 °C to "break thickening"',
            detailRu: 'Кажется быстрее, но вводит избыточную энергию диссипации и разрушает формирующуюся LGN.',
            detailEn: 'Seems faster, but injects heat dissipation and shears apart the forming LGN bilayers.',
            scoreDelta: 6,
            costImpactRubPerKg: 90,
            riskTag: 'shear-damage',
            feedbackRu: 'Ошибка: ротор-статор при < 45 °C перемалывает ламеллярные бислои и засасывает микропузырьки — партия потеряла 40 % вязкости через 48 ч и дала усадку во флаконе.',
            feedbackEn: 'Costly mistake: shearing below 45 °C shreds LGN bilayers and entrains micro-bubbles — viscosity dropped 40% after 48 h and bottles under-filled.',
          },
          {
            id: 'dilute-water-5',
            labelRu: 'Долить 5 % холодной воды сверх рецептуры, чтобы ускорить охлаждение и снизить вязкость',
            labelEn: 'Top up with 5% extra cold water to speed up cooling and thin the batch',
            detailRu: 'Быстро охлаждает реактор, но нарушает материальный баланс и долю УФ-фильтров.',
            detailEn: 'Cools rapidly, but breaks mass balance and dilutes UV filters & preservatives.',
            scoreDelta: 3,
            costImpactRubPerKg: 260,
            riskTag: 'gmp-violation',
            feedbackRu: 'Критическое нарушение ISO 22716 (GMP): несанкционированное разбавление снизило SPF ниже заявленного 50+ и вывело консервант за валидированный уровень — брак партии.',
            feedbackEn: 'Critical ISO 22716 (GMP) deviation: unauthorized dilution pushed SPF below 50+ and undermined validated preservation — batch rejected.',
          },
        ],
      },
      {
        index: 4,
        code: 'stage-5-market',
        titleRu: 'Этап 5 · Досье безопасности (PIF) и рекламация с рынка',
        titleEn: 'Stage 5 · Safety Dossier (PIF) & Market Complaint CAPA',
        roleRu: 'Директор по качеству (QA)',
        roleEn: 'Quality & Regulatory Lead',
        kind: 'decision',
        promptRu: 'Через 3 месяца после запуска поступила рекламация из зимнего региона: «флюид ощущается чуть зернистым при нанесении после хранения в холодном пункте выдачи». Какой протокол CAPA и финального досье утверждаете?',
        promptEn: '3 months post-launch, a cold-climate customer reports slight grittiness after courier storage near 0 °C. Which CAPA root-cause investigation and PIF verification do you authorize?',
        options: [
          {
            id: 'capa-polarized-freeze',
            labelRu: 'Проверить арбитражный образец в поляризационном микроскопе (90°) + цикл −10/+25 °C; увеличить запас полярных эфиров и зафиксировать in vivo ISO 24444 / in vitro ISO 24443 в PIF',
            labelEn: 'Inspect retain sample under 90° polarized microscope + −10/+25 °C freeze-thaw; increase polar ester margin and lock ISO 24444 / ISO 24443 data into PIF',
            detailRu: 'Находит первопричину (кристаллизация твёрдых УФ при переохлаждении) и закрывает регуляторные требования.',
            detailEn: 'Pinpoints root cause (cold UV filter recrystallization) and secures regulatory compliance.',
            scoreDelta: 20,
            costImpactRubPerKg: 45,
            feedbackRu: 'Блестящий CAPA-разбор: поляризационная микроскопия мгновенно отличает кристаллы УФ от пузырьков воздуха, запас полярных эфиров устраняет рецидив, а PIF полностью готов к инспекции.',
            feedbackEn: 'Exemplary CAPA: polarized microscopy immediately confirms UV filter needles, added polar ester solvency prevents recurrence, and the PIF is audit-ready.',
          },
          {
            id: 'blame-delivery',
            labelRu: 'Отписать клиенту «нарушение условий хранения при доставке», рецептуру и PIF не менять',
            labelEn: 'Reply "courier storage violation" and close the ticket without touching formula or PIF',
            detailRu: 'Нулевые затраты сегодня, но повторные возвраты следующей зимой.',
            detailEn: 'Zero immediate spend, but guaranteed repeat returns next winter.',
            scoreDelta: 7,
            costImpactRubPerKg: 120,
            feedbackRu: 'Косметический продукт обязан выдерживать реальную зимнюю логистику (freeze-thaw): игнорирование кристаллизации роняет рейтинг SKU и ведёт к отзыву партии.',
            feedbackEn: 'Commercial sunscreens must survive realistic winter freeze-thaw logistics: ignoring crystallization drives high returns and brand damage.',
          },
          {
            id: 'cut-uv-filters',
            labelRu: 'Просто убрать половину твёрдых УФ-фильтров, сохранив на этикетке надпись «SPF 50+»',
            labelEn: 'Cut solid UV filters in half while keeping the "SPF 50+" claim on the carton',
            detailRu: 'Убирает зернистость, но обрушивает фактический SPF вдвое.',
            detailEn: 'Eliminates grittiness, but cuts real SPF nearly in half.',
            scoreDelta: 2,
            costImpactRubPerKg: 400,
            feedbackRu: 'Недопустимо: несоответствие заявленного SPF фактическому нарушает EU 1223/2009, ТР ТС 009/2011 и создаёт прямой риск ожога потребителей.',
            feedbackEn: 'Unacceptable: mislabeling SPF violates EU 1223/2009 and TR CU 009/2011 and creates a direct consumer sunburn hazard.',
          },
        ],
      },
    ],
  },
  {
    id: 'retinol-03-serum',
    badgeRu: 'Кампания 2 · Активы EU 2024/996 · 1 000 кг',
    badgeEn: 'Campaign 2 · EU 2024/996 Actives · 1,000 kg',
    titleRu: 'Ночная сыворотка 0,3 % Retinol',
    titleEn: '0.3% Retinol Night Serum Launch',
    subtitleRu: 'Регуляторный бриф EU 2024/996, сборка стабильной сыворотки в Лаборатории, валидация ISO 11930 + airless, вакуумная серия 1 000 кг и расследование пожелтения.',
    subtitleEn: 'EU 2024/996 regulatory brief, live Formulation Lab bench design, ISO 11930 + airless barrier, 1,000 kg vacuum batching emergency, and color-drift root cause.',
    batchScaleKg: 1000,
    targetCostRubPerKg: 2100,
    // Стартовый шаблон с перегретой фазой C (42 °C) и отсутствием хелатора EDTA
    starterFormula: {
      productType: 'leave-on',
      targetPh: 5.8,
      batchGrams: 500,
      phaseTempC: { A: 75, B: 75, C: 42 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 76.2 },
        { ingredientId: 'glycerin', phase: 'A', pct: 4.0 },
        { ingredientId: 'xanthan-gum', phase: 'A', pct: 0.3 },
        { ingredientId: 'squalane', phase: 'B', pct: 6.0 },
        { ingredientId: 'caprylic-triglyceride', phase: 'B', pct: 4.0 },
        { ingredientId: 'olivem-1000', phase: 'B', pct: 4.0 },
        { ingredientId: 'cetearyl-alcohol', phase: 'B', pct: 1.5 },
        { ingredientId: 'niacinamide', phase: 'C', pct: 2.0 },
        { ingredientId: 'bisabolol', phase: 'C', pct: 0.3 },
        { ingredientId: 'retinol', phase: 'C', pct: 0.3 },
        { ingredientId: 'tocopherol', phase: 'C', pct: 0.2 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
        { ingredientId: 'ethylhexylglycerin', phase: 'C', pct: 0.2 },
      ],
    },
    referenceGoodFormula: {
      productType: 'leave-on',
      targetPh: 5.8,
      batchGrams: 500,
      phaseTempC: { A: 75, B: 75, C: 32 },
      rows: [
        { ingredientId: 'aqua', phase: 'A', pct: 76.25 },
        { ingredientId: 'glycerin', phase: 'A', pct: 4.0 },
        { ingredientId: 'xanthan-gum', phase: 'A', pct: 0.3 },
        { ingredientId: 'disodium-edta', phase: 'A', pct: 0.1 },
        { ingredientId: 'squalane', phase: 'B', pct: 6.0 },
        { ingredientId: 'caprylic-triglyceride', phase: 'B', pct: 4.0 },
        { ingredientId: 'olivem-1000', phase: 'B', pct: 4.0 },
        { ingredientId: 'cetearyl-alcohol', phase: 'B', pct: 1.5 },
        { ingredientId: 'bht', phase: 'B', pct: 0.05 },
        { ingredientId: 'niacinamide', phase: 'C', pct: 2.0 },
        { ingredientId: 'bisabolol', phase: 'C', pct: 0.3 },
        { ingredientId: 'retinol', phase: 'C', pct: 0.3 },
        { ingredientId: 'tocopherol', phase: 'C', pct: 0.2 },
        { ingredientId: 'phenoxyethanol', phase: 'C', pct: 0.8 },
        { ingredientId: 'ethylhexylglycerin', phase: 'C', pct: 0.2 },
      ],
    },
    stages: [
      {
        index: 0,
        code: 'ret-1-brief',
        titleRu: 'Этап 1 · Регуляторный бриф (Регламент ЕС 2024/996)',
        titleEn: 'Stage 1 · Regulatory Brief (EU Regulation 2024/996)',
        roleRu: 'Регуляторный химик',
        roleEn: 'Regulatory Chemist',
        kind: 'decision',
        promptRu: 'Отдел маркетинга просит «мощную ночную сыворотку с ретинолом для лица с выходом на рынки ЕАЭС и ЕС». Какую спецификацию по концентрации, pH и маркировке закладываете в ТЗ?',
        promptEn: 'Marketing wants a high-efficacy facial retinol night serum compliant in both EU and EAEU markets. Which concentration, pH, and labeling brief do you approve?',
        options: [
          {
            id: 'eu-03-compliant',
            labelRu: '0,3 % Retinol (RE) + pH 5,6–6,2 + антиоксидантная пара BHT/токоферол + предупреждение о витамине A (EU 2024/996)',
            labelEn: '0.3% Retinol (RE) + pH 5.6–6.2 + BHT/tocopherol antioxidant pair + mandatory Vitamin A label warning (EU 2024/996)',
            detailRu: 'Строго в рамках нового лимита ЕС 0,3 % RE для несмываемых средств для лица, максимальная химическая стабильность.',
            detailEn: 'Strictly within the EU 0.3% RE facial leave-on cap with optimal chemical stability.',
            scoreDelta: 20,
            costImpactRubPerKg: 0,
            feedbackRu: 'Безупречный регуляторный старт: 0,3 % RE проходит лимит EU 2024/996 для лица, pH ~5,8 защищает ретинол от кислотной изомеризации, а предупреждение про витамин A заложено в макет с первого дня.',
            feedbackEn: 'Clean regulatory design: 0.3% RE obeys the EU 2024/996 facial cap, pH ~5.8 prevents acid isomerization, and the mandatory Vitamin A warning is built into artwork from day one.',
          },
          {
            id: 'over-1pct',
            labelRu: '1,0 % чистого Retinol «для вау-эффекта на этикетке»',
            labelEn: '1.0% pure Retinol for a headline-grabbing label claim',
            detailRu: 'В 3,3 раза выше допустимого лимита ЕС 2024/996 для кремов/сывороток для лица.',
            detailEn: '3.3× above the EU 2024/996 legal cap for facial leave-on cosmetics.',
            scoreDelta: 4,
            costImpactRubPerKg: 320,
            riskTag: 'reg-breach',
            feedbackRu: 'Регуляторный блокер: выше 0,3 % RE продукт не пройдёт нотификацию CPNP в ЕС и вызовет массовый ретиноидный дерматит.',
            feedbackEn: 'Regulatory blocker: > 0.3% RE cannot legally launch in the EU under 2024/996 and triggers widespread retinoid irritation.',
          },
          {
            id: 'retinol-aha-ph35',
            labelRu: '0,3 % Retinol + 8 % гликолевой кислоты при pH 3,5 в одном флаконе',
            labelEn: '0.3% Retinol + 8% glycolic acid at pH 3.5 in one bottle',
            detailRu: 'Удобно «2-в-1», но кислая среда стремительно разрушает ретинол.',
            detailEn: 'Appealing "2-in-1" pitch, but acidic pH rapidly degrades retinol.',
            scoreDelta: 7,
            costImpactRubPerKg: 60,
            riskTag: 'acid-degrade',
            feedbackRu: 'Химический конфликт: ниже pH 5,0 ретинол быстро дегидратируется в ангидроретинол и теряет активность ещё до попадания к покупателю.',
            feedbackEn: 'Chemical conflict: below pH 5.0 retinol rapidly dehydrates into inactive anhydroretinol before reaching the consumer.',
          },
        ],
      },
      {
        index: 1,
        code: 'ret-2-lab',
        titleRu: 'Этап 2 · Сборка сыворотки в Лаборатории',
        titleEn: 'Stage 2 · Serum Formulation in Live Lab',
        roleRu: 'Химик-разработчик',
        roleEn: 'Formulation Chemist',
        kind: 'lab-formula',
        promptRu: 'Соберите и стабилизируйте ночную сыворотку 0,3 % Retinol в Лаборатории: баланс 100 %, 0 критических ошибок, ретинол ≤ 0,3 %, фаза C ≤ 35 °C, целевой pH 5,5–6,5, обязательный антиоксидант и хелатор металлов.',
        promptEn: 'Build and stabilize the 0.3% Retinol night serum in the Formulation Lab: 100% balance, 0 errors, retinol ≤ 0.3%, Phase C ≤ 35 °C, target pH 5.5–6.5, plus mandatory antioxidant and metal chelator.',
      },
      {
        index: 2,
        code: 'ret-3-challenge',
        titleRu: 'Этап 3 · Challenge Test (ISO 11930) и барьер от O₂',
        titleEn: 'Stage 3 · ISO 11930 Challenge Test & O₂ Barrier Pack',
        roleRu: 'Микробиолог / Упаковщик',
        roleEn: 'Microbiology & Pack Lead',
        kind: 'decision',
        promptRu: 'Ретинол окисляется на свету и в контакте с воздухом, а мягкая консервирующая система требует проверки по ISO 11930. Какой пакет «упаковка + микробиология» утверждаете?',
        promptEn: 'Retinol degrades rapidly in light and oxygen, and the gentle preservative system needs ISO 11930 validation. Which pack + microbiology protocol do you select?',
        options: [
          {
            id: 'alu-airless-n2',
            labelRu: 'Непрозрачный airless с Al-барьером + продувка N₂ при фасовке + Challenge Test ISO 11930 (критерий A)',
            labelEn: 'Opaque Al-barrier airless + N₂ headspace blanketing + ISO 11930 Challenge Test (Criterion A)',
            detailRu: 'Исключает подсос O₂ на всём сроке службы и подтверждает микробиологическую защиту.',
            detailEn: 'Eliminates oxygen ingress over full use life and validates antimicrobial protection.',
            scoreDelta: 20,
            costImpactRubPerKg: 165,
            feedbackRu: 'Профессиональный стандарт для ретиноидов: безвоздушный Al-барьер + азот удерживают > 92 % ретинола через 12 мес., а критерий A по ISO 11930 закрывает риски контаминации.',
            feedbackEn: 'Industry benchmark for retinoids: Al-barrier airless + nitrogen preserves > 92% retinol over 12 months while ISO 11930 Criterion A secures microbial safety.',
          },
          {
            id: 'amber-dropper',
            labelRu: 'Янтарный стеклянный флакон с пипеткой («аптечная эстетика»)',
            labelEn: 'Amber glass dropper bottle ("apothecary aesthetic")',
            detailRu: 'Хорош против света, но впускает свежий воздух при каждом открывании.',
            detailEn: 'Blocks UV light well, but pulls fresh oxygen into the serum on every use.',
            scoreDelta: 8,
            costImpactRubPerKg: 40,
            riskTag: 'o2-ingress',
            feedbackRu: 'Пипетка для ретинола — частая причина потемнения и падения титра: после 30 открываний в полупустом флаконе ретинол окисляется в разы быстрее.',
            feedbackEn: 'Dropper bottles are a top cause of retinol browning and potency loss: repeated air exchange rapidly oxidizes the half-empty serum.',
          },
          {
            id: 'clear-petg',
            labelRu: 'Прозрачный PETG-флакон без теста ISO 11930 (ориентируемся на литературную дозировку)',
            labelEn: 'Clear PETG bottle skipping ISO 11930 (relying on supplier literature dosage)',
            detailRu: 'Экономит 4 недели, но оставляет сыворотку без защиты от света и доказательств микробиологии.',
            detailEn: 'Saves 4 weeks, but leaves serum exposed to light and legally unvalidated for microbiology.',
            scoreDelta: 3,
            costImpactRubPerKg: -50,
            riskTag: 'unvalidated',
            feedbackRu: 'Двойной провал: прозрачный PETG разрушает ретинол на витрине, а отсутствие протокола ISO 11930 делает выпуск PIF невозможным.',
            feedbackEn: 'Double failure: clear PETG destroys retinol on display, and skipping ISO 11930 makes the safety dossier legally incomplete.',
          },
        ],
      },
      {
        index: 3,
        code: 'ret-4-vacuum',
        titleRu: 'Этап 4 · Вакуумный реактор 1 000 кг (ЧП на вводе фазы C)',
        titleEn: 'Stage 4 · 1,000 kg Vacuum Reactor (Phase C Emergency)',
        roleRu: 'Технолог производства',
        roleEn: 'Process Engineer',
        kind: 'decision',
        promptRu: 'На промышленной варке 1 000 кг пришло время вводить фазу C (0,3 % ретинола + антиоксиданты). Но датчик в центре массы показывает 44 °C, а вакуумметр держит только −0,25 бар вместо −0,85 бар (подсос воздуха через уплотнение). Ваши действия?',
        promptEn: 'On the 1,000 kg commercial batch, Phase C (0.3% retinol) is queued for addition — but core batch temperature is still 44 °C and vacuum reads only −0.25 bar instead of −0.85 bar (seal air leak). What do you order?',
        options: [
          {
            id: 'hold-cool-n2-valve',
            labelRu: 'Запретить ввод фазы C: доохладить до ≤ 32 °C под подушкой N₂, подтянуть уплотнение до −0,85 бар и ввести ретинол через донный клапан',
            labelEn: 'Hold Phase C: cool core to ≤ 32 °C under N₂ blanket, fix seal to −0.85 bar, and inject retinol via bottom vacuum port',
            detailRu: 'Задержка смены на 45 минут, но полная сохранность титра 0,3 % ретинола.',
            detailEn: '45-minute shift delay, but preserves full 0.3% retinol assay.',
            scoreDelta: 20,
            costImpactRubPerKg: 25,
            feedbackRu: 'Образцовое производственное решение: 45 минут задержки спасают тонну дорогой сыворотки от термоокисления и подсоса кислорода.',
            feedbackEn: 'Exemplary process discipline: a 45-minute hold saves a full metric ton of high-value serum from thermal oxidation and air entrainment.',
          },
          {
            id: 'add-at-44c',
            labelRu: 'Ввести ретинол при 44 °C, чтобы не срывать график фасовки',
            labelEn: 'Add retinol at 44 °C to stay on the filling schedule',
            detailRu: 'Смена сдана вовремя, но высокая температура + воздух в массе ускоряют окисление.',
            detailEn: 'Hits shift target, but heat + entrained air accelerate oxidative loss.',
            scoreDelta: 6,
            costImpactRubPerKg: 140,
            riskTag: 'heat-loss',
            feedbackRu: 'Ввод при 44 °C с подсосом воздуха снизил исходный титр ретинола на 18 % ещё до фасовки — партия быстро пожелтеет на полке.',
            feedbackEn: 'Adding at 44 °C with an air leak destroyed 18% of initial retinol assay before filling — rapid shelf yellowing guaranteed.',
          },
          {
            id: 'overdose-06',
            labelRu: 'Удвоить загрузку ретинола до 0,6 % «с запасом на окисление»',
            labelEn: 'Double retinol charge to 0.6% "as an overage buffer"',
            detailRu: 'Компенсирует потери, но прямо нарушает EU 2024/996 (≤ 0,3 % RE).',
            detailEn: 'Offsets loss, but directly breaches the EU 2024/996 0.3% RE legal cap.',
            scoreDelta: 2,
            costImpactRubPerKg: 290,
            riskTag: 'reg-breach',
            feedbackRu: 'Грубое нарушение регламента: 100 % оверидж ретинола выводит продукт за лимит 0,3 % RE в свежей партии и запрещён GMP.',
            feedbackEn: 'Severe compliance breach: a 100% retinol overage pushes fresh batches past the 0.3% RE ceiling and violates GMP.',
          },
        ],
      },
      {
        index: 4,
        code: 'ret-5-audit',
        titleRu: 'Этап 5 · Расследование ΔE пожелтения и выпуск PIF',
        titleEn: 'Stage 5 · ΔE Yellowing Investigation & Final PIF Release',
        roleRu: 'QA / Safety Assessor',
        roleEn: 'QA / Safety Assessor',
        kind: 'decision',
        promptRu: 'Отдел контроля качества прислал отчёт 3-месячного термостата +40 °C: титр ретинола 93 %, но цвет сдвинулся на ΔE = 2,8 (лёгкий кремово-жёлтый тон — естественный цвет транс-ретинола). Какие финальные спецификации и документы утверждаете перед отгрузкой 1 000 кг?',
        promptEn: 'QC delivers the 3-month +40 °C report: retinol assay is 93%, with ΔE = 2.8 (mild pale-yellow hue — inherent to all-trans retinol). What final release specification and PIF dossier action do you approve?',
        options: [
          {
            id: 'hplc-spec-release',
            labelRu: 'Подтвердить титр ВЭЖХ (≥ 90 % к концу срока годности), закрепить допустимый коридор цвета ΔE ≤ 4,0 (бледно-жёлтый) в спецификации и подписать PIF с маркировкой EU 2024/996',
            labelEn: 'Verify HPLC potency (≥ 90% at shelf-life end), document natural pale-yellow ΔE ≤ 4.0 window in COA spec, and sign off PIF with EU 2024/996 warning',
            detailRu: 'Опирается на аналитику (ВЭЖХ), отличает норму транс-ретинола от окислительного брака и закрывает аудит.',
            detailEn: 'Data-driven HPLC release that distinguishes natural trans-retinol tint from oxidative failure.',
            scoreDelta: 20,
            costImpactRubPerKg: 20,
            feedbackRu: 'Профессиональный релиз серии 1 000 кг! Титр ВЭЖХ ≥ 90 % и контролируемый светло-жёлтый цвет без запаха прогоркания — норма для стабильной сыворотки с ретинолом.',
            feedbackEn: 'Pro-grade 1,000 kg batch release! ≥ 90% HPLC potency with a controlled pale-yellow spec and zero off-odor is the hallmark of a stable retinol serum.',
          },
          {
            id: 'mask-with-dye',
            labelRu: 'Добавить фиолетовый краситель в готовую партию 1 000 кг, чтобы «отбелить» оттенок',
            labelEn: 'Dose violet dye into the finished 1,000 kg batch to "optically whiten" the tint',
            detailRu: 'Скроет жёлтизну визуально, но нарушит утверждённый INCI и досье.',
            detailEn: 'Masks yellow tone optically, but breaks approved INCI artwork and PIF.',
            scoreDelta: 5,
            costImpactRubPerKg: 110,
            feedbackRu: 'Нарушение GMP: ввод незадекларированного красителя делает этикетку и PIF недействительными, а также маскирует реальную деградацию.',
            feedbackEn: 'GMP violation: adding an undeclared colorant invalidates the INCI label and PIF while masking future degradation.',
          },
          {
            id: 'scrap-ton',
            labelRu: 'Утилизировать всю тонну из-за ΔE = 2,8 без проверки ВЭЖХ',
            labelEn: 'Scrap the entire 1,000 kg batch over ΔE = 2.8 without checking HPLC potency',
            detailRu: 'Избегает любого риска, но сжигает бюджет запуска впустую.',
            detailEn: 'Zero consumer risk, but destroys launch margin over a normal retinoid color shift.',
            scoreDelta: 8,
            costImpactRubPerKg: 500,
            feedbackRu: 'Избыточная паника: лёгкий жёлтый тон характерен для самого транс-ретинола; решение о браке должно опираться на ВЭЖХ и органолептику, а не на ожидание «белоснежного» цвета.',
            feedbackEn: 'Unnecessary write-off: pure all-trans retinol is naturally pale yellow; batch rejection must rely on HPLC assay and odor, not an unrealistic snow-white expectation.',
          },
        ],
      },
    ],
  },
]

export function getCampaign(id: string): CampaignDefinition | undefined {
  return CAMPAIGNS.find((c) => c.id === id)
}

/** Оценивает реальную рецептуру из Лаборатории на соответствие требованиям Этапа 2 кампании. */
export function evaluateCampaignLabFormula(
  campaignId: CampaignId,
  formula: FormulaInput,
  catalog: Ingredient[],
): CampaignLabCheckResult {
  const en = language === 'en'
  const ev = evaluateFormula(formula, catalog)
  const spfPig = analyzeSpfAndPigments(ev, formula)
  const pctOf = (id: string) =>
    ev.rows.filter((r) => r.ingredient.id === id).reduce((s, r) => s + r.pct, 0)

  const checks: CampaignLabCheckResult['checks'] = []
  const notes: string[] = []

  if (campaignId === 'spf50-city-fluid') {
    const spfVal = spfPig?.estimatedSpf ?? 0
    const uvaRatio = spfPig?.uvaRatio ?? 0
    const crystalOk = Boolean(spfPig?.hasUvFilters && spfPig.crystalSafe)
    const costOk = ev.costPerKg <= 3600

    checks.push(
      {
        id: 'balanced',
        labelRu: 'Баланс фаз ровно 100 % и 0 критических ошибок',
        labelEn: '100% mass balance and 0 critical errors',
        passed: ev.balanced && ev.errorsCount === 0,
      },
      {
        id: 'spf50',
        labelRu: `Оценка in-silico SPF ≥ 45 (сейчас SPF ${spfVal})`,
        labelEn: `In-silico SPF ≥ 45 (currently SPF ${spfVal})`,
        passed: spfVal >= 45,
      },
      {
        id: 'uva',
        labelRu: `Критерий «UVA в кружке» ≥ 0,33 (сейчас ${uvaRatio})`,
        labelEn: `EU UVA circle ratio ≥ 0.33 (currently ${uvaRatio})`,
        passed: uvaRatio >= 0.33,
      },
      {
        id: 'crystal',
        labelRu: 'Запас полярных эфиров удерживает твёрдые УФ-фильтры без кристаллов',
        labelEn: 'Polar ester solvency prevents solid UV filter crystallization',
        passed: crystalOk,
      },
      {
        id: 'cost',
        labelRu: `Себестоимость сырья ≤ 3 600 ₽/кг (сейчас ${ev.costPerKg} ₽/кг)`,
        labelEn: `Raw material cost ≤ 3,600 RUB/kg (currently ${ev.costPerKg} RUB/kg)`,
        passed: costOk,
      },
    )

    if (!crystalOk) {
      notes.push(
        en
          ? 'Carried risk → Stage 3/5: solid UV filters may crystallize at +4 °C without more polar esters.'
          : 'Переносимый риск → Этапы 3 и 5: без запаса полярных эфиров твёрдые УФ-фильтры дадут кристаллы при +4 °C.',
      )
    }
    if (ev.errorsCount > 0) {
      notes.push(
        en
          ? `Carried risk → Stage 4: ${ev.errorsCount} formula error(s) remain unresolved.`
          : `Переносимый риск → Этап 4: в рецептуре остались нерешённые ошибки (${ev.errorsCount}).`,
      )
    }

    const passedCount = checks.filter((c) => c.passed).length
    const score = Math.round((passedCount / checks.length) * 20)
    return {
      score,
      passed: passedCount >= 4 && ev.balanced,
      costPerKg: ev.costPerKg,
      errors: ev.errorsCount,
      spf: spfVal,
      uvaRatio,
      checks,
      notes,
    }
  }

  // retinol-03-serum
  const retinolPct = pctOf('retinol')
  const hasAox = ev.rows.some((r) => r.pct > 0 && r.ingredient.role === 'antioxidant') || pctOf('tocopherol') + pctOf('bht') > 0
  const hasChelator = ev.rows.some((r) => r.pct > 0 && r.ingredient.role === 'chelator') || pctOf('disodium-edta') + pctOf('sodium-phytate') > 0
  const phOk = formula.targetPh >= 5.5 && formula.targetPh <= 6.5
  const tempCOk = formula.phaseTempC.C <= 35

  checks.push(
    {
      id: 'balanced',
      labelRu: 'Баланс фаз ровно 100 % и 0 критических ошибок',
      labelEn: '100% mass balance and 0 critical errors',
      passed: ev.balanced && ev.errorsCount === 0,
    },
    {
      id: 'retinol-cap',
      labelRu: `Дозировка Retinol в коридоре 0,1–0,3 % по EU 2024/996 (сейчас ${retinolPct} %)`,
      labelEn: `Retinol dosage in 0.1–0.3% EU 2024/996 range (currently ${retinolPct}%)`,
      passed: retinolPct >= 0.1 && retinolPct <= 0.305,
    },
    {
      id: 'ph-window',
      labelRu: `Стабильный pH 5,5–6,5 для ретинола (сейчас ${formula.targetPh})`,
      labelEn: `Stable pH 5.5–6.5 window for retinol (currently ${formula.targetPh})`,
      passed: phOk,
    },
    {
      id: 'cold-c',
      labelRu: `Холодный ввод фазы C ≤ 35 °C (сейчас ${formula.phaseTempC.C} °C)`,
      labelEn: `Cold Phase C addition ≤ 35 °C (currently ${formula.phaseTempC.C} °C)`,
      passed: tempCOk,
    },
    {
      id: 'shield',
      labelRu: 'Введены антиоксидант (токоферол / BHT) и хелатор металлов (EDTA / фитат)',
      labelEn: 'Antioxidant (tocopherol / BHT) and metal chelator (EDTA / phytate) present',
      passed: hasAox && hasChelator,
    },
  )

  if (!hasChelator || !hasAox) {
    notes.push(
      en
        ? 'Carried risk → Stage 5: without chelator + antioxidant, trace metals accelerate retinol yellowing.'
        : 'Переносимый риск → Этап 5: без связки хелатор + антиоксидант следы металлов ускорят пожелтение сыворотки.',
    )
  }
  if (!tempCOk) {
    notes.push(
      en
        ? 'Carried risk → Stage 4: elevated Phase C temperature (> 35 °C) degrades retinol during batching.'
        : 'Переносимый риск → Этап 4: завышенная температура фазы C (> 35 °C) снижает титр ретинола при варке.',
    )
  }

  const passedCount = checks.filter((c) => c.passed).length
  const score = Math.round((passedCount / checks.length) * 20)
  return {
    score,
    passed: passedCount >= 4 && ev.balanced,
    costPerKg: ev.costPerKg,
    errors: ev.errorsCount,
    checks,
    notes,
  }
}

/** Собирает сквозные последствия и итоговый бизнес-отчёт кампании запуска. */
export function computeCampaignReport(
  def: CampaignDefinition,
  rec: CampaignProgressRecord | undefined,
): CampaignLaunchReport {
  let decisionScore = 0
  let costDelta = 0
  let defectRisk = 3 // базовый промышленный фон 3%
  const consRu: string[] = []
  const consEn: string[] = []

  const choices = rec?.choices ?? {}
  for (const st of def.stages) {
    if (st.kind === 'decision' && st.options) {
      const pickedId = choices[String(st.index)]
      const opt = st.options.find((o) => o.id === pickedId)
      if (opt) {
        decisionScore += opt.scoreDelta
        costDelta += opt.costImpactRubPerKg
        if (opt.scoreDelta < 15) defectRisk += Math.round((20 - opt.scoreDelta) * 1.1)
        if (opt.riskTag === 'photodeg') {
          consRu.push('Этап 1: пара Avobenzone + Octinoxate снизила фотостабильность UVA-PF на 35 %.')
          consEn.push('Stage 1: Avobenzone + Octinoxate pair cut UVA-PF photostability by 35%.')
        } else if (opt.riskTag === 'agglomeration') {
          consRu.push('Этап 1: 20 % ZnO без диспергатора дали агломераты и тяжёлую текстуру.')
          consEn.push('Stage 1: 20% ZnO without dispersant caused agglomerates and heavy feel.')
        } else if (opt.riskTag === 'light-pack' || opt.riskTag === 'o2-ingress') {
          consRu.push('Этап 3: небарьерная упаковка пропустила свет/O₂ — ускоренное пожелтение на полке.')
          consEn.push('Stage 3: non-barrier packaging allowed light/O₂ ingress — faster shelf browning.')
        } else if (opt.riskTag === 'paneling') {
          consRu.push('Этап 3: LDPE-туба сорбировала эмоленты (paneling и липкие стенки).')
          consEn.push('Stage 3: LDPE tube absorbed esters (paneling and greasy outer walls).')
        } else if (opt.riskTag === 'shear-damage' || opt.riskTag === 'heat-loss') {
          consRu.push('Этап 4: нарушение режима охлаждения/сдвига в реакторе ослабило структуру и актив.')
          consEn.push('Stage 4: pilot cooling/shear violation damaged emulsion structure and active assay.')
        } else if (opt.riskTag === 'gmp-violation' || opt.riskTag === 'reg-breach' || opt.riskTag === 'unvalidated') {
          consRu.push('Критический регуляторный / GMP-риск в цепочке запуска — требуется корректирующий CAPA.')
          consEn.push('Critical regulatory / GMP deviation in the launch chain — CAPA remediation required.')
        }
      }
    }
  }

  const labScore = rec?.labSummary?.score ?? 0
  if (rec?.labSummary && !rec.labSummary.passed) {
    defectRisk += 14
    consRu.push('Этап 2: рецептура из Лаборатории передана с невыполненными критериями стабильности/баланса.')
    consEn.push('Stage 2: Lab formula handed over with unresolved stability or balance criteria.')
  }
  const totalScore = Math.max(0, Math.min(100, decisionScore + labScore))
  const baseCost = rec?.labSummary?.costPerKg ?? def.targetCostRubPerKg
  const estimatedCostPerKg = Math.max(200, Math.round(baseCost + costDelta))
  const defectRiskPct = Math.min(68, Math.max(1, defectRisk))

  const [gradeRu, gradeEn] =
    totalScore >= 88
      ? ['Готов к промышленному запуску (Отлично)', 'Commercial Launch Ready (Excellent)']
      : totalScore >= 68
        ? ['Допущен с корректирующими мерами (CAPA)', 'Conditional Release (CAPA Required)']
        : ['Запуск остановлен: критические технологические риски', 'Launch Hold: Critical Process Risks']

  return {
    totalScore,
    gradeRu,
    gradeEn,
    estimatedCostPerKg,
    defectRiskPct,
    carriedConsequencesRu: consRu,
    carriedConsequencesEn: consEn,
  }
}
