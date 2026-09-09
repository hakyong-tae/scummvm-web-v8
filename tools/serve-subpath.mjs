// deploy/<game>/dist 를 하위경로(/g/<game>/)로 서빙 — Verse8 하위경로 호스팅 재현용.
// 실행: node tools/serve-subpath.mjs [game] [port]   (기본 3057 — 3047은 다른 프로젝트가 쓴다)
import http from 'node:http'; import { createReadStream, statSync } from 'node:fs'; import { join, extname, normalize } from 'node:path'
const args = process.argv.slice(2).filter(a => !a.startsWith('--'))
const game = /^\d+$/.test(args[0] ?? '') ? 'lure' : (args[0] || 'lure')
const root = new URL(`../deploy/${game}/dist/`, import.meta.url).pathname
const prefix = `/g/${game}/`; const port = Number(args.find(a => /^\d+$/.test(a)) || 3057)
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.ini': 'text/plain', '.woff2': 'font/woff2', '.dat': 'application/octet-stream', '.zip': 'application/zip', '.txt': 'text/plain; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' }
http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0])
  if (!url.startsWith(prefix)) { res.writeHead(404); return res.end('not under ' + prefix) }
  let rel = url.slice(prefix.length) || 'index.html'; if (rel.endsWith('/')) rel += 'index.html'
  const file = normalize(join(root, rel)); if (!file.startsWith(root)) { res.writeHead(403); return res.end() }
  try { const st = statSync(file); if (st.isDirectory()) throw 0
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Content-Length': st.size }); createReadStream(file).pipe(res)
  } catch { res.writeHead(404); res.end('404 ' + rel) }
}).listen(port, () => console.log(`serving ${root} at http://localhost:${port}${prefix}`))
