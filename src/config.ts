/** 하위경로 호스팅(Verse8) 안전 URL — 절대경로 '/x' 금지 */
export const assetUrl = (rel: string) => new URL(rel, document.baseURI).href

export interface GameDef {
  /** ScummVM 타깃 = scummvm.ini 섹션 이름 = data/games/<id>/ 폴더 이름 */
  id: string
  /** 셸 <h1>에 쓰는 원제 */
  name: string
  title: string
  subtitle: string
  adStart: string
  adQuit: string
  adHints: string
  saveCollection: string
  /** 고지 화면에 전문을 싣는 원본 파일들(배포본 engine/data/games/<id>/ 안) */
  licenseFiles: string[]
}

export const GAMES: Record<string, GameDef> = {
  lure: {
    id: 'lure',
    name: 'Lure of the Temptress',
    title: 'Lure of the Temptress (한글판)',
    subtitle: '유혹의 마녀 · 1992 Revolution Software',
    adStart: 'lure-start', adQuit: 'lure-quit', adHints: 'lure-hints',
    saveCollection: 'lure_saves',
    licenseFiles: ['LICENSE.txt', 'README'],
  },
  soltys: {
    id: 'soltys',
    name: 'Sołtys',
    title: 'Sołtys (한글판)',
    subtitle: '솔티스 · 1995 Laboratorium Komputerowe Avalon',
    adStart: 'soltys-start', adQuit: 'soltys-quit', adHints: 'soltys-hints',
    saveCollection: 'soltys_saves',
    licenseFiles: ['license.txt'],
  },
}

/** 현재 게임: ?game=<id> (없으면 빌드 기본값 VITE_GAME, 그것도 없으면 lure) */
const requested = (typeof location !== 'undefined' && new URLSearchParams(location.search).get('game'))
  || (import.meta.env?.VITE_GAME as string | undefined)
export const GAME: GameDef = GAMES[requested ?? ''] ?? GAMES.lure

export const GAME_ID = GAME.id
export const GAME_TITLE = GAME.title
export const GAME_SUBTITLE = GAME.subtitle
export const AD_PLACEMENT_START = GAME.adStart
export const AD_PLACEMENT_QUIT = GAME.adQuit
export const AD_PLACEMENT_HINTS = GAME.adHints
export const SAVE_COLLECTION = GAME.saveCollection

export const SAVE_DIR = '/home/web_user/saves'
export const SAVE_POLL_MS = 5000
export const SAVE_MAX_BYTES = 512 * 1024
