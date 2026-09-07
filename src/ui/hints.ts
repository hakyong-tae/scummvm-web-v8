import { assetUrl, AD_PLACEMENT_HINTS } from '../config'
import { playRewardedAd } from '../verse8/ads'
import { ui } from '../i18n/ui'

interface HintGroup { t: string; h: string[] }
let data: { ko: HintGroup[]; en: HintGroup[] } | null = null
const KEY = 'lure.hints.unlocked'
const unlockedSet = (): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]')) } catch { return new Set() } }
const unlock = (id: string) => { const u = unlockedSet(); u.add(id); localStorage.setItem(KEY, JSON.stringify([...u])) }

/** 자발적(Opt-in) 광고 1편 = 힌트 1개 해금. 힌트는 우리가 쓴 공략 노트라 라이선스 3조(게임 유료화 금지)와 무관. */
export async function openHints(lang: string) {
  const s = ui(lang)
  if (!data) data = await fetch(assetUrl('games/lure/hints.json')).then(r => r.json())
  const groups = lang === 'en' ? data!.en : data!.ko
  const wrap = document.createElement('div'); wrap.className = 'modal'
  const box = document.createElement('div'); box.className = 'modal-box'; wrap.appendChild(box)
  let busy = false
  const render = (msg = '') => {
    const u = unlockedSet()
    box.innerHTML = `<h2>${s.hintsTitle}</h2><p>${s.hintsIntro}</p><p id="hintMsg" style="color:#e0c060;min-height:1.2em">${msg}</p>` +
      groups.map((g, gi) => `<details ${gi === 0 ? 'open' : ''}><summary>${g.t} <small style="color:#888">(${g.h.filter((_, hi) => u.has(`${gi}:${hi}`)).length}/${g.h.length})</small></summary><ol>` +
        g.h.map((h, hi) => u.has(`${gi}:${hi}`) ? `<li>${h}</li>` : `<li><button class="hint-lock" data-id="${gi}:${hi}">🎬 ${s.hintsWatch}</button></li>`).join('') + '</ol></details>').join('') +
      `<button class="close">${s.close}</button>`
    box.querySelectorAll<HTMLButtonElement>('.hint-lock').forEach(b => b.onclick = async () => {
      if (busy) return; busy = true; b.disabled = true
      const ok = await playRewardedAd(AD_PLACEMENT_HINTS)
      busy = false
      if (ok) { unlock(b.dataset.id!); render() } else { render(s.hintsNotRewarded) }
    })
    box.querySelector('.close')!.addEventListener('click', () => wrap.remove())
  }
  render()
  wrap.addEventListener('click', e => { if (e.target === wrap) wrap.remove() })
  document.body.appendChild(wrap)
}
