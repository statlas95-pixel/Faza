import { tr } from './locale'

export interface NightShiftTelemetry {
  label: string
  value: string
  status: 'ok' | 'warn' | 'crit'
}

export interface NightShiftOption {
  id: string
  text: string
  verdict: 'ok' | 'partial' | 'bad'
  costRub: number
  qualityDelta: number
  minutes: number
  explain: string
}

export interface NightShiftCause {
  id: string
  text: string
  correct: boolean
  why: string
}

export interface NightShiftIncident {
  id: string
  code: string
  reactor: string
  batchKg: number
  product: string
  title: string
  alarm: string
  report: string
  telemetry: NightShiftTelemetry[]
  causes: NightShiftCause[]
  actions: NightShiftOption[]
  topicId: string
}

export interface NightShiftDecision {
  incidentId: string
  causeId: string
  actionId: string
}

export interface NightShiftResult {
  score: number
  budgetLeft: number
  totalCostRub: number
  qualityIndex: number
  downtimeMinutes: number
  causesRight: number
  optimalActions: number
  grade: 'saved' | 'partial' | 'scrap'
  details: {
    incidentId: string
    causeOk: boolean
    actionVerdict: 'ok' | 'partial' | 'bad'
    costRub: number
    qualityDelta: number
    minutes: number
  }[]
}

export const INITIAL_SHIFT_BUDGET_RUB = 150000
export const TARGET_SHIFT_SLA_MINUTES = 120

/** Детерминированный ГПСЧ (Mulberry32) для воспроизводимых генераций ночной смены. */
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

