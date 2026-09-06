// @verse8/ads 래퍼. 정적 import 필수(동적 import는 V8 빌드에서 트리쉐이킹된 사례).
// 호스트 밖(top frame)에서는 SDK가 unsupported_env → 로컬 mock 배너로 흐름만 유지.
import { Verse8Ads } from '@verse8/ads'

const INTERSTITIAL_TIMEOUT_MS = 8000
const inVerse8Host = (() => { try { return window.parent && window.parent !== window } catch { return true } })()

export async function showInterstitial(placementId: string): Promise<boolean> {
  if (!inVerse8Host) return mockInterstitial(placementId)
  try {
    await Promise.race([
      Verse8Ads.showInterstitial({ placementId }),
      new Promise(res => setTimeout(res, INTERSTITIAL_TIMEOUT_MS)),  // no-fill이 게임을 멈추지 않게
    ])
    return true
  } catch (err) { console.warn('[v8] interstitial failed', err); return false }
}

function mockInterstitial(placementId: string): Promise<boolean> {
  return new Promise(resolve => {
    const el = document.createElement('div')
    el.style.cssText = 'position:fixed;inset:0;background:#111;color:#ccc;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:99;font:14px system-ui'
    el.innerHTML = `<div>[dev] 광고 자리 · ${placementId}</div><div style="font-size:11px;color:#777;margin-top:8px">Verse8 호스트 안에서만 실제 광고가 나옵니다</div>`
    document.body.appendChild(el)
    setTimeout(() => { el.remove(); resolve(true) }, 1500)
  })
}
