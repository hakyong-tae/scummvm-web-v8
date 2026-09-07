// @verse8/ads 래퍼. 정적 import(빌드 파이프라인이 동적 import를 트리셰이킹한 사례 있음), package.json 유지.
// 모든 호출에 timeoutMs: 120_000 명시 — 생략하면 SDK 기본 30초가 적용되어 원스토어 기준(120초) 미달로 반려된다.
import { Verse8Ads } from '@verse8/ads'

export const AD_TIMEOUT_MS = 120_000

// SDK는 Verse8 호스트(verse8.io 셸 iframe / 모바일 WebView) 안에서만 동작. 바깥이면 { error: 'unsupported_env' }.
const inVerse8Host = (() => { try { return typeof window !== 'undefined' && window.parent && window.parent !== window } catch { return true } })()

/** 전면 광고. 실패/미지원이면 조용히 false — 게임 흐름은 계속. */
export async function playInterstitialAd(placementId: string): Promise<boolean> {
  if (!inVerse8Host) return mockAd(placementId, 'interstitial')
  try {
    await Verse8Ads.showInterstitial({ placementId, timeoutMs: 120_000 })
    return true
  } catch (err) { console.warn('[v8] interstitial failed:', err); return false }
}

/** 자발적(Opt-in) 보상 광고. 보상 판정은 Verse8 호스트가 서버측 검증(SSV)한 결과라 status를 그대로 신뢰한다.
 *  ads-verifier.verse8.io를 게임이 직접 호출하면 401 — 절대 호출하지 않는다. */
export async function playRewardedAd(placementId: string): Promise<boolean> {
  if (!inVerse8Host) return mockAd(placementId, 'rewarded')
  try {
    const result = await Verse8Ads.showRewarded({ placementId, timeoutMs: 120_000 })
    return (result as { status?: string } | undefined)?.status === 'rewarded'
  } catch (err) { console.warn('[v8] rewarded failed:', err); return false }
}

/** 로컬 개발용 가짜 광고: 보상 경로를 실제 광고 없이 검증. 호스트 안에서는 절대 도달하지 않는다. */
function mockAd(placementId: string, kind: 'interstitial' | 'rewarded'): Promise<boolean> {
  return new Promise((resolve) => {
    const el = document.createElement('div')
    el.style.cssText = 'position:fixed;inset:0;background:#111;color:#eee;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:100;font:14px system-ui'
    el.innerHTML = `<div style="font-size:12px;color:#888">MOCK AD · ${kind} · ${placementId}</div><div style="font-size:22px">광고 자리 (로컬 개발)</div>`
    if (kind === 'rewarded') {
      const ok = document.createElement('button'); ok.textContent = '끝까지 봄(보상)'; const no = document.createElement('button'); no.textContent = '중간에 닫기'
      for (const b of [ok, no]) { b.style.cssText = 'font-size:16px;padding:8px 18px;margin:4px'; el.appendChild(b) }
      ok.onclick = () => { el.remove(); resolve(true) }; no.onclick = () => { el.remove(); resolve(false) }
    } else { setTimeout(() => { el.remove(); resolve(true) }, 1500) }
    document.body.appendChild(el)
  })
}