export function getNightShiftPool(): NightShiftIncident[] {
  return [
    {
      id: 'sles-oversalt',
      code: 'AL-01',
      reactor: 'R-102',
      batchKg: 1500,
      product: tr('Гель для душа SLES / CAPB'),
      title: tr('Обвал вязкости шампуня после ввода расчётной соли'),
      alarm: tr('Вязкость упала с 6 500 до 420 мПа·с при добавлении 1,8 % NaCl'),
      report: tr('Оператор ночной смены засыпал 1,8 % NaCl по техкарте, но новая партия SLES 28 % по CoA уже содержала 0,9 % собственного хлорида натрия. Раствор стал мутнеть и текучим как вода.'),
      telemetry: [
        { label: tr('Вязкость (25 °C)'), value: '420 mPa·s', status: 'crit' },
        { label: tr('Суммарный NaCl'), value: '2.7 %', status: 'crit' },
        { label: tr('pH партии'), value: '5.4', status: 'ok' },
      ],
      causes: [
        {
          id: 'right-slope',
          text: tr('Суммарный NaCl перешёл максимум солевой кривой — червеобразные мицеллы разветвились и потеряли вязкость'),
          correct: true,
          why: tr('Верно: собственная соль из SLES 28 % суммировалась с добавкой и перебросила систему на правый спадающий склон солевой кривой.'),
        },
        {
          id: 'low-salt',
          text: tr('Соли ещё недостаточно — система не дошла до порога формирования мицелл'),
          correct: false,
          why: tr('Нет: при 2,7 % суммарного NaCl для типовой пары SLES/CAPB система давно за пиком кривой; дополнительная соль лишь ускорит высаливание.'),
        },
        {
          id: 'ph-drift',
          text: tr('Слишком низкий pH вызвал кислотный гидролиз SLES за 15 минут'),
          correct: false,
          why: tr('Гидролиз алкилэфирсульфатов критичен при pH < 4 и высокой температуре, а здесь pH 5,4 — штатная норма.'),
        },
      ],
      actions: [
        {
          id: 'dilute-surfactant',
          text: tr('Разбавить партию расчётным концентратом SLES + CAPB без соли, вернув суммарный NaCl на левый склон кривой'),
          verdict: 'ok',
          costRub: 38000,
          qualityDelta: -2,
          minutes: 22,
          explain: tr('Единственный технологически чистый способ вернуть реологию: снижение концентрации электролита возвращает систему к пику вязкости без нарушения спецификации.'),
        },
        {
          id: 'add-peg150',
          text: tr('Доввести 1,2 % PEG-150 Distearate при 65 °C и пересогласовать состав партии'),
          verdict: 'partial',
          costRub: 92000,
          qualityDelta: -14,
          minutes: 50,
          explain: tr('Полимерный загуститель частично поднимет вязкость, но требует нагрева, меняет этикетку INCI и удорожает партию.'),
        },
        {
          id: 'add-more-salt',
          text: tr('Досыпать ещё 0,5 % NaCl для «дозагущения» геля'),
          verdict: 'bad',
          costRub: 340000,
          qualityDelta: -52,
          minutes: 18,
          explain: tr('Критическая ошибка: на правом склоне добавка соли вызывает необратимое высаливание и расслоение ПАВ — партия уходит в брак.'),
        },
      ],
      topicId: 'surfactant-thickening',
    },
    {
      id: 'vacuum-seal-leak',
      code: 'AL-02',
      reactor: 'VR-204',
      batchKg: 800,
      product: tr('Питательный ламеллярный крем O/W'),
      title: tr('Падение вакуума и аэрация эмульсии в разгар гомогенизации'),
      alarm: tr('Вакуум сорвался с −0,85 до −0,12 бар; плотность крема упала до 0,76 г/см³'),
      report: tr('При 66 °C на гомогенизаторе появился характерный свист, уровень массы в смотровом окне поднялся на 18 %, в пробе масса воздушных микропузырьков.'),
      telemetry: [
        { label: tr('Вакуум в реакторе'), value: '−0.12 bar', status: 'crit' },
        { label: tr('Плотность пробы'), value: '0.76 g/cm³', status: 'crit' },
        { label: tr('Температура'), value: '66 °C', status: 'warn' },
      ],
      causes: [
        {
          id: 'seal-air',
          text: tr('Подсос воздуха через торцевое уплотнение / штуцер при работающем ротор-статоре диспергировал газ в вязкой фазе'),
          correct: true,
          why: tr('Верно: при падении вакуума работающий на высоких оборотах ротор-статор превращает подсосанный воздух в стойкую пену из микропузырьков.'),
        },
        {
          id: 'water-boil',
          text: tr('Вода в эмульсии закипела из-за чрезмерного вакуума'),
          correct: false,
          why: tr('При 66 °C вода кипит около 0,26 бар абс. (−0,74 бар манометрич.), а здесь вакуум наоборот упал до −0,12 бар, то есть давление близко к атмосферному.'),
        },
        {
          id: 'hlb-error',
          text: tr('Неверный ГЛБ эмульгатора вызвал мгновенное выделение газа'),
          correct: false,
          why: tr('Ошибки ГЛБ вызывают коалесценцию и расслоение, но не падение вакуума и не резкое снижение плотности на 22 %.'),
        },
      ],
      actions: [
        {
          id: 'stop-homo-vacuum',
          text: tr('Немедленно отключить ротор-статор, подтянуть/переключить уплотнение, деаэрировать на тихоходной якорной мешалке при −0,85 бар до остывания ниже 45 °C'),
          verdict: 'ok',
          costRub: 20000,
          qualityDelta: -3,
          minutes: 26,
          explain: tr('Пока вязкость при 60–65 °C ещё невысока, остановка сдвига и мягкая деаэрация под вакуумом позволяют вывести пузырьки без разрушения ламеллярной сети.'),
        },
        {
          id: 'overfill-jars',
          text: tr('Продолжить охлаждение как есть и фасовать тубы с увеличенным объёмом на 15 %'),
          verdict: 'partial',
          costRub: 105000,
          qualityDelta: -24,
          minutes: 15,
          explain: tr('Воздух внутри крема даст усадку уровня в тубах через неделю, недовес нетто и ускорит окисление масел.'),
        },
        {
          id: 'max-rotor',
          text: tr('Поднять обороты гомогенизатора до максимума, чтобы «измельчить и растворить» воздух'),
          verdict: 'bad',
          costRub: 390000,
          qualityDelta: -48,
          minutes: 14,
          explain: tr('Рост сдвига при утечке лишь затягивает больше воздуха и дробит пузырьки до микрон — их уже невозможно удалить вакуумом.'),
        },
      ],
      topicId: 'deaeration',
    },
    {
      id: 'jacket-valve-stuck',
      code: 'AL-03',
      reactor: 'VR-301',
      batchKg: 1000,
      product: tr('Ночной антивозрастной крем с ретинолом'),
      title: tr('Заклинил клапан охлаждающей рубашки при 62 °C'),
      alarm: tr('Температура массы стоит на 62 °C уже 35 минут; фаза C с ретинолом и отдушкой ждёт ввода'),
      report: tr('Привод клапана гликолевой рубашки вышел в аварию. До конца смены осталось 1,5 часа, начальник цеха просит «ускориться и не держать линию».'),
      telemetry: [
        { label: tr('Температура массы'), value: '62 °C', status: 'crit' },
        { label: tr('Расход хладагента'), value: '0 m³/h', status: 'crit' },
        { label: tr('Порог фазы C'), value: '≤ 38 °C', status: 'warn' },
      ],
      causes: [
        {
          id: 'heat-crystallization',
          text: tr('Остановка теплоотвода затягивает прохождение зоны кристаллизации жирных спиртов (55→35 °C) и делает ввод термолабильной фазы C недопустимым'),
          correct: true,
          why: tr('Верно: при 62 °C ретинол и летучие терпены отдушки разрушатся/улетят, а нарушение профиля охлаждения изменит ламеллярную текстуру.'),
        },
        {
          id: 'mixer-heat',
          text: tr('Якорная мешалка на 25 об/мин сама разогревает 1000 кг крема на 20 °C'),
          correct: false,
          why: tr('На 25 об/мин диссипация энергии мала; главная проблема — нулевой отвод тепла через рубашку.'),
        },
        {
          id: 'emulsifier-melt',
          text: tr('Эмульгатор затвердел при 62 °C и перекрыл рубашку'),
          correct: false,
          why: tr('Большинство жирных спиртов кристаллизуются при 48–55 °C, а в телеметрии прямо указан нулевой расход хладагента.'),
        },
      ],
      actions: [
        {
          id: 'bypass-exchanger',
          text: tr('Перевести охлаждение на байпасный ручной клапан / выносной теплообменник, выдержать градиент 0,5–1 °C/мин и ввести фазу C строго ниже 38 °C'),
          verdict: 'ok',
          costRub: 24000,
          qualityDelta: -2,
          minutes: 30,
          explain: tr('Сохраняется и профиль кристаллизации ламеллярной фазы, и активность ретинола с сохранностью отдушки.'),
        },
        {
          id: 'natural-cool',
          text: tr('Оставить реактор остывать естественным путём 4 часа с периодическим перемешиванием'),
          verdict: 'partial',
          costRub: 82000,
          qualityDelta: -14,
          minutes: 62,
          explain: tr('Сверхмедленное остывание крупной партии укрупняет кристаллы восков и срывает график следующей смены.'),
        },
        {
          id: 'hot-phase-c',
          text: tr('Ввести ретинол, отдушку и консервант при 58 °C, чтобы успеть сдать смену'),
          verdict: 'bad',
          costRub: 510000,
          qualityDelta: -54,
          minutes: 10,
          explain: tr('Термодеградация ретинола и испарение верхних нот отдушки: партия не пройдёт количественный анализ актива и уйдёт в утилизацию.'),
        },
      ],
      topicId: 'heat-transfer',
    },
    {
      id: 'carbomer-electrolyte-collapse',
      code: 'AL-04',
      reactor: 'M-108',
      batchKg: 500,
      product: tr('Увлажняющий гель-сыворотка на карбомере'),
      title: tr('Мгновенное разжижение геля при вводе комплекса Na-PCA и Zn-PCA'),
      alarm: tr('Вязкость рухнула с 18 000 до 190 мПа·с за 2 минуты после ввода активов'),
      report: tr('Прозрачная база на Carbomer 0,5 % (pH 6,2) идеально держала форму. После загрузки водного комплекса с солями Na-PCA 2 % и Zn-PCA 0,5 % гель превратился в воду.'),
      telemetry: [
        { label: tr('Вязкость'), value: '190 mPa·s', status: 'crit' },
        { label: tr('Ионная сила (I)'), value: '0.24 M', status: 'crit' },
        { label: tr('pH геля'), value: '6.0', status: 'ok' },
      ],
      causes: [
        {
          id: 'polyelectrolyte-collapse',
          text: tr('Полиэлектролитный коллапс карбомера: ионы Na⁺ и особенно двухвалентный Zn²⁺ сжали двойной электрический слой и свернули цепи полиакрилата'),
          correct: true,
          why: tr('Верно: нейтрализованный карбомер держит вязкость за счёт электростатического отталкивания −COO⁻ групп; электролиты и тем более Zn²⁺ мгновенно экранируют заряд.'),
        },
        {
          id: 'microbial-attack',
          text: tr('Ферменты бактерий расщепили полимер за 2 минуты'),
          correct: false,
          why: tr('Биодеградация полимеров развивается сутками, а мгновенный обвал на вводе солей — классический коллоидный эффект ионной силы.'),
        },
        {
          id: 'low-shear',
          text: tr('Недостаточная скорость мешалки не дала активу раствориться'),
          correct: false,
          why: tr('Соли PCA водорастворимы и мгновенно продиффундировали — именно их ионы и разрушили сетку карбомера.'),
        },
      ],
      actions: [
        {
          id: 'quarantine-switch-polymer',
          text: tr('Остановить розлив, перевести партию в карантин MRB, оформить технологическое отклонение и согласовать солеустойчивый полимер (ксантан / HEC / склероглюкан)'),
          verdict: 'ok',
          costRub: 48000,
          qualityDelta: -4,
          minutes: 28,
          explain: tr('Единственно верный GMP-подход: карбомер физико-химически несовместим с 2,5 % солей Zn/Na-PCA, нужна смена загустителя по процедуре Change Control.'),
        },
        {
          id: 'add-tea',
          text: tr('Долить 0,4 % триэтаноламина до pH 7,8 в попытке «донакачать» карбомер'),
          verdict: 'partial',
          costRub: 160000,
          qualityDelta: -28,
          minutes: 16,
          explain: tr('При высокой ионной силе избыток щёлочи сам добавляет электролиты и лишь уводит pH за пределы комфорта кожи.'),
        },
        {
          id: 'dry-dump-carbomer',
          text: tr('Засыпать ещё 0,6 % сухого карбомера прямо в холодную жидкую партию'),
          verdict: 'bad',
          costRub: 430000,
          qualityDelta: -50,
          minutes: 24,
          explain: tr('Сухая засыпка в готовую среду с солями образует нерастворимые «рыбьи глаза» и комки, полностью портя партию.'),
        },
      ],
      topicId: 'polymer-thickeners',
    },
    {
      id: 'wpu-dead-leg-cfu',
      code: 'AL-05',
      reactor: 'WPU Loop · Valve #4',
      batchKg: 2000,
      product: tr('Вода очищенная для партии мицеллярной воды'),
      title: tr('Скачок микробиологии (420 КОЕ/мл) на точке отбора № 4 перед загрузкой'),
      alarm: tr('Точка № 4: 420 КОЕ/мл (лимит ≤ 100); точки № 1–3 < 5 КОЕ/мл; проводимость 1,1 мкСм/см'),
      report: tr('Лаборатория ОКК прислала срочный результат экспресс-контроля перед набором 1600 кг воды в реактор. Главная петля держит скорость 1,4 м/с и нормальную электропроводность.'),
      telemetry: [
        { label: tr('Точка № 4 (КОЕ)'), value: '420 CFU/mL', status: 'crit' },
        { label: tr('Точки № 1–3 (КОЕ)'), value: '< 5 CFU/mL', status: 'ok' },
        { label: tr('Проводимость'), value: '1.1 μS/cm', status: 'ok' },
      ],
      causes: [
        {
          id: 'dead-leg-biofilm',
          text: tr('Локальная биоплёнка в застойном отводе / изношенной мембране клапана точки № 4 при чистой магистральной петле'),
          correct: true,
          why: tr('Верно: низкая проводимость и чистота точек 1–3 исключают пробой мембран RO; проблема локализована именно в узле точки № 4.'),
        },
        {
          id: 'ro-membrane-tear',
          text: tr('Прорвалась мембрана обратного осмоса во всей системе водоподготовки'),
          correct: false,
          why: tr('При прорыве RO резко выросла бы электропроводность (соли) и микробный фон во всех точках 1–4 одновременно.'),
        },
        {
          id: 'lab-artifact-ignore',
          text: tr('Проводимость 1,1 мкСм/см гарантирует стерильность — анализ КОЕ можно игнорировать'),
          correct: false,
          why: tr('Опасное заблуждение: проводимость измеряет только ионы, а не бактерии и биоплёнки!'),
        },
      ],
      actions: [
        {
          id: 'isolate-valve4',
          text: tr('Заблокировать точку № 4 (Lock-Out), набрать воду из проверенной точки № 2, назначить термическую санитизацию (> 80 °C) и замену мембраны клапана № 4'),
          verdict: 'ok',
          costRub: 22000,
          qualityDelta: -1,
          minutes: 20,
          explain: tr('Идеальная реакция по ISO 22716: контаминированный узел изолирован, партия спасена чистой водой, запущена корневая санитизация.'),
        },
        {
          id: 'flush-and-load',
          text: tr('Слить 200 л воды из точки № 4 в дренаж и сразу начать набор в реактор'),
          verdict: 'partial',
          costRub: 148000,
          qualityDelta: -32,
          minutes: 12,
          explain: tr('Слив не удаляет биоплёнку со стенок клапана — фрагменты продолжат отрываться в партию мицеллярной воды.'),
        },
        {
          id: 'double-phenoxy',
          text: tr('Набрать воду из точки № 4 и удвоить дозу феноксиэтанола до 2,0 % в рецептуре'),
          verdict: 'bad',
          costRub: 560000,
          qualityDelta: -60,
          minutes: 10,
          explain: tr('Прямое нарушение закона: лимит Phenoxyethanol по ТР ТС 009/2011 и EU 1223/2009 строго ≤ 1,0 %; к тому же консерванты не «лечат» грязную воду.'),
        },
      ],
      topicId: 'water-sanitation',
    },
    {
      id: 'coa-peroxide-spike',
      code: 'AL-06',
      reactor: 'B-05',
      batchKg: 800,
      product: tr('Восстанавливающий масляный эликсир / крем'),
      title: tr('Скрытый всплеск перекисного числа (PV = 18 мэкв/кг) у масла виноградной косточки'),
      alarm: tr('Экспресс-титрование перед загрузкой: PV = 18,4 мэкв/кг при лимите спецификации ≤ 5,0'),
      report: tr('Новая бочка масла виноградной косточки пришла с «красивым» CoA от дистрибьютора (PV 1,8 полгода назад), но хранилась с негерметичной пробкой. От масла ощущается лёгкий травянисто-олифовый тон.'),
      telemetry: [
        { label: tr('Перекисное число (PV)'), value: '18.4 meq/kg', status: 'crit' },
        { label: tr('Лимит спецификации'), value: '≤ 5.0 meq/kg', status: 'warn' },
        { label: tr('Доля масла в фазе B'), value: '12.0 %', status: 'warn' },
      ],
      causes: [
        {
          id: 'pufa-autoxidation',
          text: tr('Запущено цепное радикальное автоокисление ПНЖК (линолевой кислоты) — накопленные гидропероксиды прогоркнут всю партию за 2–4 недели'),
          correct: true,
          why: tr('Верно: масло виноградной косточки богато линолевой кислотой (до 70 %); высокий PV означает активную фазу радикальной цепи.'),
        },
        {
          id: 'normal-color',
          text: tr('Повышенный PV — нормальный признак свежего нерафинированного масла'),
          correct: false,
          why: tr('Напротив, PV > 10 мэкв/кг — верный маркер окислительной порчи и будущего альдегидного прогоркания.'),
        },
        {
          id: 'water-trace',
          text: tr('В масло просто попал конденсат воды — перекиси тут ни при чём'),
          correct: false,
          why: tr('Йодометрическое титрование PV количественно фиксирует именно гидропероксиды липидов, а не влагу.'),
        },
      ],
      actions: [
        {
          id: 'quarantine-backup-lot',
          text: tr('Перевести бочку в красный карантин (MRB), взять резервную аттестованную партию масла (PV ≤ 2) и усилить защиту связкой токоферол + хелатор'),
          verdict: 'ok',
          costRub: 34000,
          qualityDelta: -1,
          minutes: 24,
          explain: tr('Сырьё с активными пероксидами нельзя «вылечить» в партии — своевременная замена спасает всю серию на 24 месяца срока годности.'),
        },
        {
          id: 'mask-fragrance',
          text: tr('Использовать масло и поднять ввод отдушки на +0,3 %, чтобы скрыть запах'),
          verdict: 'partial',
          costRub: 210000,
          qualityDelta: -36,
          minutes: 12,
          explain: tr('Через месяц вторичные альдегиды пробьют любую отдушку, изменят цвет крема и приведут к массовому возврату партии.'),
        },
        {
          id: 'heat-95c',
          text: tr('Прогреть масло до 95 °C на 30 минут, чтобы «выпарить» перекиси'),
          verdict: 'bad',
          costRub: 480000,
          qualityDelta: -58,
          minutes: 32,
          explain: tr('Нагрев резко ускоряет распад гидропероксидов на свободные радикалы и летучие альдегиды — масло прогоркает лавинообразно.'),
        },
      ],
      topicId: 'oil-oxidation',
    },
    {
      id: 'organic-acid-high-ph',
      code: 'AL-07',
      reactor: 'VR-105',
      batchKg: 600,
      product: tr('Крем с мочевиной 5 % и бензоатом/сорбатом'),
      title: tr('Дрейф pH готовой партии до 6,7 на консервации органическими кислотами'),
      alarm: tr('Финальный pH = 6,7; система консервации — Sodium Benzoate 0,4 % + Potassium Sorbate 0,2 %'),
      report: tr('После ввода мочевины и аргинина pH крема ушёл в нейтральную зону. Партия готова к перекачке в накопитель фасовки.'),
      telemetry: [
        { label: tr('Текущий pH'), value: '6.7', status: 'crit' },
        { label: tr('Активная форма HA'), value: '< 1.2 %', status: 'crit' },
        { label: tr('Целевой pH'), value: '5.2–5.5', status: 'warn' },
      ],
      causes: [
        {
          id: 'dissociated-acids',
          text: tr('По уравнению Гендерсона — Хассельбальха при pH 6,7 более 98 % бензойной (pKa 4,2) и сорбиновой (pKa 4,76) кислот диссоциированы — консервант не работает'),
          correct: true,
          why: tr('Верно: антимикробным действием обладает только недиссоциированная молекула HA, проходящая через мембрану микроорганизмов.'),
        },
        {
          id: 'acid-evaporation',
          text: tr('Консервант испарился в вакууме, так как температура была 35 °C'),
          correct: false,
          why: tr('Соли бензоата и сорбата нелетучи; потеря эффективности связана исключительно с pH-зависимым равновесием.'),
        },
        {
          id: 'safe-ph',
          text: tr('pH 6,7 нейтрален и комфортен для кожи — для консерванта это не проблема'),
          correct: false,
          why: tr('Для кожи pH 6,7 приемлем, но консервирующая пара на органических кислотах полностью «выключается» выше pH 5,8.'),
        },
      ],
      actions: [
        {
          id: 'adjust-ph-buffer',
          text: tr('Медленно скорректировать pH 10 %-м раствором молочной кислоты при работающей мешалке до 5,2–5,4 с цитратным/лактатным буфером (учитывая буфер мочевины) и перепроверить вязкость'),
          verdict: 'ok',
          costRub: 16000,
          qualityDelta: -2,
          minutes: 20,
          explain: tr('Корректное снижение pH разбавленным раствором кислоты восстанавливает активную форму консерванта и стабилизирует мочевину от гидролиза.'),
        },
        {
          id: 'release-check-cfu',
          text: tr('Оставить pH 6,7 и выпустить партию, если стартовый посев КОЕ окажется < 10'),
          verdict: 'partial',
          costRub: 190000,
          qualityDelta: -34,
          minutes: 10,
          explain: tr('Чистый стартовый посев не защищает продукт в руках покупателя: партия провалит Challenge-тест ISO 11930 и зацветёт в банке.'),
        },
        {
          id: 'dump-50pct-acid',
          text: tr('Влить 50 %-ю лимонную кислоту залпом без мешалки для экономии времени'),
          verdict: 'bad',
          costRub: 350000,
          qualityDelta: -46,
          minutes: 10,
          explain: tr('Локальный pH < 2 в точке залива коагулирует анионный эмульгатор и даёт творожистые сгустки по всей массе.'),
        },
      ],
      topicId: 'preservation',
    },
    {
      id: 'pigment-hegman-agglomerates',
      code: 'AL-08',
      reactor: 'D-201',
      batchKg: 400,
      product: tr('Тональный флюид SPF 30 с оксидами железа'),
      title: tr('Крупинки > 45 мкм на клине Хегмана и «проявление полос» при нанесении'),
      alarm: tr('Клин Хегмана: штрихи с 48 мкм (норма < 15 мкм); оттенок «краснеет» при растирании'),
      report: tr('После 20 минут на обычной фрезе-диссольвере тон выглядит однородным в стакане, но на коже и клине Хегмана тянутся красные и жёлтые полосы пигмента.'),
      telemetry: [
        { label: tr('Клин Хегмана'), value: '48 μm', status: 'crit' },
        { label: tr('Спецификация'), value: '< 15 μm', status: 'warn' },
        { label: tr('ΔE при растирании'), value: '2.9', status: 'crit' },
      ],
      causes: [
        {
          id: 'pigment-agglomerates',
          text: tr('Недодиспергированные агломераты оксидов железа: при сдвиге на коже они дотираются и дают эффект «color development»'),
          correct: true,
          why: tr('Верно: обычный диссольвер смачивает порошок, но не создаёт достаточных касательных напряжений для разрушения плотных агломератов оксидов железа.'),
        },
        {
          id: 'pigment-dissolve',
          text: tr('Оксиды железа не растворились в воде — нужно дольше греть партию'),
          correct: false,
          why: tr('Минеральные пигменты нерастворимы ни в воде, ни в масле — их не растворяют, а диспергируют механическим сдвигом.'),
        },
        {
          id: 'spf-precipitate',
          text: tr('Выпал в осадок водорастворимый глицерин'),
          correct: false,
          why: tr('Глицерин полностью смешивается с водой; цветные штрихи на клине Хегмана однозначно указывают на агломераты пигмента.'),
        },
      ],
      actions: [
        {
          id: 'mill-cycle',
          text: tr('Пропустить пигментную фазу через бисерную/трёхвалковую мельницу (или высокосдвиговой ротор-статор) до гринда < 15 мкм с контролем ΔE'),
          verdict: 'ok',
          costRub: 32000,
          qualityDelta: -3,
          minutes: 34,
          explain: tr('Механическое измельчение агломератов стабилизирует оттенок, убирает крупинки и выравнивает УФ-защиту TiO₂.'),
        },
        {
          id: 'strain-100um',
          text: tr('Процедить флюид через сетку 100 мкм и отправить на фасовку'),
          verdict: 'partial',
          costRub: 155000,
          qualityDelta: -26,
          minutes: 20,
          explain: tr('Агломераты 45 мкм пройдут сквозь сетку 100 мкм, а более крупные забьют фильтр и уведут оттенок всей партии.'),
        },
        {
          id: 'dilute-water-5pct',
          text: tr('Долить 5 % воды, чтобы снизить вязкость и «размыть» полосы'),
          verdict: 'bad',
          costRub: 390000,
          qualityDelta: -48,
          minutes: 15,
          explain: tr('Разбавление нарушит баланс фаз, спровоцирует быстрое оседание тяжёлых пигментов и срыв SPF.'),
        },
      ],
      topicId: 'pigment-dispersions',
    },
    {
      id: 'centrifugal-pump-shear',
      code: 'AL-09',
      reactor: 'Line P-03 → Filler',
      batchKg: 1200,
      product: tr('Бальзам для тела (ламеллярная гель-сеть)'),
      title: tr('Срыв вязкости вдвое при перекачке крема из реактора на фасовку'),
      alarm: tr('В реакторе: 24 000 мПа·с; в бункере фасовки после перекачки: 7 200 мПа·с + микропузырьки'),
      report: tr('Ночная бригада подключила к выгрузке высокооборотный центробежный насос (2900 об/мин), оставшийся с линии тоников. После 15 м шланга крем стал жидким и матовым.'),
      telemetry: [
        { label: tr('Вязкость в реакторе'), value: '24 000 mPa·s', status: 'ok' },
        { label: tr('Вязкость в бункере'), value: '7 200 mPa·s', status: 'crit' },
        { label: tr('Обороты насоса'), value: '2900 rpm', status: 'crit' },
      ],
      causes: [
        {
          id: 'centrifugal-shear',
          text: tr('Высокий сдвиг и кавитация в центробежном насосе разрушили хрупкую ламеллярную сетку и подсосали воздух'),
          correct: true,
          why: tr('Верно: центробежные насосы подходят для маловязких жидкостей; вязкие структурированные кремы требуют объёмных (кулачковых, винтовых или мембранных) насосов.'),
        },
        {
          id: 'pipe-cooling',
          text: tr('Крем переохладился в шланге на 2 °C и от этого стал жидким'),
          correct: false,
          why: tr('При охлаждении вязкость кремов растёт, а не падает втрое.'),
        },
        {
          id: 'preservative-break',
          text: tr('Консервант вступил в реакцию с нержавеющей сталью трубы'),
          correct: false,
          why: tr('Сталь AISI 316L инертна; виновата гидродинамика высокооборотного рабочего колеса.'),
        },
      ],
      actions: [
        {
          id: 'switch-lobe-pump',
          text: tr('Остановить перекачку, переключить линию на объёмный кулачковый/винтовой насос с низкими оборотами, оценить тиксотропное восстановление уже выгруженной части через 24 ч'),
          verdict: 'ok',
          costRub: 28000,
          qualityDelta: -4,
          minutes: 26,
          explain: tr('Объёмный насос бережно переносит вязкий крем при низком сдвиге — основная масса партии в реакторе сохранена полностью.'),
        },
        {
          id: 'throttle-suction',
          text: tr('Прикрыть задвижку на всасе центробежного насоса, чтобы замедлить поток'),
          verdict: 'partial',
          costRub: 220000,
          qualityDelta: -38,
          minutes: 12,
          explain: tr('Дросселирование на всасе резко усиливает кавитацию, аэрацию и окончательно разбивает структуру крема.'),
        },
        {
          id: 'reheat-55c',
          text: tr('Разогреть крем обратно до 55 °C, чтобы его легче было качать тем же насосом'),
          verdict: 'bad',
          costRub: 460000,
          qualityDelta: -52,
          minutes: 36,
          explain: tr('Повторный нагрев разрушает термолабильную фазу C и провоцирует зернистую перекристаллизацию восков.'),
        },
      ],
      topicId: 'pump-selection',
    },
    {
      id: 'wo-phase-inversion',
      code: 'AL-10',
      reactor: 'VR-110',
      batchKg: 500,
      product: tr('Водостойкий защитный крем W/O (cold-process)'),
      title: tr('Внезапная инверсия фаз при сборке обратной эмульсии W/O'),
      alarm: tr('Проводимость скакнула с 0,2 до 840 мкСм/см; масса резко разжижилась и отслоила масло'),
      report: tr('Оператор открыл кран водной фазы на полную мощность и забыл предварительно растворить 0,8 % MgSO₄ в воде. На 45 %-й загрузке воды эмульсия мгновенно «перевернулась».'),
      telemetry: [
        { label: tr('Проводимость'), value: '840 μS/cm', status: 'crit' },
        { label: tr('Норма для W/O'), value: '< 5 μS/cm', status: 'warn' },
        { label: tr('MgSO₄ в воде'), value: '0.0 %', status: 'crit' },
      ],
      causes: [
        {
          id: 'fast-water-no-salt',
          text: tr('Залповый ввод воды без электролита (MgSO₄) вызвал инверсию W/O → O/W — вода стала внешней проводящей фазой'),
          correct: true,
          why: tr('Верно: в обратных эмульсиях вода должна подаваться медленно при интенсивном сдвиге, а 0,7–1 % MgSO₄ подавляет оствальдово созревание и удерживает водную фазу внутри.'),
        },
        {
          id: 'too-much-oil',
          text: tr('В рецептуре избыток масел — нужно долить ещё 20 % воды'),
          correct: false,
          why: tr('Долив воды только закрепит инвертированную нестабильную O/W-смесь с низко-ГЛБ эмульгатором.'),
        },
        {
          id: 'sensor-bug',
          text: tr('Высокая проводимость — признак идеальной эмульсии W/O'),
          correct: false,
          why: tr('Масляная внешняя фаза — диэлектрик (проводимость ≈ 0); скачок до 840 мкСм/см точно диагностирует инверсию в O/W.'),
        },
      ],
      actions: [
        {
          id: 'reprocess-slow-mgso4',
          text: tr('Остановить ввод, растворить 0,8 % MgSO₄ в остатке воды, перевести сбойную массу малыми порциями как внутреннюю фазу в свежую масляно-эмульгаторную базу при контролируемой капельной подаче'),
          verdict: 'ok',
          costRub: 64000,
          qualityDelta: -6,
          minutes: 38,
          explain: tr('Технологически грамотная переработка возвращает масляную внешнюю фазу (проводимость < 5 мкСм/см) и спасает большую часть дорогостоящего сырья.'),
        },
        {
          id: 'dump-xanthan',
          text: tr('Засыпать 2 % ксантановой камеди, чтобы просто «загустить» инвертированную массу'),
          verdict: 'partial',
          costRub: 235000,
          qualityDelta: -36,
          minutes: 20,
          explain: tr('Эмульсия останется O/W с низким ГЛБ, потеряет водостойкость и всё равно расслоится в термостате при 45 °C.'),
        },
        {
          id: 'over-shear-wo',
          text: tr('Включить гомогенизатор на максимум на 15 минут в надежде «перевернуть обратно»'),
          verdict: 'bad',
          costRub: 470000,
          qualityDelta: -55,
          minutes: 18,
          explain: tr('Без правильного фазового соотношения и MgSO₄ длительный пересдвиг лишь перегреет и окончательно расслоит систему.'),
        },
      ],
      topicId: 'inverse-emulsions-wo',
    },
  ]
}

