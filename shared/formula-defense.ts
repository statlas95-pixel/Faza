// Сократовская QA-защита рецептуры (Пакет S):
// Детерминированно анализирует реальную формулу пользователя из Лаборатории
// и формирует 3 точечных вопроса производственного/R&D-аудитора.

import type { FormulaEvaluation, FormulaInput, Ingredient } from './formulation'
import { computeIso16128 } from './engineering-tools'
import { language } from './locale'

export interface DefenseQuestion {
  id: string
  category: string
  prompt: string
  options: { id: string; text: string; correct: boolean; why: string }[]
}

export function generateFormulaDefense(
  formula: FormulaInput,
  ev: FormulaEvaluation,
  catalog: Ingredient[],
): DefenseQuestion[] {
  const en = language === 'en'
  const qs: DefenseQuestion[] = []
  const byId = new Map(ev.rows.map((r) => [r.ingredient.id, r]))
  const has = (id: string) => (byId.get(id)?.pct ?? 0) > 0
  const hasPreservative = ev.rows.some((r) => r.pct > 0 && r.ingredient.role === 'preservative')
  const hasAcidPres = ev.rows.some((r) => r.pct > 0 && r.ingredient.role === 'preservative' && r.ingredient.pKa !== undefined)
  const hasUv = ev.rows.some((r) => r.pct > 0 && r.ingredient.role === 'uv_filter')
  const hasCarbomer = has('carbomer') || has('ultrez-21')
  const iso = computeIso16128(formula.rows, catalog)
  const waterPct = byId.get('aqua')?.pct ?? 0

  // Вопрос 1: Самый критичный узел текущей формулы (дефект / консервация / УФ / ГЛБ / полимер)
  if (ev.errorsCount > 0) {
    const topErr = ev.issues.find((i) => i.severity === 'error')!
    qs.push({
      id: 'q-top-error',
      category: en ? 'Critical QA Blocker' : 'Критический блокер QA',
      prompt: en
        ? `QA Audit flagged a critical error in your formula: "${topErr.title}". What is the right engineering decision before scaling to pilot batch?`
        : `QA-аудит выявил критическую ошибку в вашей рецептуре: «${topErr.title}». Какое инженерное решение корректно до выпуска пилотной партии?`,
      options: [
        {
          id: 'a',
          text: en ? 'Fix the root cause in formula/process and re-validate before batching' : 'Устранить первопричину в рецептуре или режиме и повторно провалидировать до варки',
          correct: true,
          why: en
            ? `Correct: ${topErr.detail}`
            : `Верно: ${topErr.detail}`,
        },
        {
          id: 'b',
          text: en ? 'Proceed to 500 kg batch and compensate by adding fragrance and extra stirring' : 'Запустить партию 500 кг и замаскировать дефект отдушкой и дольшим перемешиванием',
          correct: false,
          why: en
            ? 'Scaling a formula with an unresolved physicochemical or regulatory error guarantees a rejected plant batch.'
            : 'Масштабирование рецептуры с неустранённой физико-химической или регуляторной ошибкой гарантирует брак промышленной партии.',
        },
        {
          id: 'c',
          text: en ? 'Sign off under verbal waiver without logging a deviation' : 'Выпустить партию по устному согласованию без оформления отклонения',
          correct: false,
          why: en
            ? 'Violates ISO 22716 GMP: verbal waivers are invalid and critical errors cannot be shipped.'
            : 'Нарушает GMP (ISO 22716): устные согласования недействительны, а продукт с критической ошибкой выпускать нельзя.',
        },
      ],
    })
  } else if (hasUv) {
    qs.push({
      id: 'q-spf-photo',
      category: en ? 'Photostability & SPF Film' : 'Фотостабильность и плёнка SPF',
      prompt: en
        ? `Your formula contains UV filters at pH ${formula.targetPh}. Which stability risk must be verified at +4 °C and under UV exposure during ISO/TR 18811 testing?`
        : `В вашей рецептуре есть УФ-фильтры при pH ${formula.targetPh}. Какой риск необходимо проверить при +4 °C и УФ-экспозиции по ISO/TR 18811?`,
      options: [
        {
          id: 'a',
          text: en ? 'Cold recrystallization of solid UV filters and UVA-PF / λc drop under irradiation' : 'Холодную кристаллизацию твёрдых УФ-фильтров и падение UVA-PF / λc под облучением',
          correct: true,
          why: en
            ? 'Crystalline filters (Tinosorb S, Uvinul T 150, Avobenzone) precipitate at +4 °C if polar solvents are insufficient, collapsing the optical film.'
            : 'Кристаллические фильтры (Tinosorb S, Uvinul T 150, авобензон) выпадают в осадок при +4 °C при дефиците полярных растворителей, резко снижая реальный SPF.',
        },
        {
          id: 'b',
          text: en ? 'Only color matching by eye after 24 hours at room temperature' : 'Только визуальный цвет образца через 24 часа при комнатной температуре',
          correct: false,
          why: en
            ? 'Room temperature 24 h checks never reveal slow cold crystallization or photodegradation.'
            : '24 часа при комнатной температуре не выявляют ни медленную холодную кристаллизацию, ни фотодеградацию.',
        },
        {
          id: 'c',
          text: en ? 'Boiling point elevation of the oil phase at 100 °C' : 'Повышение температуры кипения масляной фазы до 100 °C',
          correct: false,
          why: en
            ? 'Not a relevant failure mode for sunscreen stability.'
            : 'Это не является рабочим механизмом нестабильности солнцезащитных средств.',
        },
      ],
    })
  } else if (hasCarbomer) {
    qs.push({
      id: 'q-carbomer',
      category: en ? 'Polymer Rheology' : 'Реология полимеров',
      prompt: en
        ? `Your formula uses an acrylic carbomer thickener at pH ${formula.targetPh}. What happens if a future brief adds 1.5% Sodium PCA or Zinc PCA?`
        : `Ваша рецептура использует акриловый карбомер при pH ${formula.targetPh}. Что произойдёт, если маркетинг попросит добавить 1,5 % Sodium PCA или Zinc PCA?`,
      options: [
        {
          id: 'a',
          text: en ? 'Electrolyte shielding compresses the polyacrylate coils, causing sharp viscosity collapse' : 'Экранирование зарядов электролитом сожмёт клубки полиакрилата и вызовет обвал вязкости',
          correct: true,
          why: en
            ? 'Exact mechanism: ions (especially divalent Zn²⁺) collapse the electrostatic repulsion of COO⁻ groups. Switch to Xanthan, Tara Gum, or Sepimax Zen.'
            : 'Точный механизм: ионы (особенно двухвалентный Zn²⁺) подавляют отталкивание групп COO⁻. Нужен переход на ксантан, камедь тары или Sepimax Zen.',
        },
        {
          id: 'b',
          text: en ? 'Viscosity will triple via wormlike micelle entanglement' : 'Вязкость вырастет втрое за счёт червеобразных мицелл',
          correct: false,
          why: en
            ? 'Salt thickening applies to anionic surfactants (SLES/CAPB), not cross-linked polyacrylic acid.'
            : 'Загущение солью характерно для анионных ПАВ (SLES/CAPB), но разрушает сшитую полиакриловую кислоту.',
        },
        {
          id: 'c',
          text: en ? 'No effect at all because carbomer is nonionic' : 'Ничего не изменится, так как карбомер неионогенный',
          correct: false,
          why: en
            ? 'Neutralized carbomer is strongly anionic — high electrolyte sensitivity is its defining limitation.'
            : 'Нейтрализованный карбомер — сильный анионный полиэлектролит, крайне чувствительный к солям.',
        },
      ],
    })
  } else {
    qs.push({
      id: 'q-hlb-scale',
      category: en ? 'Emulsion & Scale-Up' : 'Эмульсия и масштабирование',
      prompt: en
        ? `Your batch is set to ${formula.batchGrams} g (Phase A ${formula.phaseTempC.A} °C, Phase B ${formula.phaseTempC.B} °C). When scaling to a 1,000 kg reactor, what changes most dramatically?`
        : `Текущая варка задана на ${formula.batchGrams} г (фаза A ${formula.phaseTempC.A} °C, фаза B ${formula.phaseTempC.B} °C). Что изменится сильнее всего при переносе в реактор 1 000 кг?`,
      options: [
        {
          id: 'a',
          text: en ? 'Surface-to-volume ratio A/V drops ~10×, extending cooling from minutes to hours and altering LGN/wax crystallization' : 'Отношение A/V упадёт в ~10 раз, охлаждение растянется на часы и изменит кристаллизацию восков/ЛГС',
          correct: true,
          why: en
            ? 'Exactly right: slower cooling changes crystal size and viscosity; validate cooling rate and inline homogenizer pass count on a pilot batch.'
            : 'Абсолютно верно: медленное охлаждение меняет размер кристаллов и итоговую вязкость; на пилоте валидируют профиль охлаждения и число проходов гомогенизатора.',
        },
        {
          id: 'b',
          text: en ? 'Required HLB of the oil phase shifts from 8 to 15 in steel vessels' : 'Требуемый ГЛБ масляной фазы вырастет с 8 до 15 в стальном реакторе',
          correct: false,
          why: en
            ? 'Required HLB is an intensive physicochemical property of the oil blend and does not depend on batch size.'
            : 'Требуемый ГЛБ — интенсивное свойство масляной фазы, оно не зависит от объёма котла.',
        },
        {
          id: 'c',
          text: en ? 'Mass percentages in the formula must be multiplied by 10' : 'Массовые проценты компонентов в рецептуре нужно умножить на 10',
          correct: false,
          why: en
            ? 'Mass fractions always stay at 100.00%; only absolute kilograms scale.'
            : 'Массовые доли всегда сохраняют сумму 100,00 %; масштабируются только килограммы.',
        },
      ],
    })
  }

  // Вопрос 2: Консервация и микробиология (ISO 11930)
  if (waterPct >= 5) {
    qs.push({
      id: 'q-micro',
      category: en ? 'Preservation & ISO 11930' : 'Консервация и ISO 11930',
      prompt: en
        ? hasAcidPres
          ? `Your formula uses an organic-acid preservative at target pH ${formula.targetPh}. Why does QA strictly control pH drift during 45 °C accelerated aging?`
          : `Your aqueous formula (${waterPct}% water) is targeting pH ${formula.targetPh}. Which test legally proves microbiological safety before launch?`
        : hasAcidPres
          ? `В вашей рецептуре есть кислотный консервант при целевом pH ${formula.targetPh}. Почему QA строго контролирует дрейф pH при старении 45 °C?`
          : `Ваша водная система (${waterPct} % воды) рассчитана на pH ${formula.targetPh}. Какое испытание доказывает микробиологическую защиту перед запуском?`,
      options: hasAcidPres
        ? [
            {
              id: 'a',
              text: en ? 'Rising pH above pKa shifts the acid into inactive anion form, causing ISO 11930 failure' : 'Рост pH выше pKa переводит кислоту в неактивный анион и ведёт к провалу ISO 11930',
              correct: true,
              why: en
                ? 'By Henderson–Hasselbalch, only the undissociated acid penetrates microbial membranes.'
                : 'По Гендерсону–Хассельбальху через мембрану микроорганизма проникает именно недиссоциированная кислота.',
            },
            {
              id: 'b',
              text: en ? 'Organic acids only work above pH 8.5' : 'Органические кислоты работают только при pH выше 8,5',
              correct: false,
              why: en
                ? 'The opposite is true: above pH 6 most organic acid preservatives retain < 10% active form.'
                : 'Всё наоборот: выше pH 6 большинство кислотных консервантов сохраняют менее 10 % активной формы.',
            },
            {
              id: 'c',
              text: en ? 'pH drift only affects label font size' : 'Дрейф pH влияет только на запах отдушки',
              correct: false,
              why: en
                ? 'pH drift directly disables pH-dependent preservatives and hydrolyzes actives.'
                : 'Дрейф pH напрямую отключает pH-зависимую консервацию и ускоряет гидролиз активов.',
            },
          ]
        : [
            {
              id: 'a',
              text: en ? '28-day ISO 11930 Challenge Test on 5 strains (Criterion A/B)' : '28-суточный челлендж-тест ISO 11930 на 5 штаммах (Критерий A/B)',
              correct: true,
              why: en
                ? hasPreservative
                  ? 'Even with a preservative present, actual formula matrix (emulsifiers, packaging, aw) can neutralize it — ISO 11930 is mandatory.'
                  : 'With ≥ 5% water and no preservative, the formula will fail ISO 11930 without a validated preservation/hurdle system.'
                : hasPreservative
                  ? 'Даже при наличии консерванта матрица эмульсии может связывать его в мицеллах — валидация ISO 11930 обязательна.'
                  : 'При ≥ 5 % воды без консерванта продукт не пройдёт ISO 11930 без барьерной/консервирующей системы.',
            },
            {
              id: 'b',
              text: en ? 'A 15-minute centrifuge spin at 3000 rpm' : '15-минутное центрифугирование при 3000 об/мин',
              correct: false,
              why: en
                ? 'Centrifugation tests gravitational phase separation, not microbial growth.'
                : 'Центрифуга проверяет гравитационное расслоение, а не микробиологическую защиту.',
            },
            {
              id: 'c',
              text: en ? 'Checking that viscosity exceeds 5000 mPa·s' : 'Проверка того, что вязкость выше 5000 мПа·с',
              correct: false,
              why: en
                ? 'Bacteria and fungi grow readily in thick creams if water activity aw > 0.75.'
                : 'Бактерии и плесень прекрасно размножаются и в густых кремах при активности воды aw > 0,75.',
            },
          ],
    })
  } else {
    qs.push({
      id: 'q-anhydrous',
      category: en ? 'Anhydrous Stability' : 'Стабильность безводной матрицы',
      prompt: en
        ? 'Your formula is anhydrous (< 5% water). Which failure mode replaces microbial spoilage as the primary shelf-life threat?'
        : 'Ваша рецептура безводная (< 5 % воды). Какой механизм порчи выходит на первое место вместо микробиологического роста?',
      options: [
        {
          id: 'a',
          text: en ? 'Lipid autoxidation (rancidity / TOTOX rise) and wax/butter blooming or syneresis' : 'Перекисное окисление липидов (прогоркание) и перекристаллизация/синерезис восков и баттеров',
          correct: true,
          why: en
            ? 'Anhydrous balms/oils need lipid antioxidants (Tocopherol/BHT) and controlled cooling/wax polymorphism (e.g. microcrystalline wax).'
            : 'Безводным системам критичны жирорастворимые антиоксиданты (токоферол/BHT) и контроль полиморфизма восков и баттеров.',
        },
        {
          id: 'b',
          text: en ? 'Henderson–Hasselbalch pH drift of aqueous buffer' : 'Дрейф pH водного цитратного буфера',
          correct: false,
          why: en
            ? 'Aqueous pH is not defined in anhydrous lipid systems.'
            : 'Понятие водного pH не применимо к безводным липидным системам.',
        },
        {
          id: 'c',
          text: en ? 'Electrolyte collapse of carbomer gel' : 'Солевой коллапс водного геля карбомера',
          correct: false,
          why: en
            ? 'Aqueous carbomer networks do not exist in anhydrous formulas.'
            : 'Водной сетки карбомера в безводной системе нет.',
        },
      ],
    })
  }

  // Вопрос 3: Регуляторика, ISO 16128 и этикетка INCI
  qs.push({
    id: 'q-inci-iso',
    category: en ? 'INCI & ISO 16128 Claims' : 'INCI и клеймы ISO 16128',
    prompt: en
      ? `Your formula has ISO 16128 NOI = ${iso.noiWithWaterPct}% (with water) and ${iso.noiWithoutWaterPct}% (without water), and ${ev.inci.oneOrLess.length} components at ≤ 1%. What can marketing honestly print on pack?`
      : `У вашей рецептуры ISO 16128 NOI = ${iso.noiWithWaterPct} % (с водой) и ${iso.noiWithoutWaterPct} % (без воды), а также ${ev.inci.oneOrLess.length} компонентов ≤ 1 %. Что маркетинг имеет право вынести на этикетку?`,
    options: [
      {
        id: 'a',
        text: en
          ? `"${iso.noiWithWaterPct}% ingredients of natural origin (ISO 16128, incl. water)" and components ≤ 1% listed in any order after the > 1% descending list`
          : `«${iso.noiWithWaterPct} % ингредиентов натурального происхождения (ISO 16128, включая воду)», а компоненты ≤ 1 % — в произвольном порядке после убывающего блока > 1 %`,
        correct: true,
        why: en
          ? 'Exact compliance with ISO 16128 transparency rules and Art. 19(1)(g) of EU Regulation 1223/2009.'
          : 'Точное соответствие стандарту прозрачности ISO 16128 и ст. 19(1)(g) Регламента (ЕС) № 1223/2009.',
      },
      {
        id: 'b',
        text: en ? '"100% Organic & Preservative-Free" regardless of synthetic polymers or phenoxyethanol' : '«100 % органика без консервантов» независимо от синтетических полимеров и феноксиэтанола',
        correct: false,
        why: en
          ? 'Direct violation of EU Regulation 655/2013 (Common Criteria for Cosmetic Claims — truthfulness and honesty).'
          : 'Прямое нарушение EU 655/2013 (общие критерии достоверности косметических клеймов).',
      },
      {
        id: 'c',
        text: en ? 'Place the 0.1% hero active first in INCI right before Aqua for marketing impact' : 'Поставить 0,1 % ключевого актива на первое место в INCI перед Aqua ради маркетинга',
        correct: false,
        why: en
          ? 'Ingredients > 1% must strictly descend by weight, and ≤ 1% ingredients can never precede > 1% ingredients.'
          : 'Ингредиенты > 1 % обязаны идти строго по убыванию массы; компоненты ≤ 1 % нельзя поднимать выше границы 1 %.',
      },
    ],
  })

  return qs
}
