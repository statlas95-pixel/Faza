// Интерактивный 3D-микромир косметической химии (Пакет T):
// Чистая 3D-математика проекции и 6 моделей структур/молекул (0 внешних зависимостей).

export type Micro3DId = 'micelle' | 'lamellar' | 'liposome' | 'retinol' | 'ascorbic' | 'niacinamide'

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface Node3D extends Vec3 {
  id: string
  r: number
  color: string
  label?: string
}

export interface Edge3D {
  from: string
  to: string
  color?: string
  width?: number
}

export interface Micro3DModel {
  id: Micro3DId
  categoryRu: string
  categoryEn: string
  titleRu: string
  titleEn: string
  formula: string
  descRu: string
  descEn: string
  legend: { color: string; labelRu: string; labelEn: string }[]
  nodes: Node3D[]
  edges: Edge3D[]
}

export interface ProjectedNode extends Node3D {
  sx: number
  sy: number
  depth: number
  scale: number
}

/** Вращает точку (x, y, z) по углам Эйлера (rotX, rotY) и проецирует в перспективные 2D-координаты. */
export function projectPoint3D(
  pt: Vec3,
  rotX: number,
  rotY: number,
  zoom: number,
  cx: number,
  cy: number,
): { sx: number; sy: number; depth: number; scale: number } {
  const cosY = Math.cos(rotY)
  const sinY = Math.sin(rotY)
  const x1 = pt.x * cosY - pt.z * sinY
  const z1 = pt.x * sinY + pt.z * cosY

  const cosX = Math.cos(rotX)
  const sinX = Math.sin(rotX)
  const y2 = pt.y * cosX - z1 * sinX
  const z2 = pt.y * sinX + z1 * cosX

  const cameraDist = 420
  const persp = cameraDist / Math.max(90, cameraDist - z2)
  const scale = persp * zoom
  return {
    sx: cx + x1 * scale,
    sy: cy + y2 * scale,
    depth: z2,
    scale,
  }
}

// Генератор сферической мицеллы ПАВ (фибоначчиева сфера: головы снаружи, хвосты к ядру, ядро отдушки)
function buildMicelle(): { nodes: Node3D[]; edges: Edge3D[] } {
  const nodes: Node3D[] = [{ id: 'core', x: 0, y: 0, z: 0, r: 22, color: '#F59E0B', label: 'Oil' }]
  const edges: Edge3D[] = []
  const count = 24
  const golden = Math.PI * (3 - Math.sqrt(5))
  const Rhead = 95
  const Rtail = 34
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2
    const rad = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    const ux = Math.cos(theta) * rad
    const uz = Math.sin(theta) * rad
    const headId = `h${i}`
    const tailId = `t${i}`
    nodes.push({ id: headId, x: ux * Rhead, y: y * Rhead, z: uz * Rhead, r: 9.5, color: '#0EA5E9' })
    nodes.push({ id: tailId, x: ux * Rtail, y: y * Rtail, z: uz * Rtail, r: 4, color: '#CBD5E1' })
    edges.push({ from: headId, to: tailId, color: '#94A3B8', width: 2 })
  }
  return { nodes, edges }
}

