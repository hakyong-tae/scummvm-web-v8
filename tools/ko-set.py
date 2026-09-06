#!/usr/bin/env python3
"""stdin JSON {"list":{...},"t":{...}} 을 games/lure/ko.json 에 병합"""
import json,sys,os
p=os.path.join(os.path.dirname(__file__),'..','games','lure','ko.json')
ko=json.load(open(p)); add=json.load(sys.stdin)
for sec in ('list','t'):
    for k,v in add.get(sec,{}).items(): ko.setdefault(sec,{})[k]=v
# 키 정렬(테이블:로컬 숫자순)
ko['list']=dict(sorted(ko['list'].items(), key=lambda kv:int(kv[0])))
ko['t']=dict(sorted(ko['t'].items(), key=lambda kv:tuple(map(int,kv[0].split(':')))))
json.dump(ko,open(p,'w'),ensure_ascii=False,indent=1); open(p,'a').write('\n')
print('ko.json: list',len(ko['list']),'t',len(ko['t']))
