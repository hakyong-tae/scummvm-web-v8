/** 셸 UI 문자열 — 게임과 무관한 것만. 게임별 문안(부제·조작 안내·고지 원작 문단)은 config.ts GameDef.text. */
export const UI = {
  ko: {
    start: '게임 시작', preparing: '준비 중…', loadingEngine: '엔진 로딩 중…', loading: '불러오는 중…',
    langBtn: '자막: 한국어', info: '정보 / 라이선스', hints: '💡 힌트',
    settings: '설정', touchMode: '터치 조작', touchTrackpad: '트랙패드(드래그로 커서)', touchDirect: '직접 탭', subtitles: '자막',
    controlsTitle: '조작법', choicesHint: '할 말을 골라 탭하세요',
    cloudLocal: '저장: 로컬', cloudIdle: '저장: 클라우드', cloudSyncing: '저장: 동기화 중', cloudError: '저장: 오류',
    rotate: '가로로 돌려 주세요', rotateSub: '이 게임은 가로 화면에 맞춰져 있습니다',
    quit: '게임을 종료했습니다.', restart: '다시 시작',
    confirmRestore: (slots: string) => `다른 기기의 세이브가 더 최신입니다.\n(${slots})\n클라우드 세이브를 불러올까요? 취소하면 이 기기의 세이브를 유지하고 업로드합니다.`,
    yes: '예', no: '아니오', esc: 'Esc', keyboard: '⌨ 입력', kbdTitle: '게임에 글자 입력', kbdSend: '입력', kbdEnter: 'Enter', kbdClose: '닫기',
    hintsTitle: '힌트', hintsIntro: '광고 한 편을 끝까지 보면 힌트 하나가 열립니다. 중간에 닫아도 불이익은 없습니다. 연 힌트는 이 기기에 저장됩니다.', hintsWatch: '광고 보고 이 힌트 열기', hintsUnlocked: '열린 힌트', hintsNotRewarded: '광고를 끝까지 보지 않아 힌트가 열리지 않았습니다. 다시 시도할 수 있습니다.', close: '닫기',
    noticeTitle: '정보 / 라이선스',
  },
  en: {
    start: 'Start Game', preparing: 'Preparing…', loadingEngine: 'Loading engine…', loading: 'Loading…',
    langBtn: 'Subtitles: English', info: 'Info / License', hints: '💡 Hints',
    settings: 'Settings', touchMode: 'Touch control', touchTrackpad: 'Trackpad (drag cursor)', touchDirect: 'Direct tap', subtitles: 'Subtitles',
    controlsTitle: 'Controls', choicesHint: 'Tap a line to say it',
    cloudLocal: 'Save: local', cloudIdle: 'Save: cloud', cloudSyncing: 'Save: syncing', cloudError: 'Save: error',
    rotate: 'Please rotate your device', rotateSub: 'This game is designed for landscape',
    quit: 'The game has ended.', restart: 'Restart',
    confirmRestore: (slots: string) => `A newer save exists on another device.\n(${slots})\nLoad the cloud save? Cancel keeps this device's save and uploads it.`,
    yes: 'Yes', no: 'No', esc: 'Esc', keyboard: '⌨ Type', kbdTitle: 'Type text into the game', kbdSend: 'Send', kbdEnter: 'Enter', kbdClose: 'Close',
    hintsTitle: 'Hints', hintsIntro: 'Watch one ad to the end to unlock one hint. Closing early costs nothing. Unlocked hints stay on this device.', hintsWatch: 'Watch ad to unlock this hint', hintsUnlocked: 'Unlocked', hintsNotRewarded: 'The ad was not completed, so hints stay locked. You can try again.', close: 'Close',
    noticeTitle: 'Info / License',
  },
} as const
export type UiLang = keyof typeof UI
export type UiStrings = typeof UI['ko']
export const ui = (lang: string): UiStrings => (lang === 'en' ? UI.en : UI.ko) as UiStrings
