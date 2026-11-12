"""Extract actual solid faces, retaining portal holes and fence positions.
Run after build-nfs-special.py. No bounding-box walls or road-width barriers.
"""
import json
import numpy as np
from scipy.spatial import cKDTree
from nfs_mesh import load,ROOT
for slug,name,rail in [('summit','summit',(417,147,459,167)),('rocky','rocky-pass',(131,97,193,127)),('redrock','redrock-ridge',(253,602,314,631))]:
 path=ROOT/'js'/f'nfs-{slug}-data.js';s=path.read_text();start=s.index(']=')+2;data=json.loads(s[start:].strip().rstrip(';'))
 ts,uv,im=load(name);pixels=np.array(im);norm=np.cross(ts[:,1]-ts[:,0],ts[:,2]-ts[:,0]);area=np.linalg.norm(norm,axis=1)
 bounds=np.rint(np.c_[uv.min(1),uv.max(1)]*np.array(im.size*2)).astype(int)
 # Reject cutout tiles (trees/sign silhouettes), not dark rock texels.
 # Redrock's supplied alpha stores brightness; only zero is a cutout there.
 opaque=[];tiles={}
 for bounds_i in bounds:
  key=tuple(bounds_i)
  if key not in tiles:
   x0,y0,x1,y1=bounds_i;x0=max(0,x0);y0=max(0,y0);x1=min(im.width,x1+1);y1=min(im.height,y1+1)
   tile=pixels[y0:y1,x0:x1,3]
   tiles[key]=bool(tile.size and np.mean(tile>(0 if slug=='redrock' else 50))>.98)
  opaque.append(tiles[key])
 opaque=np.array(opaque)
 # Vegetation billboards are perforated; solid guardrail spans are intentional.
 fence=np.all(np.abs(bounds-np.array(rail))<=1,axis=1)
 solid=(opaque|fence)&(area>1e-6)
 walls=solid&(np.abs(norm[:,1])<area*.65)
 ceilings=opaque&(np.abs(norm[:,1])>=area*.65)
 # Road faces already live in the support mesh; only overhead faces belong
 # in the roof query. This avoids shipping a second copy of the entire floor.
 floor=np.array(data['vertices']).reshape(-1,3)[np.array(data['indices']).reshape(-1,3)][:,:,[0,2,1]]
 distance,_=cKDTree(floor.mean(1)).query(ts.mean(1))
 ceilings&=distance>.04
 def pack(selected):
  faces=ts[selected][:,:,[0,2,1]].round(4)
  # Opposite-winding duplicates produce one contact, never opposing impulses.
  seen=set();out=[]
  for t in faces:
   key=tuple(sorted(map(tuple,t)))
   if key not in seen:seen.add(key);out.extend(t.reshape(-1).tolist())
  return out
 data['walls']=pack(walls);data['ceilings']=pack(ceilings)
 path.write_text(s[:start]+json.dumps(data,separators=(',',':'))+';\n')
 print(slug,'walls',len(data['walls'])//9,'overhead',len(data['ceilings'])//9,'rails',int(fence.sum()))
