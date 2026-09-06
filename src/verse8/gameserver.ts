// agent8 GameServer 연결 래퍼 (server-survival-v8 패턴 이식).
//
// ⚠️ 접속은 반드시 SDK의 zustand 스토어를 통해서. GameServer.connect()를 직접 부르면
// SDK가 focus/visibilitychange마다 스토어 플래그(false)를 보고 재접속 → 열린 소켓을
// 무조건 찢는 무한 재접속 폭풍. 아래 딥임포트는 리터럴 문자열이어야 함(@vite-ignore 금지).
import { GameServer } from '@agent8/gameserver'

let instance: GameServer | null = null
let connected = false
let attempt: Promise<boolean> | null = null
let epoch = 0
const BUDGET_MS = 6000

export const hasPlatform = () => Boolean(import.meta.env.VITE_AGENT8_VERSE)

export function getGameServer(): GameServer {
  if (!instance) instance = GameServer.getInstance()
  return instance
}

async function connectViaStore(budgetMs: number): Promise<boolean> {
  const { useGameServerStore } = await import('@agent8/gameserver/dist/src/store/useGameServerStore')
  const store = useGameServerStore.getState()
  if (store.connected) return true
  void store.connect()
  const deadline = Date.now() + budgetMs
  while (Date.now() < deadline) {
    if (useGameServerStore.getState().connected) return true
    await new Promise(r => setTimeout(r, 200))
  }
  return false
}

export async function ensureConnected(budgetMs = BUDGET_MS): Promise<boolean> {
  if (!hasPlatform()) return false
  if (connected) return true
  if (!attempt) {
    const my = ++epoch
    attempt = connectViaStore(budgetMs)
      .then(ok => { if (my === epoch) connected = ok; return connected })
      .catch(err => { console.warn('[v8] connect failed', err); if (my === epoch) connected = false; return false })
      .finally(() => { if (my === epoch) attempt = null })
  }
  const shared = attempt
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([shared, new Promise<boolean>(res => { timer = setTimeout(() => res(false), budgetMs) })])
  } finally { if (timer !== undefined) clearTimeout(timer) }
}

export const isConnected = () => connected

/** 서버 함수 호출. 플랫폼 밖이거나 실패하면 fallback. */
export async function callServer<T>(fn: string, args: unknown[] = [], fallback: T): Promise<T> {
  if (!(await ensureConnected())) return fallback
  try { return (await getGameServer().remoteFunction(fn, args)) as T }
  catch (err) { console.warn(`[v8] remoteFunction ${fn} failed`, err); return fallback }
}
