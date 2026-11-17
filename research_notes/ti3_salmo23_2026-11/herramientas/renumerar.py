import sys,re
p=sys.argv[1]; t=open(p,encoding='utf-8').read()
body,notes=t.split('\n## Notas\n')
order=[]
for m in re.finditer(r'\[\^(\w+)\](?!:)',body):
    if m.group(1) not in order: order.append(m.group(1))
mp={old:str(i+1) for i,old in enumerate(order)}
defs=dict(re.findall(r'^\[\^(\w+)\]:\s*(.+)$',notes,flags=re.M))
missing=[o for o in order if o not in defs]; unused=[d for d in defs if d not in mp]
assert not missing, f'sin definición: {missing}'
assert not unused, f'definiciones sin uso (se perderían): {unused}'
body=re.sub(r'\[\^(\w+)\](?!:)',lambda m:f'[^{mp[m.group(1)]}]',body)
nd='\n\n'.join(f'[^{mp[o]}]: {defs[o]}' for o in order)
open(p,'w',encoding='utf-8').write(body+'\n## Notas\n\n'+nd+'\n')
print('notas',len(order),'sin usar',unused)
