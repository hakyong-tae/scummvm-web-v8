# scummvm-web-v8

ScummVM(Emscripten) 위에 **DOM 한글 자막 레이어**를 얹어 프리웨어 어드벤처 게임을 브라우저로 올리는 셸.
게임 하나짜리 프로젝트가 아니라 **여러 게임이 같은 셸을 공유**한다.

| 게임 | 엔진 | 상태 |
|---|---|---|
| Lure of the Temptress (1992, Revolution Software) | `lure` | 한글 1,804문장 · Verse8 배포 완료 |
| Sołtys (1995, Laboratorium Komputerowe Avalon) | `cge` | 한글 291문장 + 사물 이름 261개 · Verse8 배포 완료 |

- 게임 선택: `?game=<id>` → `VITE_GAME` → 기본 `lure`
- 구조·함정 전부: [NOTES.md](NOTES.md)
- 두 번째 게임을 붙인 과정과 CGE 엔진 분석: [docs/NEXT-GAME-CGE.md](docs/NEXT-GAME-CGE.md)
- 배포 절차: [docs/DEPLOY-VERSE8.md](docs/DEPLOY-VERSE8.md)

## 실행

```bash
export PATH="$HOME/.nvm/versions/node/v23.11.0/bin:$PATH"
npm install && npm run font:fetch
npm run game:fetch -- lure && npm run game:fetch -- soltys   # 원본 프리웨어 아카이브 다운로드(sha256 검증)
npm run engine:build      # ScummVM v2026.3.0 → wasm (ENGINES=lure,cge)
npm run data:stage
npm run dev               # http://localhost:3046/?game=soltys
```

`npm test` (vitest) · `npm run i18n:check -- --game=soltys` · `npm run smoke:boot -- --game=soltys --lang=ko`

## 왜 DOM 레이어인가

두 엔진 다 8px 단일바이트 비트맵 폰트라 CJK를 그릴 수 없다. 그래서 **원본 게임 데이터는 한 바이트도 건드리지 않고**,
엔진에 훅을 넣어 "무슨 글자가 화면 어디에 그려졌는지"를 JSON으로 뽑은 뒤 캔버스 위 DOM 레이어에 한글을 얹는다.

| | Lure (`engine-patches/01`) | CGE (`engine-patches/06`) |
|---|---|---|
| 그리는 곳 | 화면 표면에 직접 | 스프라이트 비트맵 안 → 나중에 블릿 |
| 좌표 확보 | 같은 훅에서 | `Sprite::show()`에서 따로 |
| 번역 키 | `<table>:<local>` | SAY `ref` 정수 |

## 라이선스

- **셸 코드(`src/`, `tools/`, `tests/`)와 엔진 패치(`engine-patches/`)**: GPL-3.0-or-later (ScummVM 파생).
- **원작 게임**: 각 저작권자가 프리웨어로 공개한 것으로, **이 레포에는 게임 바이너리가 없다**(`games/*/data/`는 gitignore,
  `npm run game:fetch`가 공식 배포처에서 받는다). 원작 라이선스 전문은 `games/<game>/LICENSE-ORIGINAL.txt`.
  - Lure of the Temptress © 1992 Revolution Software Ltd.
  - Sołtys © 1995 Laboratorium Komputerowe Avalon
  - 두 라이선스 모두 자유 배포를 허용하되 **게임 자체에 요금을 부과하는 것을 금지**한다. 이 프로젝트도 그렇게 한다.
- **한글 번역(`games/*/ko.json`, `glossary.json`, `hints.json`)**: 이 프로젝트가 직접 쓴 저작물. 비공식이며 원작자와 무관하다.
  `games/*/strings.en.json`은 번역 대조용 원문 추출본으로, 위 원작 라이선스가 적용된다.
- **글꼴**: Neo둥근모 © Eunbin Jeong (Dalgona.) — SIL Open Font License 1.1. (레포에 포함하지 않고 `npm run font:fetch`)
