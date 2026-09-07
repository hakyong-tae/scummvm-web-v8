import { assetUrl, AD_PLACEMENT_HINTS } from '../config'
import { playRewardedAd } from '../verse8/ads'
import { ui } from '../i18n/ui'

interface HintGroup { t: string; h: string[] }
let unlocked = false      // 세션 단위 해금: 광고 1회로 이 플레이 동안 힌트 열람
let data: { ko: HintGroup[]; en: HintGroup[] } | null = null

/** 자발적(Opt-in) 광고 → 힌트 패널. 게임 콘텐츠가 아닌 우리가 쓴 공략 노트라 라이선스 3조(게임 유료화 금지)와 무관. */
export async function openHints(lang: string) {
  const s = ui(lang)
  const wrap = document.createElement('div'); wrap.className = 'modal'
  const box = document.createElement('div'); box.className = 'modal-box'; wrap.appendChild(box)
  const render = async () => {
    if (!unlocked) {
      box.innerHTML = `<h2>${s.hintsTitle}</h2><p>${s.hintsIntro}</p><p id="hintMsg" style="color:#e0c060"></p><button class="primary" id="hintWatch">${s.hintsWatch}</button> <button class="close">${s.close}</button>`
      box.querySelector<HTMLButtonElement>('#hintWatch')!.onclick = async (e) => {
        const b = e.currentTarget as HTMLButtonElement; b.disabled = true
        const ok = await playRewardedAd(AD_PLACEMENT_HINTS)
        if (ok) { unlocked = true; await render() } else { b.disabled = false; box.querySelector('#hintMsg')!.textContent = s.hintsNotRewarded }
      }
    } else {
      if (!data) data = await fetch(assetUrl('games/lure/hints.json')).then(r => r.json())
      const groups = (lang === 'en' ? data!.en : data!.ko)
      box.innerHTML = `<h2>${s.hintsTitle}</h2><p style="color:#7fc97f">${s.hintsUnlocked}</p>` +
        groups.map(g => `<details><summary>${g.t}</summary><ol>${g.h.map(h => `<li>${h}</li>`).join('')}</ol></details>`).join('') +
        `<button class="close">${s.close}</button>`
    }
    box.querySelector('.close')!.addEventListener('click', () => wrap.remove())
  }
  await render()
  wrap.addEventListener('click', e => { if (e.target === wrap) wrap.remove() })
  document.body.appendChild(wrap)
}