// Ламеллярный гелевый бислой LGN / DMS (два параллельных бислоя + водная прослойка)
function buildLamellar(): { nodes: Node3D[]; edges: Edge3D[] } {
  const nodes: Node3D[] = []
  const edges: Edge3D[] = []
  const cols = 5
  const rows = 3
  const xs = [-88, -44, 0, 44, 88]
  const zs = [-50, 0, 50]
  // Верхний бислой (y = -58..-22), нижний бислой (y = +22..+58), между ними вода (y = 0)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = xs[c]
      const z = zs[r]
      const isCeramide = (r + c) % 3 === 0
      const headColor = isCeramide ? '#E05545' : '#0EA5E9'
      const idTopH = `th_${r}_${c}`
      const idTopT = `tt_${r}_${c}`
      const idBotH = `bh_${r}_${c}`
      const idBotT = `bt_${r}_${c}`
      nodes.push({ id: idTopH, x, y: -64, z, r: 8, color: headColor })
      nodes.push({ id: idTopT, x, y: -22, z, r: 3.5, color: '#F59E0B' })
      edges.push({ from: idTopH, to: idTopT, color: '#F59E0B', width: 2 })

      nodes.push({ id: idBotH, x, y: 64, z, r: 8, color: headColor })
      nodes.push({ id: idBotT, x, y: 22, z, r: 3.5, color: '#F59E0B' })
      edges.push({ from: idBotH, to: idBotT, color: '#F59E0B', width: 2 })
    }
  }
  // Молекулы воды в межламеллярном слое
  for (const x of [-65, -20, 25, 68]) {
    for (const z of [-28, 28]) {
      nodes.push({ id: `w_${x}_${z}`, x, y: 0, z, r: 6, color: '#38BDF8', label: 'H₂O' })
    }
  }
  return { nodes, edges }
}

// Липосомальная везикула (наружный и внутренний фосфолипидный слой + водное ядро с активом)
function buildLiposome(): { nodes: Node3D[]; edges: Edge3D[] } {
  const nodes: Node3D[] = [
    { id: 'act1', x: -16, y: -10, z: 10, r: 10, color: '#10B981', label: 'Active' },
    { id: 'act2', x: 18, y: 12, z: -12, r: 9, color: '#10B981' },
  ]
  const edges: Edge3D[] = []
  const count = 20
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2
    const rad = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    const ux = Math.cos(theta) * rad
    const uz = Math.sin(theta) * rad
    // Показываем срез полусферы (x < 65), чтобы видеть внутреннее водное ядро!
    if (ux > 0.52 && uz > 0.25) continue
    nodes.push({ id: `oh${i}`, x: ux * 102, y: y * 102, z: uz * 102, r: 8, color: '#0EA5E9' })
    nodes.push({ id: `ih${i}`, x: ux * 58, y: y * 58, z: uz * 58, r: 6.5, color: '#6366F1' })
    edges.push({ from: `oh${i}`, to: `ih${i}`, color: '#F59E0B', width: 2.2 })
  }
  return { nodes, edges }
}

// 3D-молекула Ретинола (β-иононовое кольцо + полиеновая цепь с сопряжёнными связями + -OH)
function buildRetinol(): { nodes: Node3D[]; edges: Edge3D[] } {
  const nodes: Node3D[] = [
    // β-иононовое кольцо
    { id: 'c1', x: -105, y: -15, z: 12, r: 10, color: '#64748B', label: 'C' },
    { id: 'c2', x: -128, y: 14, z: -8, r: 10, color: '#64748B' },
    { id: 'c3', x: -106, y: 44, z: -16, r: 10, color: '#64748B' },
    { id: 'c4', x: -72, y: 40, z: 6, r: 10, color: '#64748B' },
    { id: 'c5', x: -58, y: 8, z: 16, r: 10, color: '#0EA5E9', label: 'C=C' },
    { id: 'c6', x: -76, y: -22, z: 18, r: 10, color: '#0EA5E9' },
    // Полиеновая цепь (главная мишень УФ и O₂!)
    { id: 'c7', x: -24, y: 4, z: 8, r: 10, color: '#F59E0B' },
    { id: 'c8', x: 6, y: -18, z: -4, r: 10, color: '#F59E0B' },
    { id: 'c9', x: 38, y: -10, z: 6, r: 10, color: '#F59E0B', label: 'C=C' },
    { id: 'c10', x: 66, y: -30, z: -6, r: 10, color: '#F59E0B' },
    { id: 'c11', x: 96, y: -18, z: 8, r: 10, color: '#F59E0B' },
    { id: 'o1', x: 124, y: 6, z: -4, r: 11.5, color: '#E05545', label: 'OH' },
  ]
  const edges: Edge3D[] = [
    { from: 'c1', to: 'c2' }, { from: 'c2', to: 'c3' }, { from: 'c3', to: 'c4' },
    { from: 'c4', to: 'c5' }, { from: 'c5', to: 'c6', color: '#0EA5E9', width: 3.2 }, { from: 'c6', to: 'c1' },
    { from: 'c5', to: 'c7', color: '#F59E0B', width: 2.5 },
    { from: 'c7', to: 'c8', color: '#F59E0B', width: 3.4 },
    { from: 'c8', to: 'c9', color: '#F59E0B', width: 2.4 },
    { from: 'c9', to: 'c10', color: '#F59E0B', width: 3.4 },
    { from: 'c10', to: 'c11', color: '#F59E0B', width: 2.4 },
    { from: 'c11', to: 'o1', color: '#E05545', width: 2.6 },
  ]
  return { nodes, edges }
}