/** Выбирает 3 неповторяющихся производственных ЧП для заданного seed ночной смены. */
export function generateNightShift(seed: number): NightShiftIncident[] {
  const pool = getNightShiftPool()
  const rng = mulberry32(seed || 1)
  const arr = [...pool]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, 3)
}

/** Оценивает итог ночной смены: бюджет, индекс качества, время простоя и итоговый балл 0..1. */
export function evaluateNightShift(
  incidents: NightShiftIncident[],
  decisions: NightShiftDecision[],
): NightShiftResult {
  let totalCostRub = 0
  let qualityIndex = 100
  let downtimeMinutes = 0
  let causesRight = 0
  let optimalActions = 0
  let points = 0
  const maxPoints = Math.max(1, incidents.length * 3)

  const details = incidents.map((inc) => {
    const dec = decisions.find((d) => d.incidentId === inc.id)
    const cause = inc.causes.find((c) => c.id === dec?.causeId)
    const action = inc.actions.find((a) => a.id === dec?.actionId)
    const causeOk = Boolean(cause?.correct)
    const actionVerdict = action?.verdict ?? 'bad'
    const costRub = action?.costRub ?? 400000
    const qualityDelta = action?.qualityDelta ?? -40
    const minutes = action?.minutes ?? 30

    totalCostRub += costRub
    qualityIndex += qualityDelta
    downtimeMinutes += minutes
    if (causeOk) {
      causesRight += 1
      points += 1
    }
    if (actionVerdict === 'ok') {
      optimalActions += 1
      points += 2
    } else if (actionVerdict === 'partial') {
      points += 0.9
    }
    return { incidentId: inc.id, causeOk, actionVerdict, costRub, qualityDelta, minutes }
  })

  qualityIndex = Math.max(0, Math.min(100, qualityIndex))
  const budgetLeft = INITIAL_SHIFT_BUDGET_RUB - totalCostRub
  const score = Math.max(0, Math.min(1, Number((points / maxPoints).toFixed(3))))
  const grade: NightShiftResult['grade'] =
    score >= 0.85 && qualityIndex >= 80 && budgetLeft >= 0
      ? 'saved'
      : score >= 0.5 && qualityIndex >= 45
        ? 'partial'
        : 'scrap'

  return {
    score,
    budgetLeft,
    totalCostRub,
    qualityIndex,
    downtimeMinutes,
    causesRight,
    optimalActions,
    grade,
    details,
  }
}
