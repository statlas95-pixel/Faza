// Режим экзамена / оценки кандидатов для команд, R&D-отделов и вузов (Пакет U):
// 1) Конфигуратор экзамена с фиксированным seed (ссылка #/assessment?exam=...)
// 2) Банк 16 инженерных экзаменационных вопросов (4 трека: R&D, процесс, QA/регуляторика, универсальный) без подсказок
// 3) Верифицируемый компактный код результата с контрольной суммой (ссылка #/assessment?result=...)

export type ExamTrack = 'full' | 'rnd' | 'process' | 'qa'

export interface ExamConfig {
  org: string
  role: string
  track: ExamTrack
  seed: number
  count: number // 6..12
  minutes: number // 10..40
}

export interface ExamQuestion {
  id: string
  domain: 'rnd' | 'process' | 'qa'
  promptRu: string
  promptEn: string
  options: { id: string; textRu: string; textEn: string; correct: boolean }[]
}

export interface ExamResultPayload {
  v: 1
  org: string
  role: string
  candidate: string
  track: ExamTrack
  seed: number
  score: number // 0..100
  correct: number
  total: number
  elapsedSec: number
  domainPct: { rnd: number; process: number; qa: number }
  date: string
  sig: string // контрольная подпись целостности
}

export const EXAM_BANK: ExamQuestion[] = [
  {
    id: 'ex-rnd-1',
    domain: 'rnd',
    promptRu: 'Масляная фаза крема O/W (15 %) содержит 10 % эмолента с reqHLB = 5 и 5 % масла с reqHLB = 11. Какой расчётный требуемый ГЛБ масляной фазы?',
    promptEn: 'An O/W cream oil phase (15%) contains 10% emollient (reqHLB = 5) and 5% oil (reqHLB = 11). What is the required HLB of the oil phase?',
    options: [
      { id: 'a', textRu: '7,0', textEn: '7.0', correct: true },
      { id: 'b', textRu: '8,0', textEn: '8.0', correct: false },
      { id: 'c', textRu: '9,5', textEn: '9.5', correct: false },
    ],
  },
  {
    id: 'ex-rnd-2',
    domain: 'rnd',
    promptRu: 'Почему добавление 1 % Zn(PCA)₂ в прозрачный гель на классическом Carbomer при pH 6,0 мгновенно превращает его в воду?',
    promptEn: 'Why does adding 1% Zinc PCA to a classic Carbomer gel at pH 6.0 immediately collapse it into water?',
    options: [
      { id: 'a', textRu: 'Двухвалентный катион Zn²⁺ экранирует группы COO⁻ и сжимает полиакрилатный клубок', textEn: 'Divalent Zn²⁺ shields COO⁻ charges and collapses the polyacrylate coil', correct: true },
      { id: 'b', textRu: 'Zn(PCA)₂ не растворяется в воде', textEn: 'Zinc PCA is insoluble in water', correct: false },
      { id: 'c', textRu: 'Карбомер окисляется кислородом воздуха', textEn: 'Carbomer oxidizes in air', correct: false },
    ],
  },
  {
    id: 'ex-rnd-3',
    domain: 'rnd',
    promptRu: 'В сыворотке с медным пептидом GHK-Cu (0,1 %) и 0,2 % Disodium EDTA через неделю исчез голубой оттенок. Какова наиболее вероятная причина?',
    promptEn: 'A serum with 0.1% Copper Tripeptide-1 (GHK-Cu) and 0.2% Disodium EDTA loses its blue tint within a week. What is the root cause?',
    options: [
      { id: 'a', textRu: 'EDTA перехватил ион Cu²⁺ из комплекса GHK-Cu (дехелатирование пептида)', textEn: 'EDTA stripped Cu²⁺ from the GHK-Cu complex (peptide de-chelation)', correct: true },
      { id: 'b', textRu: 'Осаждение ксантановой камеди', textEn: 'Xanthan gum precipitation', correct: false },
      { id: 'c', textRu: 'Испарение меди с поверхности крема', textEn: 'Evaporation of copper from the cream', correct: false },
    ],
  },
  {
    id: 'ex-rnd-4',
    domain: 'rnd',
    promptRu: 'Как в обратной эмульсии W/O (40 % воды в масле) предотвратить оствальдово созревание и коалесценцию капель воды?',
    promptEn: 'How do you suppress Ostwald ripening and water-droplet coalescence in a W/O emulsion (40% water in oil)?',
    options: [
      { id: 'a', textRu: 'Ввести 0,5–1,0 % электролита (MgSO₄ / NaCl) в водную фазу и тиксотроп (гекторит) в масляную', textEn: 'Add 0.5–1.0% electrolyte (MgSO₄ / NaCl) to water phase and hectorite to oil phase', correct: true },
      { id: 'b', textRu: 'Увеличить ГЛБ эмульгатора до 14', textEn: 'Raise emulsifier HLB to 14', correct: false },
      { id: 'c', textRu: 'Убрать все соли из водной фазы', textEn: 'Remove all salts from the aqueous phase', correct: false },
    ],
  },
  {
    id: 'ex-rnd-5',
    domain: 'rnd',
    promptRu: 'В солнцезащитном флюиде 4 % Tinosorb S + 3 % Uvinul T 150 выпали кристаллы при +4 °C. Что нужно исправить?',
    promptEn: 'A sunscreen with 4% Tinosorb S + 3% Uvinul T 150 formed crystals at +4 °C. What is the fix?',
    options: [
      { id: 'a', textRu: 'Увеличить долю полярных эмолентов-растворителей (Dibutyl Adipate, C12-15 Alkyl Benzoate)', textEn: 'Increase polar ester solvents (Dibutyl Adipate, C12-15 Alkyl Benzoate)', correct: true },
      { id: 'b', textRu: 'Заменить полярные эфиры на парафиновое масло', textEn: 'Replace polar esters with mineral oil', correct: false },
      { id: 'c', textRu: 'Снизить pH водной фазы до 3,5', textEn: 'Lower aqueous pH to 3.5', correct: false },
    ],
  },
  {
    id: 'ex-rnd-6',
    domain: 'rnd',
    promptRu: 'Какую комбинацию УФ-фильтров опасно использовать без фотостабилизатора из-за взаимной фотодеградации?',
    promptEn: 'Which UV-filter pair suffers rapid mutual photodegradation without a photostabilizer?',
    options: [
      { id: 'a', textRu: 'Авобензон (BMDBM) + Октиноксат (EHMC)', textEn: 'Avobenzone (BMDBM) + Octinoxate (EHMC)', correct: true },
      { id: 'b', textRu: 'Uvinul A Plus + Tinosorb S', textEn: 'Uvinul A Plus + Tinosorb S', correct: false },
      { id: 'c', textRu: 'Uvinul T 150 + Октисалат', textEn: 'Uvinul T 150 + Octisalate', correct: false },
    ],
  },
  {
    id: 'ex-proc-1',
    domain: 'process',
    promptRu: 'При масштабировании крема из стакана 1 кг в реактор 1 000 кг (рост диаметра D в 10 раз) как меняется удельная поверхность теплообмена A/V?',
    promptEn: 'Scaling a cream from a 1 kg beaker to a 1,000 kg reactor (10× diameter D), how does surface-to-volume ratio A/V change?',
    options: [
      { id: 'a', textRu: 'Уменьшается в 10 раз — охлаждение резко замедляется', textEn: 'Drops 10× — cooling slows down dramatically', correct: true },
      { id: 'b', textRu: 'Растёт в 10 раз', textEn: 'Increases 10×', correct: false },
      { id: 'c', textRu: 'Остаётся неизменной при геометрическом подобии', textEn: 'Remains constant under geometric similarity', correct: false },
    ],
  },
  {
    id: 'ex-proc-2',
    domain: 'process',
    promptRu: 'В вязком креме (15 000 мПа·с) турбинная мешалка крутит продукт только в центре, а у рубашки масса стоит неподвижно. Как называется это явление и чем его устранить?',
    promptEn: 'In a viscous cream (15,000 mPa·s), a turbine only moves product near the shaft while walls stay stagnant. What is this called and how do you fix it?',
    options: [
      { id: 'a', textRu: 'Образование застойной каверны; перейти на якорную мешалку со скребками', textEn: 'Stagnant cavern formation; switch to a scraped-wall anchor impeller', correct: true },
      { id: 'b', textRu: 'Кавитация; увеличить обороты турбины втрое', textEn: 'Cavitation; triple turbine rpm', correct: false },
      { id: 'c', textRu: 'Оствальдово созревание; добавить соль', textEn: 'Ostwald ripening; add salt', correct: false },
    ],
  },
  {
    id: 'ex-proc-3',
    domain: 'process',
    promptRu: 'Нужно внести 10 % активного SLES, используя товарную 70 % пасту. Сколько килограммов пасты загрузить в партию 500 кг?',
    promptEn: 'You need 10% active SLES using 70% commercial paste. How many kg of paste must be weighed for a 500 kg batch?',
    options: [
      { id: 'a', textRu: '71,43 кг', textEn: '71.43 kg', correct: true },
      { id: 'b', textRu: '50,00 кг', textEn: '50.00 kg', correct: false },
      { id: 'c', textRu: '35,00 кг', textEn: '35.00 kg', correct: false },
    ],
  },
  {
    id: 'ex-proc-4',
    domain: 'process',
    promptRu: 'На каком этапе и при какой температуре следует вводить липосомальный комплекс активов в промышленный реактор?',
    promptEn: 'At which stage and temperature should a liposome active complex be added in a plant reactor?',
    options: [
      { id: 'a', textRu: 'В фазу C при ≤ 40 °C после окончания гомогенизации, под мягким якорным перемешиванием', textEn: 'Phase C at ≤ 40 °C after homogenization, under gentle anchor stirring', correct: true },
      { id: 'b', textRu: 'В горячую фазу A при 75 °C перед ротор-статором', textEn: 'Hot Phase A at 75 °C before rotor-stator', correct: false },
      { id: 'c', textRu: 'В масляную фазу B при 80 °C вместе с восками', textEn: 'Oil Phase B at 80 °C with waxes', correct: false },
    ],
  },
  {
    id: 'ex-proc-5',
    domain: 'process',
    promptRu: 'Почему вакуумирование крема при температуре 75 °C на глубоком вакууме −0,95 бар опасно?',
    promptEn: 'Why is pulling deep vacuum (−0.95 bar gauge) on a cream at 75 °C hazardous?',
    options: [
      { id: 'a', textRu: 'Вода бурно закипит (P_насыщ(75 °C) ≈ 0,39 бар > 0,06 бар абс.), вспенив и обезводив партию', textEn: 'Water flashes into violent boiling (P_sat ≈ 0.39 bar > 0.06 bar abs), foaming and dehydrating the batch', correct: true },
      { id: 'b', textRu: 'Вода замёрзнет на стенках реактора', textEn: 'Water freezes on reactor walls', correct: false },
      { id: 'c', textRu: 'Силикон превратится в твёрдый кварц', textEn: 'Silicone turns into solid quartz', correct: false },
    ],
  },
  {
    id: 'ex-qa-1',
    domain: 'qa',
    promptRu: 'Какой максимальный предел концентрации Retinol установлен Регламентом EU 2024/996 для крема для лица и для лосьона для тела?',
    promptEn: 'What are the EU 2024/996 maximum Retinol limits for face cream vs body lotion?',
    options: [
      { id: 'a', textRu: '0,3 % RE (лицо) и 0,05 % RE (тело)', textEn: '0.3% RE (face) and 0.05% RE (body)', correct: true },
      { id: 'b', textRu: '1,0 % для всех категорий без ограничений', textEn: '1.0% for all categories without restriction', correct: false },
      { id: 'c', textRu: '0,5 % (тело) и 0,05 % (лицо)', textEn: '0.5% (body) and 0.05% (face)', correct: false },
    ],
  },
  {
    id: 'ex-qa-2',
    domain: 'qa',
    promptRu: 'Отдушка введена в несмываемый крем в доле 0,5 %, а сертификат указывает 1,0 % Linalyl Acetate в отдушке. Нужно ли выносить Linalyl Acetate в INCI по EU 2023/1545?',
    promptEn: 'A leave-on cream uses 0.5% fragrance containing 1.0% Linalyl Acetate. Must Linalyl Acetate be declared in INCI under EU 2023/1545?',
    options: [
      { id: 'a', textRu: 'Да: 0,5 % × 1,0 % = 0,005 % ≥ порога 0,001 % для leave-on', textEn: 'Yes: 0.5% × 1.0% = 0.005% ≥ 0.001% leave-on threshold', correct: true },
      { id: 'b', textRu: 'Нет: порог для несмываемых средств равен 0,1 %', textEn: 'No: leave-on threshold is 0.1%', correct: false },
      { id: 'c', textRu: 'Нет: Linalyl Acetate не входит в список 82 аллергенов', textEn: 'No: Linalyl Acetate is not among the 82 allergens', correct: false },
    ],
  },
  {
    id: 'ex-qa-3',
    domain: 'qa',
    promptRu: 'Какое минимальное значение запаса безопасности MoS = NOAEL / SED требуется по SCCS Notes of Guidance для положительного заключения CPSR?',
    promptEn: 'What minimum Margin of Safety (MoS = NOAEL / SED) is required by SCCS Notes of Guidance for a positive CPSR?',
    options: [
      { id: 'a', textRu: 'MoS ≥ 100', textEn: 'MoS ≥ 100', correct: true },
      { id: 'b', textRu: 'MoS ≥ 10', textEn: 'MoS ≥ 10', correct: false },
      { id: 'c', textRu: 'MoS ≥ 1', textEn: 'MoS ≥ 1', correct: false },
    ],
  },
  {
    id: 'ex-qa-4',
    domain: 'qa',
    promptRu: 'Рецептура содержит 80 % воды (NOI=1), 10 % C13-15 Alkane (NOI=1) и 10 % синтетических полимеров/УФ (NOI=0). Чему равен индекс ISO 16128 с водой и без воды?',
    promptEn: 'A formula contains 80% water (NOI=1), 10% C13-15 Alkane (NOI=1), and 10% synthetic ingredients (NOI=0). What is ISO 16128 NOI with water vs without water?',
    options: [
      { id: 'a', textRu: '90 % (с водой) и 50 % (без воды)', textEn: '90% (with water) and 50% (without water)', correct: true },
      { id: 'b', textRu: '50 % (с водой) и 90 % (без воды)', textEn: '50% (with water) and 90% (without water)', correct: false },
      { id: 'c', textRu: '100 % в обоих вариантах', textEn: '100% in both cases', correct: false },
    ],
  },
  {
    id: 'ex-qa-5',
    domain: 'qa',
    promptRu: 'Почему крем с 0,5 % Sodium Benzoate (pKa = 4,2) при pH 6,5 провалил тест эффективности консервирования ISO 11930?',
    promptEn: 'Why did a cream with 0.5% Sodium Benzoate (pKa = 4.2) at pH 6.5 fail ISO 11930 challenge testing?',
    options: [
      { id: 'a', textRu: 'При pH 6,5 доля активной недиссоциированной бензойной кислоты падает ниже 1 %', textEn: 'At pH 6.5 the active undissociated benzoic acid fraction drops below 1%', correct: true },
      { id: 'b', textRu: 'Бензоат натрия нерастворим в воде при pH 6,5', textEn: 'Sodium benzoate is insoluble in water at pH 6.5', correct: false },
      { id: 'c', textRu: 'ISO 11930 запрещает бензоат натрия', textEn: 'ISO 11930 bans sodium benzoate', correct: false },
    ],
  },
]

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function toB64Url(json: string): string {
  const bytes = new TextEncoder().encode(json)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64Url(token: string): string | null {
  try {
    const pad = token.length % 4 ? '='.repeat(4 - (token.length % 4)) : ''
    const bin = atob(token.replace(/-/g, '+').replace(/_/g, '/') + pad)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

function checksum(s: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x1b873593
  for (let i = 0; i < s.length; i++) {
    h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619)
    h2 = Math.imul(h2 + s.charCodeAt(i), 0x85ebca6b) ^ (h2 >>> 13)
  }
  return ((h1 >>> 0).toString(36).slice(0, 4) + (h2 >>> 0).toString(36).slice(0, 4)).toUpperCase()
}

export function encodeExamConfig(cfg: ExamConfig): string {
  return toB64Url(JSON.stringify(cfg))
}

export function decodeExamConfig(token: string): ExamConfig | null {
  const raw = fromB64Url(token)
  if (!raw) return null
  try {
    const o = JSON.parse(raw)
    if (!o || typeof o !== 'object') return null
    const track: ExamTrack = ['full', 'rnd', 'process', 'qa'].includes(o.track) ? o.track : 'full'
    return {
      org: String(o.org ?? 'Faza Assessment').slice(0, 80),
      role: String(o.role ?? 'Cosmetic Chemist').slice(0, 80),
      track,
      seed: Math.max(1, Math.min(999999, Number(o.seed) || 2026)),
      count: Math.max(5, Math.min(12, Number(o.count) || 8)),
      minutes: Math.max(5, Math.min(60, Number(o.minutes) || 15)),
    }
  } catch {
    return null
  }
}

/** Детерминированно формирует билет и перемешивает варианты ответа по фиксированному seed. */
export function buildExamQuestions(cfg: ExamConfig): ExamQuestion[] {
  const rng = mulberry32(cfg.seed)
  const primary = cfg.track === 'full' ? [...EXAM_BANK] : EXAM_BANK.filter((q) => q.domain === cfg.track)
  const fallback = cfg.track === 'full' ? [] : EXAM_BANK.filter((q) => q.domain !== cfg.track)

  const shuffle = <T,>(arr: T[]) => {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  const pool = [...shuffle(primary), ...shuffle(fallback)].slice(0, Math.min(cfg.count, EXAM_BANK.length))
  return pool.map((q) => ({
    ...q,
    options: shuffle(q.options),
  }))
}

export function buildSignedExamResult(
  cfg: ExamConfig,
  candidate: string,
  questions: ExamQuestion[],
  answers: Record<string, string>,
  elapsedSec: number,
): ExamResultPayload {
  let correct = 0
  const domTot = { rnd: 0, process: 0, qa: 0 }
  const domOk = { rnd: 0, process: 0, qa: 0 }

  for (const q of questions) {
    domTot[q.domain]++
    const picked = answers[q.id]
    if (q.options.some((o) => o.id === picked && o.correct)) {
      correct++
      domOk[q.domain]++
    }
  }

  const total = questions.length
  const score = total > 0 ? Math.round((correct / total) * 100) : 0
  const domainPct = {
    rnd: domTot.rnd ? Math.round((domOk.rnd / domTot.rnd) * 100) : 100,
    process: domTot.process ? Math.round((domOk.process / domTot.process) * 100) : 100,
    qa: domTot.qa ? Math.round((domOk.qa / domTot.qa) * 100) : 100,
  }
  const date = new Date().toISOString().slice(0, 10)
  const base = {
    v: 1 as const,
    org: cfg.org,
    role: cfg.role,
    candidate: candidate.trim().slice(0, 80) || 'Candidate',
    track: cfg.track,
    seed: cfg.seed,
    score,
    correct,
    total,
    elapsedSec: Math.max(1, Math.round(elapsedSec)),
    domainPct,
    date,
  }
  const sig = checksum(JSON.stringify(base))
  return { ...base, sig }
}

export function encodeExamResult(payload: ExamResultPayload): string {
  return `FAZA-EXAM-${toB64Url(JSON.stringify(payload))}`
}

export function decodeExamResult(code: string): { valid: boolean; payload: ExamResultPayload } | null {
  const clean = code.trim().replace(/^.*result=/i, '').replace(/^FAZA-EXAM-/i, '')
  const raw = fromB64Url(clean)
  if (!raw) return null
  try {
    const p = JSON.parse(raw) as ExamResultPayload
    if (!p || p.v !== 1 || typeof p.sig !== 'string') return null
    const { sig, ...base } = p
    const expected = checksum(JSON.stringify(base))
    return { valid: sig === expected, payload: p }
  } catch {
    return null
  }
}
