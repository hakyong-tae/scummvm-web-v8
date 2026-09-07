# 원스토어 지원 폼 답안 — Lure of the Temptress (한글판)

폼: [Verse8] Application Form for ONE Store. 아래는 그대로 붙여 넣을 답안(KO / EN 병기). `▢`는 폰 실기기 확인 후 체크할 항목.

## 기본 정보
- **이메일**: (Verse8 로그인 이메일)
- **Discord ID**: (본인 ID)
- **Game Title**: `Lure of the Temptress (한글판)`
- **Verse8 Game Link**: (게시 후 링크, Public/Unlisted)
- **GitLab 저장소 경로**: `hy.tae90/lure-of-the-temptress-kr` (토큰 붙이지 말 것)

## 2. 화면
- **방향**: 가로로만 / Landscape only (세로면 회전 안내 표시)
- **확인 기기**: (예: "갤럭시 S23, 아이폰 13 미니" — 실제 테스트한 모델명)
- **육안 오류**: ▢ 겹침 없음 ▢ 글자 또렷 ▢ 잘림 없음 — 폰에서 확인 후 체크
- **진행 오류**: ▢ 30분 플레이 ▢ 터치만으로 처음부터 끝까지 ▢ 느려지지 않음 ▢ 전환 끊김 없음 ▢ 멈춤/튕김 없음
  - 터치 전용 보조: 롱프레스=동작 메뉴, HUD `Esc`(인트로 스킵/종료), `⌨ 입력`(세이브 이름), 엔진 y/n 확인창에 [예/아니오] 버튼 자동 표시

## 3. 언어
- **언어는 어디서 바꾸나요**:
  KO: 메인(타이틀) 화면의 "자막: 한국어 / Subtitles: English" 버튼, 그리고 게임 중 우상단 ⚙ 설정 패널의 "자막" 드롭다운. 게임 내 대사·설명·메뉴가 즉시 전환되고, 시작 화면·설정·고지·종료 화면 등 UI도 함께 전환됩니다.
  EN: "Subtitles" toggle button on the title screen, and the "Subtitles" dropdown in the ⚙ settings panel (top-right) during play. In-game text switches immediately; all shell UI (title, settings, notices, quit screen) switches with it.
- **스크린샷(옵션)**: 타이틀 화면 + ⚙ 설정 패널 캡처 첨부
- **게임 진행 언어**: ▢ 전환 시 모든 텍스트 해당 언어 ▢ 잘림/겹침 없음 — 폰에서 두 언어 모두 확인 후 체크
  (참고: 상단 메뉴바 그림 글자와 인트로 자막은 원본 영문 비트맵으로 양 언어에서 동일합니다)
- **설명 KO→EN**: ▢ 한국어 ▢ 영어 ▢ 한국어 뒤 영어 — `docs/STORE-SHORT.md` 그대로 V8 설명칸에 입력

## 4. 서버 저장
- 게임 세이브(슬롯 파일)가 Verse8 계정으로 agent8 서버(컬렉션 `lure_saves`)에 저장되어 기기 간 이어하기 가능. 점수/순위표는 없는 어드벤처 게임이라 '최고 기록' 항목은 해당 없음.
- ▢ PC→폰 ▢ 폰→PC — 실기기 왕복 확인 후 체크 (`저장: 클라우드` 배지 확인)

## 5. 광고·결제
- **수익화 설명**:
  KO: 전면 광고 — [게임 시작] 버튼을 누르면 엔진 로딩 전에 1회, 게임 종료(Quit) 시 1회. 자발적(Opt-in) 광고 — 게임 중 우상단 `💡 힌트` 버튼 → 광고를 끝까지 보면 이번 세션 동안 구간별 공략 힌트 열람. VX 결제 — 없음(원작 프리웨어 라이선스가 게임 유료화를 금지하므로 유료 해금 없음).
  EN: Interstitial — once when pressing Start (before the engine loads) and once on Quit. Opt-in (rewarded) — the `💡 Hints` button (top-right) during play; watching to the end unlocks walkthrough hints for the session. VX purchases — none (the original's freeware license forbids charging for the game).
- **보상**: ☑ 끝까지 보면 보상(힌트 해금) ☑ 중간에 닫으면 보상 없음 ☑ 중간에 닫아도 불이익 없음(다시 시도 가능)
- **타임아웃 120초**: ☑ 네 — 모든 호출(`showInterstitial` 2곳, `showRewarded` 1곳)에 `timeoutMs: 120_000` 명시 (`src/verse8/ads.ts`)
- **VX 결제**: 결제 기능 없음 / No purchases

## 6. 확률형 아이템
- 없음 / No (유료 경로 없음, 랜덤 요소 없음) · 자진신고 확약: 동의

## 7. 그 밖에
KO: 1992년 Revolution Software가 프리웨어로 공개한 원작을 ScummVM(GPLv3) Emscripten 빌드로 구동합니다. 원본 게임 데이터는 무개조이며, 한글은 비공식 자막 레이어(1,804문장)입니다. 라이선스상 게임 자체 유료화는 불가하여 수익화는 광고만 적용했습니다. 고지 화면(ⓘ)에 원본 LICENSE 전문·GPL·폰트 라이선스를 표시합니다.
EN: Runs the 1992 freeware original (Revolution Software) on a ScummVM (GPLv3) Emscripten build. Game data is unmodified; Korean is an unofficial subtitle layer (1,804 lines). The license forbids charging for the game, so monetisation is ads only. The ⓘ screen shows the original LICENSE, GPL and font licenses.
