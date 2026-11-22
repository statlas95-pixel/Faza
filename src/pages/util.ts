import { tr } from '../../shared/locale'
import { useEffect } from 'react'
export function useTitle(t: string) {
  useEffect(() => { document.title = t ? `${t}${tr(" — Фаза")}` : tr("Фаза — технология и разработка косметики") }, [t])
}
