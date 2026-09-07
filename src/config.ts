export const GAME_TITLE = 'Lure of the Temptress (한글판)'
export const GAME_SUBTITLE = '유혹의 마녀 · 1992 Revolution Software'
export const AD_PLACEMENT_START = 'lure-start'
export const AD_PLACEMENT_QUIT = 'lure-quit'
export const AD_PLACEMENT_HINTS = 'lure-hints'   // 자발적(Opt-in) 보상 광고
export const SAVE_COLLECTION = 'lure_saves'
export const SAVE_DIR = '/home/web_user/saves'
export const SAVE_POLL_MS = 5000
export const SAVE_MAX_BYTES = 512 * 1024
/** 하위경로 호스팅(Verse8) 안전 URL — 절대경로 '/x' 금지 */
export const assetUrl = (rel: string) => new URL(rel, document.baseURI).href
