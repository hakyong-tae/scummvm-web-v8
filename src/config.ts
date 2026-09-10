/** 하위경로 호스팅(Verse8) 안전 URL — 절대경로 '/x' 금지 */
export const assetUrl = (rel: string) => new URL(rel, document.baseURI).href

/** 게임마다 다른 셸 문안(언어별). 나머지 UI 문자열은 src/i18n/ui.ts 공통. */
export interface GameText {
  /** 타이틀 화면 부제 */
  subtitle: string
  /** 조작 안내 — 게임마다 마우스 규칙이 다르다 */
  touchHelp: string
  pcHelp: string
  /** 고지 화면의 "원작" 문단(HTML). 한글 자막·엔진·글꼴 문단은 셸이 공통으로 붙인다 */
  origin: string
}

export interface GameDef {
  /** ScummVM 타깃 = scummvm.ini 섹션 이름 = data/games/<id>/ 폴더 이름 */
  id: string
  /** 셸 <h1>에 쓰는 원제 */
  name: string
  title: string
  adStart: string
  adQuit: string
  adHints: string
  saveCollection: string
  /** 고지 화면에 전문을 싣는 원본 파일들(배포본 engine/data/games/<id>/ 안) */
  licenseFiles: string[]
  /** 번역 사전 형태: 'lure' = 테이블:로컬 키 + 조사 합성, 'ref' = SAY ref 키(CGE 계열) */
  i18n: 'lure' | 'ref'
  /** 한 문단으로 묶을 줄 간격(px) — Lure 대화창 7, CGE 10 */
  linePitch: { minPitch: number; maxPitch: number }
  text: { ko: GameText; en: GameText }
}

export const GAMES: Record<string, GameDef> = {
  lure: {
    id: 'lure',
    name: 'Lure of the Temptress',
    title: 'Lure of the Temptress (한글판)',
    adStart: 'lure-start', adQuit: 'lure-quit', adHints: 'lure-hints',
    saveCollection: 'lure_saves',
    licenseFiles: ['LICENSE.txt', 'README'],
    i18n: 'lure',
    linePitch: { minPitch: 7, maxPitch: 9 },
    text: {
      ko: {
        subtitle: '유혹의 마녀 · 1992 Revolution Software · 비공식 한글판',
        touchHelp: '길게 누르면 동작 메뉴 · 드래그해서 고르고 손을 떼면 실행',
        pcHelp: '우클릭을 누른 채 위아래로 움직여 동작을 고르고 놓으면 실행 · 좌클릭 = 걷기/보기 · 선택지/팝업은 ↑↓ + Enter로도 선택 · Esc = 인트로 건너뛰기',
        origin: 'Lure of the Temptress © 1992 Revolution Software Ltd. — 저작권자가 프리웨어로 공개한 게임입니다.',
      },
      en: {
        subtitle: 'Point-and-click classic · 1992 Revolution Software · unofficial Korean edition',
        touchHelp: 'Long-press for the verb menu · drag to choose, release to act',
        pcHelp: 'Hold the right mouse button and move up/down to pick an action, release to act · Left-click = walk/look · ↑↓ + Enter also picks choices/menu items · Esc = skip intro',
        origin: 'Lure of the Temptress © 1992 Revolution Software Ltd. — released as freeware by its copyright holder.',
      },
    },
  },
  soltys: {
    id: 'soltys',
    name: 'Sołtys',
    title: 'Sołtys (한글판)',
    adStart: 'soltys-start', adQuit: 'soltys-quit', adHints: 'soltys-hints',
    saveCollection: 'soltys_saves',
    licenseFiles: ['license.txt'],
    i18n: 'ref',
    linePitch: { minPitch: 9, maxPitch: 11 },
    text: {
      ko: {
        subtitle: '솔티스 · 1995 L.K. Avalon · 비공식 한글판',
        touchHelp: '탭 = 걷기·살펴보기 · 길게 누르기 = 사용·집기 · 우측 상단 Esc = 인트로 건너뛰기 · 하단 가운데(♪) 길게 누르면 저장/불러오기',
        pcHelp: '좌클릭 = 걷기·살펴보기 · 우클릭 = 사용·집기 · Esc = 인트로 건너뛰기 · F5 또는 하단 가운데(♪) 아이콘 우클릭 = 저장/불러오기',
        origin: 'Sołtys © 1995 Laboratorium Komputerowe Avalon — 저작권자가 2011년 프리웨어로 공개한 게임입니다. 영문판은 원작자 Janusz Wiśniewski가 참여한 공식 영문화(v1.0)이며, 한글 자막은 그 영문판을 옮긴 것입니다.',
      },
      en: {
        subtitle: 'Polish point-and-click comedy · 1995 L.K. Avalon · unofficial Korean edition',
        touchHelp: 'Tap = walk/look · long-press = use/take · Esc (top right) = skip intro · long-press the middle (♪) icon at the bottom to save/load',
        pcHelp: 'Left-click = walk/look · right-click = use/take · Esc = skip intro · F5, or right-click the middle (♪) icon at the bottom, to save/load',
        origin: 'Sołtys © 1995 Laboratorium Komputerowe Avalon — released as freeware by its copyright holder in 2011. The English v1.0 is the official translation the original author, Janusz Wiśniewski, took part in; the Korean subtitles are made from it.',
      },
    },
  },
}