// 3D-молекула L-Аскорбиновой кислоты (лактонное кольцо + ендиольные -OH на C2/C3)
function buildAscorbic(): { nodes: Node3D[]; edges: Edge3D[] } {
  const nodes: Node3D[] = [
    { id: 'c1', x: -42, y: -38, z: 10, r: 11, color: '#64748B', label: 'C1' },
    { id: 'c2', x: 14, y: -48, z: 0, r: 11, color: '#F59E0B', label: 'C2' },
    { id: 'c3', x: 46, y: -4, z: -8, r: 11, color: '#F59E0B', label: 'C3' },
    { id: 'c4', x: 8, y: 38, z: 14, r: 11, color: '#64748B', label: 'C4' },
    { id: 'o4', x: -48, y: 14, z: 18, r: 12, color: '#E05545', label: 'O' },
    { id: 'o1', x: -78, y: -70, z: 14, r: 11.5, color: '#E05545', label: '=O' },
    { id: 'oh2', x: 32, y: -90, z: -12, r: 12, color: '#10B981', label: 'OH' },
    { id: 'oh3', x: 96, y: -6, z: -20, r: 12, color: '#10B981', label: 'OH' },
    { id: 'c5', x: 18, y: 82, z: -12, r: 10.5, color: '#64748B', label: 'C5' },
    { id: 'oh5', x: 64, y: 96, z: -24, r: 11, color: '#E05545', label: 'OH' },
  ]
  const edges: Edge3D[] = [
    { from: 'c1', to: 'c2' }, { from: 'c2', to: 'c3', color: '#F59E0B', width: 3.6 },
    { from: 'c3', to: 'c4' }, { from: 'c4', to: 'o4' }, { from: 'o4', to: 'c1' },
    { from: 'c1', to: 'o1', color: '#E05545', width: 3.0 },
    { from: 'c2', to: 'oh2', color: '#10B981', width: 2.8 },
    { from: 'c3', to: 'oh3', color: '#10B981', width: 2.8 },
    { from: 'c4', to: 'c5' }, { from: 'c5', to: 'oh5', color: '#E05545' },
  ]
  return { nodes, edges }
}

// 3D-молекула Ниацинамида (пиридиновое кольцо + амидная группа -CONH₂)
function buildNiacinamide(): { nodes: Node3D[]; edges: Edge3D[] } {
  const nodes: Node3D[] = [
    { id: 'n1', x: -72, y: 24, z: 14, r: 12, color: '#0EA5E9', label: 'N' },
    { id: 'c2', x: -72, y: -26, z: 8, r: 10.5, color: '#64748B' },
    { id: 'c3', x: -24, y: -52, z: -4, r: 10.5, color: '#64748B' },
    { id: 'c4', x: 24, y: -26, z: -8, r: 10.5, color: '#64748B', label: 'C3' },
    { id: 'c5', x: 24, y: 26, z: 0, r: 10.5, color: '#64748B' },
    { id: 'c6', x: -24, y: 52, z: 12, r: 10.5, color: '#64748B' },
    { id: 'cam', x: 74, y: -44, z: -14, r: 11, color: '#F59E0B', label: 'C=O' },
    { id: 'oam', x: 96, y: -88, z: -22, r: 11.5, color: '#E05545', label: 'O' },
    { id: 'nam', x: 108, y: -2, z: -12, r: 12, color: '#10B981', label: 'NH₂' },
  ]
  const edges: Edge3D[] = [
    { from: 'n1', to: 'c2', color: '#0EA5E9' }, { from: 'c2', to: 'c3', width: 3 },
    { from: 'c3', to: 'c4' }, { from: 'c4', to: 'c5', width: 3 },
    { from: 'c5', to: 'c6' }, { from: 'c6', to: 'n1', color: '#0EA5E9', width: 3 },
    { from: 'c4', to: 'cam', color: '#F59E0B', width: 2.6 },
    { from: 'cam', to: 'oam', color: '#E05545', width: 3.2 },
    { from: 'cam', to: 'nam', color: '#10B981', width: 2.6 },
  ]
  return { nodes, edges }
}

