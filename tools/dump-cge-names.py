#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""CGE(vol.dat)에서 스프라이트 이름을 전부 뽑는다 — 상태줄에 뜨는 라벨은 SAY 파일이 아니라
   .SPR 파일의 `name=` 줄에 있어서 엔진 문자열 덤프로는 열거되지 않는다.
   vol.dat 전체가 단일 바이트 XOR(kCryptSeed 0xA5, cge/cge.h)이라 통째로 풀고 훑으면 된다.
   ⚠️ .SPR 텍스트가 이진 데이터 바로 뒤에 붙어 있어 줄머리(^) 앵커로 찾으면 절반을 놓친다.
     python3 tools/dump-cge-names.py [vol.dat] [--json]
"""
import re, sys, json

SEED = 0xA5
args = [a for a in sys.argv[1:] if not a.startswith('--')]
path = args[0] if args else 'games/soltys/data/soltys/vol.dat'
raw = bytes(b ^ SEED for b in open(path, 'rb').read())
text = raw.decode('cp437', errors='replace')

names, seen = [], set()
for m in re.finditer(r'(?i)name[ \t]*=[ \t]*([\x20-\x7e]+)\r?\n', text):
    n = m.group(1).strip()
    if not n or n in seen:
        continue
    if re.fullmatch(r'\d\d:\d\d', n):      # setMapBrick 이 만드는 좌표 이름
        continue
    seen.add(n)
    names.append(n)

names.sort(key=str.lower)
if '--json' in sys.argv:
    print(json.dumps({"count": len(names), "names": names}, ensure_ascii=False, indent=1))
else:
    for n in names:
        print(n)
    print(f'--- {len(names)} names', file=sys.stderr)
