export interface PortfolioShareSnapshot {
  v: 1
  n: string
  d: string
  g: number
  gt: string
  gb: string
  gp: number
  c: { l: number; s: number; a: string }[]
  dom: number[]
  m: number
  t: number
  lb: number
  lt: number
  fm: number
  cp: number
  sc: number
  sl: number
}

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  const b64 = btoa(bin)
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(token: string): string {
  const padded = token.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((token.length + 3) % 4)
  const bin = atob(padded)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export function encodePortfolioSnapshot(snap: PortfolioShareSnapshot): string {
  return toBase64Url(JSON.stringify(snap))
}

export function decodePortfolioSnapshot(token: string | null | undefined): PortfolioShareSnapshot | null {
  if (!token || token.length > 4000) return null
  try {
    const raw = JSON.parse(fromBase64Url(token))
    if (!raw || raw.v !== 1 || typeof raw.n !== 'string' || !Array.isArray(raw.dom) || raw.dom.length !== 6) {
      return null
    }
    return {
      v: 1,
      n: raw.n.slice(0, 80),
      d: typeof raw.d === 'string' ? raw.d.slice(0, 20) : '',
      g: Math.max(1, Math.min(4, Number(raw.g) || 1)),
      gt: typeof raw.gt === 'string' ? raw.gt.slice(0, 80) : '',
      gb: typeof raw.gb === 'string' ? raw.gb.slice(0, 40) : '',
      gp: Math.max(0, Math.min(100, Math.round(Number(raw.gp) || 0))),
      c: Array.isArray(raw.c)
        ? raw.c.slice(0, 4).map((x: any) => ({
            l: Number(x.l) || 1,
            s: Math.max(0, Math.min(100, Math.round(Number(x.s) || 0))),
            a: String(x.a ?? '').slice(0, 20),
          }))
        : [],
      dom: raw.dom.map((x: any) => Math.max(0, Math.min(100, Math.round(Number(x) || 0)))),
      m: Math.max(0, Number(raw.m) || 0),
      t: Math.max(1, Number(raw.t) || 1),
      lb: Math.max(0, Number(raw.lb) || 0),
      lt: Math.max(1, Number(raw.lt) || 1),
      fm: Math.max(0, Number(raw.fm) || 0),
      cp: Math.max(0, Number(raw.cp) || 0),
      sc: Math.max(0, Number(raw.sc) || 0),
      sl: Math.max(0, Number(raw.sl) || 0),
    }
  } catch {
    return null
  }
}