export const MICRO3D_MODELS: Micro3DModel[] = [
  {
    id: 'micelle',
    categoryRu: 'Коллоидная структура',
    categoryEn: 'Colloidal Structure',
    titleRu: 'Сферическая мицелла ПАВ',
    titleEn: 'Spherical Surfactant Micelle',
    formula: 'd ≈ 4–8 нм · C > ККМ',
    descRu: 'Полярные гидрофильные головы обращены к воде, а гидрофобные углеводородные хвосты образуют неполярное ядро, солюбилизирующее отдушку или масло.',
    descEn: 'Polar hydrophilic headgroups face water while hydrophobic alkyl tails form an apolar core that solubilizes fragrance oils.',
    legend: [
      { color: '#0EA5E9', labelRu: 'Гидрофильная голова ПАВ', labelEn: 'Hydrophilic headgroup' },
      { color: '#94A3B8', labelRu: 'Гидрофобный хвост', labelEn: 'Hydrophobic tail' },
      { color: '#F59E0B', labelRu: 'Солюбилизированное ядро', labelEn: 'Solubilized oil core' },
    ],
    ...buildMicelle(),
  },
  {
    id: 'lamellar',
    categoryRu: 'Эмульсии и кожа',
    categoryEn: 'Emulsions & Skin',
    titleRu: 'Ламеллярный бислой (LGN / DMS)',
    titleEn: 'Lamellar Bilayer (LGN / DMS)',
    formula: 'Бислои + H₂O · pH 4,5–5,5',
    descRu: 'Упорядоченные пачки бислоёв жирного спирта, фосфолипидов и церамидов удерживают межламеллярную воду — это задаёт предел текучести крема и имитирует барьер кожи.',
    descEn: 'Ordered stacks of fatty-alcohol, phospholipid, and ceramide bilayers trap interlamellar water — creating yield stress and mimicking the stratum corneum.',
    legend: [
      { color: '#0EA5E9', labelRu: 'Фосфолипид / ПАВ', labelEn: 'Phospholipid / surfactant' },
      { color: '#E05545', labelRu: 'Церамид NP', labelEn: 'Ceramide NP' },
      { color: '#38BDF8', labelRu: 'Межламеллярная вода', labelEn: 'Interlamellar water' },
    ],
    ...buildLamellar(),
  },
  {
    id: 'liposome',
    categoryRu: 'Системы доставки',
    categoryEn: 'Delivery Systems',
    titleRu: 'Липосомальная везикула (в разрезе)',
    titleEn: 'Liposome Vesicle (Cutaway)',
    formula: 'd ≈ 80–200 нм · T ≤ 40 °C',
    descRu: 'Замкнутый двойной липидный слой защищает водорастворимые пептиды и PDRN внутри ядра. Рвётся при роторно-статорной гомогенизации — вводится строго в фазу C!',
    descEn: 'A closed phospholipid bilayer encapsulates water-soluble peptides and PDRN. Ruptures under high-shear rotor-stator mixing — add only in Phase C!',
    legend: [
      { color: '#0EA5E9', labelRu: 'Внешний слой бислоя', labelEn: 'Outer bilayer leaflet' },
      { color: '#6366F1', labelRu: 'Внутренний слой бислоя', labelEn: 'Inner bilayer leaflet' },
      { color: '#10B981', labelRu: 'Инкапсулированный актив', labelEn: 'Encapsulated active' },
    ],
    ...buildLiposome(),
  },
  {
    id: 'retinol',
    categoryRu: 'Молекула актива',
    categoryEn: 'Active Molecule',
    titleRu: 'Ретинол (all-trans-Retinol)',
    titleEn: 'Retinol (all-trans-Retinol)',
    formula: 'C₂₀H₃₀O · 286,45 г/моль',
    descRu: 'Пять сопряжённых двойных связей (жёлтая цепь) делают ретинол мощным сигнальным активом, но крайне уязвимым к кислороду, УФ и следам Fe³⁺ (нужен airless + BHT/токоферол).',
    descEn: 'Five conjugated double bonds (amber chain) give retinol potent efficacy while making it highly prone to O₂, UV, and Fe³⁺ oxidation (needs airless + antioxidants).',
    legend: [
      { color: '#F59E0B', labelRu: 'Сопряжённая полиеновая цепь', labelEn: 'Conjugated polyene chain' },
      { color: '#E05545', labelRu: 'Спиртовая группа −OH', labelEn: 'Hydroxyl −OH group' },
      { color: '#64748B', labelRu: 'β-иононовое кольцо', labelEn: 'β-ionone ring' },
    ],
    ...buildRetinol(),
  },
  {
    id: 'ascorbic',
    categoryRu: 'Молекула актива',
    categoryEn: 'Active Molecule',
    titleRu: 'L-Аскорбиновая кислота (витамин C)',
    titleEn: 'L-Ascorbic Acid (Vitamin C)',
    formula: 'C₆H₈O₆ · pKa₁ = 4,17',
    descRu: 'Ендиольная группа C2=C3 (зелёные −OH) мгновенно отдаёт два электрона свободным радикалам, переходя в ДГК и затем необратимо желтея в воде при pH > 3,5.',
    descEn: 'The C2=C3 enediol group (green −OH) donates two electrons to free radicals, oxidizing to DHA and irreversibly yellowing in water above pH 3.5.',
    legend: [
      { color: '#10B981', labelRu: 'Ендиольные −OH (антиоксидантный центр)', labelEn: 'Enediol −OH (antioxidant site)' },
      { color: '#F59E0B', labelRu: 'Двойная связь C2=C3', labelEn: 'C2=C3 double bond' },
      { color: '#E05545', labelRu: 'Атомы кислорода лактона', labelEn: 'Lactone oxygens' },
    ],
    ...buildAscorbic(),
  },
  {
    id: 'niacinamide',
    categoryRu: 'Молекула актива',
    categoryEn: 'Active Molecule',
    titleRu: 'Ниацинамид (витамин B₃)',
    titleEn: 'Niacinamide (Vitamin B₃)',
    formula: 'C₆H₆N₂O · pH 5,0–7,0',
    descRu: 'Устойчив к свету и нагреву, но при pH < 4,0 амидная группа −CONH₂ гидролизуется в никотиновую кислоту, вызывающую мгновенное покраснение кожи (flushing).',
    descEn: 'Heat- and light-stable, yet below pH 4.0 its amide group (−CONH₂) hydrolyzes into nicotinic acid, triggering skin flushing.',
    legend: [
      { color: '#10B981', labelRu: 'Амидная группа −NH₂ (риск гидролиза)', labelEn: 'Amide −NH₂ (hydrolysis site)' },
      { color: '#0EA5E9', labelRu: 'Азот пиридинового кольца', labelEn: 'Pyridine nitrogen' },
      { color: '#F59E0B', labelRu: 'Карбонильный углерод C=O', labelEn: 'Carbonyl carbon' },
    ],
    ...buildNiacinamide(),
  },
]
