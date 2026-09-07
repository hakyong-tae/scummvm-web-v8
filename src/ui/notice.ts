import { assetUrl, GAME_TITLE } from '../config'

/** 라이선스·출처 고지 모달. 원본 LICENSE/README 전문은 배포본 안의 게임 데이터 폴더에서 그대로 읽는다. */
export async function openNotice(lang: string = 'ko') {
  const [license, readme] = await Promise.all([
    fetch(assetUrl('engine/data/games/lure/LICENSE.txt')).then(r => r.ok ? r.text() : '').catch(() => ''),
    fetch(assetUrl('engine/data/games/lure/README')).then(r => r.ok ? r.text() : '').catch(() => ''),
  ])
  const src = import.meta.env.VITE_SOURCE_URL as string | undefined
  const wrap = document.createElement('div'); wrap.className = 'modal'
  wrap.innerHTML = `
    <div class="modal-box">
      <h2>${GAME_TITLE}</h2>
      ${lang === 'en' ? `<p><b>Original</b> Lure of the Temptress © 1992 Revolution Software Ltd. — released as freeware by its copyright holder. This edition does <b>not modify a single byte</b> of the original game data and charges nothing for the game itself.</p>
      <p><b>Korean</b> An unofficial Korean subtitle layer, authored for this web edition and rendered as an overlay above the original text.</p>
      <p><b>Engine</b> ScummVM v2026.3.0 (GNU GPL v3). Engine modifications (patches) are published under GPLv3${src ? `: <a href="${src}" target="_blank" rel="noopener">source repository</a>` : ' (see engine-patches/ in this build)'}.</p>
      <p><b>Font</b> Neo둥근모 © Eunbin Jeong (Dalgona.) — SIL Open Font License 1.1.</p>` : `<p><b>원작</b> Lure of the Temptress © 1992 Revolution Software Ltd. — 저작권자가 프리웨어로 공개한 게임입니다. 이 배포본은 원본 게임 데이터를 <b>바이트 하나도 수정하지 않았으며</b>, 게임 자체에 요금을 부과하지 않습니다.</p>
      <p><b>한글</b> 비공식 한글 자막 레이어입니다. 번역은 이 웹판 제작자의 저작물로 원작과 무관하며, 원본 텍스트 위에 화면 레이어로만 표시됩니다.</p>
      <p><b>엔진</b> ScummVM v2026.3.0 (GNU GPL v3). 이 배포본의 엔진 수정(패치)은 GPLv3로 공개됩니다${src ? `: <a href="${src}" target="_blank" rel="noopener">소스 저장소</a>` : ' (배포본 engine-patches/ 참조)'}.</p>
      <p><b>글꼴</b> Neo둥근모 © Eunbin Jeong (Dalgona.) — SIL Open Font License 1.1.</p>`}
      <details><summary>${lang === 'en' ? 'Original LICENSE.txt / README' : '원본 LICENSE.txt / README 전문'}</summary><pre>${escapeHtml(license)}\n\n${escapeHtml(readme)}</pre></details>
      <button class="close">${lang === 'en' ? 'Close' : '닫기'}</button>
    </div>`
  wrap.querySelector('.close')!.addEventListener('click', () => wrap.remove())
  wrap.addEventListener('click', e => { if (e.target === wrap) wrap.remove() })
  document.body.appendChild(wrap)
}
const escapeHtml = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!))
