#!/usr/bin/env python3
"""Copia os dados do D1 local (.wrangler/state) para o Supabase, pela função exec_sql.
Uso: python3 scripts/migrate-d1-to-supabase.py [--wipe]   (--wipe apaga primeiro os dados do Supabase)
Lê SUPABASE_URL e SUPABASE_SECRET_KEY do .env. O esquema tem de existir (supabase/migrations)."""
import glob,json,os,sqlite3,sys,urllib.request,urllib.error
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env={}
for line in open(os.path.join(root,'.env')):
    if '=' in line and not line.lstrip().startswith('#'):
        k,v=line.strip().split('=',1);env[k]=v
URL,KEY=env['SUPABASE_URL'],env['SUPABASE_SECRET_KEY']
def rpc(stmts):
    req=urllib.request.Request(URL+'/rest/v1/rpc/exec_sql',data=json.dumps({'stmts':stmts}).encode(),headers={'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json'},method='POST')
    try:
        with urllib.request.urlopen(req) as r:return json.load(r)
    except urllib.error.HTTPError as e:raise SystemExit('Erro Supabase: '+e.read().decode()[:400])
ORDER=['properties','property_rates','unit_keysafes','corporates','corporate_properties','training_workspace','tools','collaborators','collaborator_results','operators','operator_properties','operator_messages','operator_attachments','campaigns','campaign_properties','campaign_rates','campaign_operators','team_members','team_member_properties']
if '--wipe' in sys.argv:
    rpc([{'sql':f'DELETE FROM {t} WHERE true','params':[]} for t in reversed(ORDER) if t in('properties','corporates','collaborators','operators','campaigns','team_members','training_workspace','tools')])
db=sqlite3.connect(glob.glob(os.path.join(root,'.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite'))[[i for i,p in enumerate(glob.glob(os.path.join(root,'.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite'))) if 'metadata' not in p][0]]);db.row_factory=sqlite3.Row
total=0
for t in ORDER:
    rows=[dict(r) for r in db.execute(f'SELECT * FROM {t}')]
    if not rows:print(f'{t:26} 0');continue
    cols=list(rows[0].keys());sql=f'INSERT INTO {t} ({",".join(cols)}) VALUES ({",".join("$"+str(i+1) for i in range(len(cols)))}) ON CONFLICT DO NOTHING'
    for i in range(0,len(rows),40):
        rpc([{'sql':sql,'params':[r[c] for c in cols]} for r in rows[i:i+40]])
    print(f'{t:26} {len(rows)}');total+=len(rows)
print('total de linhas copiadas:',total)
