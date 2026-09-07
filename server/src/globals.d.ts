// 로컬 tsc용 ambient 선언(V8 빌드는 타입체크 안 함). tsconfig include에 server/는 없음 — 참고용.
declare const $global: any
declare const $room: any
declare const $sender: { account: string; isGuest?: boolean }