/** 현재 게임: ?game=<id> → <meta name="svm-game"> → VITE_GAME → lure.
 *  meta 를 먼저 보는 이유: 배포 플랫폼의 빌드가 production 모드가 아니면 .env.production 이 적용되지 않는다(실제로 겪음). */
const metaGame = typeof document !== 'undefined'
  ? document.querySelector('meta[name="svm-game"]')?.getAttribute('content') ?? undefined
  : undefined
const requested = (typeof location !== 'undefined' && new URLSearchParams(location.search).get('game'))
  || metaGame
  || (import.meta.env?.VITE_GAME as string | undefined)
export const GAME: GameDef = GAMES[requested ?? ''] ?? GAMES.lure

export const GAME_ID = GAME.id
export const GAME_TITLE = GAME.title
/** 현재 언어의 게임별 문안 */
export const gameText = (lang: string) => (lang === 'en' ? GAME.text.en : GAME.text.ko)
export const AD_PLACEMENT_START = GAME.adStart
export const AD_PLACEMENT_QUIT = GAME.adQuit
export const AD_PLACEMENT_HINTS = GAME.adHints
export const SAVE_COLLECTION = GAME.saveCollection

/** 셸 공통 설정 키(언어·터치 모드) — 같은 오리진의 게임끼리 공유한다 */
export const prefKey = (k: string) => `svm.${k}`
/** 게임별 키(토스트·힌트 해금) — 게임마다 조작과 힌트가 다르므로 분리한다 */
export const gameKey = (k: string) => `svm.${GAME.id}.${k}`

// 이전 배포(Lure 단독)에서 쓰던 'lure.*' 키를 한 번만 옮긴다 — 언어 설정이 초기화되지 않도록.
try {
  for (const [oldK, newK] of [['lure.lang', prefKey('lang')], ['lure.touch', prefKey('touch')],
                              ['lure.toast.controls', 'svm.lure.toast.controls'], ['lure.toast.choices', 'svm.lure.toast.choices'],
                              ['lure.hints.unlocked', 'svm.lure.hints.unlocked']] as const) {
    const v = localStorage.getItem(oldK)
    if (v !== null && localStorage.getItem(newK) === null) localStorage.setItem(newK, v)
  }
} catch { /* 프라이빗 모드 등 */ }

export const SAVE_DIR = '/home/web_user/saves'
export const SAVE_POLL_MS = 5000
export const SAVE_MAX_BYTES = 512 * 1024
