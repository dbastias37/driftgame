"""Extract only traffic signs, their coplanar backs and matching poles.

Keeps original atlas UVs. Collision exclusions name exact source triangles;
rocks, barriers, advertising and building meshes are never blanket-filtered.
Run with Python, numpy, scipy and Pillow when an imported track changes.
"""
import sys,json,struct,io,collections
from pathlib import Path
import numpy as np
from scipy.spatial.transform import Rotation
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
def read(name):
 b=(ROOT/'assets/bonus'/f'{name}.glb').read_bytes();size=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+size]);binary=b[28+size:]
 def acc(i):
  a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];dt={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']];w={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
  return np.ndarray((a['count'],w),dtype=dt,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',np.dtype(dt).itemsize*w),np.dtype(dt).itemsize)).copy()
 ims=[]
 for im in g['images']:
  v=g['bufferViews'][im['bufferView']];ims.append(Image.open(io.BytesIO(binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])).convert('RGBA'))
 meshes=[]
 def visit(i,m):
  n=g['nodes'][i];l=np.array(n['matrix']).reshape(4,4).T if 'matrix' in n else np.eye(4)
  if 'matrix' not in n:l[:3,:3]=Rotation.from_quat(n.get('rotation',[0,0,0,1])).as_matrix()@np.diag(n.get('scale',[1,1,1]));l[:3,3]=n.get('translation',[0,0,0])
  m=m@l
  if 'mesh' in n:
   for pi,p in enumerate(g['meshes'][n['mesh']]['primitives']):
    v=acc(p['attributes']['POSITION']);v=(np.c_[v,np.ones(len(v))]@m.T)[:,:3];idx=acc(p['indices']).reshape(-1,3);ts=v[idx];uv=acc(p['attributes']['TEXCOORD_0'])[idx];mat=g['materials'][p['material']];imidx=g['textures'][mat['pbrMetallicRoughness']['baseColorTexture']['index']]['source'];im=ims[imidx]
    bounds=np.rint(np.c_[uv.min(1),uv.max(1)]*np.array(im.size*2)).astype(int)
    meshes.append(dict(node=i,mesh=n['mesh'],name=n['name'],primitive=pi,ts=ts,uv=uv,bounds=bounds,imidx=imidx,mat=mat['name']))
  for ch in n.get('children',[]):visit(ch,m)
 for i in g['scenes'][g.get('scene',0)]['nodes']:visit(i,np.eye(4))
 return meshes,ims

TILES={
 'summit':[(388,119,408,139),(388,98,408,117),(460,492,480,511),(460,449,480,469),(460,428,480,448),(1,312,20,360),(460,301,480,321),(460,280,480,300),(460,89,480,109),(460,68,480,88),(43,44,63,63),(85,44,105,63)],
 'rocky':[(195,74,225,104),(513,458,543,488),(513,490,543,520),(321,522,351,552),(417,522,447,552),(385,554,415,584),(1,129,31,200),(449,554,479,584),(481,554,511,584),(465,586,495,616),(659,1,689,31)],
 'redrock':[(683,190,712,219),(589,123,634,184),(683,252,712,281),(683,283,712,312),(683,314,712,343),(683,438,712,467),(1,634,62,662)],
 'glen':[(4,819,573,925)]
}
POLES={'summit':[(502,390,505,393)],'rocky':[(683,625,688,630)],'redrock':[(714,167,727,196)],'glen':[]}
def tile_match(bounds,tiles):
 return any(np.max(np.abs(bounds-np.array(t)))<=1 for t in tiles)
def face_key(t):
 # Same quantization as JS; centimetre welding is deliberately NOT used here.
 return '|'.join(','.join(str(int(v)) for v in row) for row in sorted(map(tuple,np.floor(t*1000+.5).astype(int))))
def components(indices,triangles):
 parent={int(i):int(i) for i in indices};vertices={}
 def root(i):
  while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
  return i
 for i in indices:
  for v in triangles[i]:
   key=tuple(np.rint(v*100).astype(int))
   if key in vertices:parent[root(i)]=root(vertices[key])
   else:vertices[key]=int(i)
 groups=collections.defaultdict(list)
 for i in indices:groups[root(i)].append(int(i))
 return list(groups.values())

def build(slug,name):
 meshes,images=read(name);tris=np.concatenate([m['ts'] for m in meshes]);uvs=np.concatenate([m['uv'] for m in meshes]);owners=[];front=[];pole=[];offset=0
 for mi,m in enumerate(meshes):
  for i,b in enumerate(m['bounds']):
   owners.append((mi,i))
   # Glen's atlas is shared with barriers. Only the complete chevron panel tile
   # identifies a sign; tiny reused yellow/black UV fragments stay structural.
   eligible=slug!='glen' or m['imidx']==13
   if eligible and tile_match(b,TILES[slug]):front.append(offset+i)
   if tile_match(b,POLES[slug]):pole.append(offset+i)
  offset+=len(m['ts'])
 removed=set();signs=[];centers=tris.mean(1)
 glen_posts=np.array([i for i,(mi,f) in enumerate(owners) if meshes[mi]['imidx']==13 and meshes[mi]['bounds'][f,0]>=580 and meshes[mi]['bounds'][f,2]<=1016 and meshes[mi]['bounds'][f,1]<0],dtype=int) if slug=='glen' else np.array([],dtype=int)
 for ids in components(front,tris):
  vs=tris[ids].reshape(-1,3);lo=vs.min(0);hi=vs.max(0);center=(lo+hi)/2
  n=np.cross(tris[ids[0],1]-tris[ids[0],0],tris[ids[0],2]-tris[ids[0],0]);n[1]=0;n/=np.linalg.norm(n)
  right=np.array([n[2],0,-n[0]]);local=(tris-center)@right;depth=(tris-center)@n
  width=np.ptp((vs-center)@right);half=width/2
  # Exact panel volume: includes alternative diagonals, duplicate backfaces and
  # narrow edge faces on the thick Glen boards, but no surrounding scenery.
  panel=(np.max(np.abs(local),axis=1)<=half+.08)&(np.max(np.abs(depth),axis=1)<.18)&(tris[:,:,1].min(1)>=lo[1]-.08)&(tris[:,:,1].max(1)<=hi[1]+.08)
  own=set(np.flatnonzero(panel).tolist())|set(ids)
  # Match only the authored pole tiles at the same anchor, not nearby rails.
  for i in pole:
   v=tris[i]
   if np.max(np.linalg.norm((v-center)[:,[0,2]],axis=1))<.65 and v[:,1].min()>lo[1]-6 and v[:,1].max()<=hi[1]:own.add(i)
  posts=[]
  if slug=='glen':
   ts=tris[glen_posts];ext=np.ptp(ts,axis=1)
   mask=(np.max(np.abs(local[glen_posts]),axis=1)<half+.25)&(np.max(np.abs(depth[glen_posts]),axis=1)<.8)&(ts[:,:,1].min(1)>lo[1]-6)&(ts[:,:,1].max(1)<hi[1]+.4)&(ext[:,1]>1)&(np.max(ext[:,[0,2]],axis=1)<1.2)
   for ids_pole in components(glen_posts[mask],tris):
    pv=tris[ids_pole].reshape(-1,3);pmin=pv.min(0);pmax=pv.max(0)
    # Include the post caps as well as its vertical sides.
    inside=(tris>=pmin-.02).all((1,2))&(tris<=pmax+.02).all((1,2));own.update(np.flatnonzero(inside).tolist())
    posts.append({'x':round(float(((pmin+pmax)/2-center)@right),5),'bottom':float(pmin[1]),'top':float(pmax[1])})
  ground=min(tris[i,:,1].min() for i in own)
  # Some chevron boards have no modelled supports; retain their existing base.
  anchor=[float(center[0]),float(center[2]),float(ground)]
  pos=[];uv=[];seen=set()
  for i in ids:
   key=face_key(tris[i]);
   if key in seen:continue
   seen.add(key)
   p=np.c_[(tris[i]-center)@right,tris[i,:,1]-ground,np.full(3,.03)]
   # Local +Z is the ONLY printed side. Preserve the UV orientation.
   if np.cross(p[1]-p[0],p[2]-p[0])[2]<0:p=p[[0,2,1]];u=uvs[i][[0,2,1]]
   else:u=uvs[i]
   pos.extend(p.reshape(-1).round(5).tolist());uv.extend(u.reshape(-1).round(7).tolist())
  source=meshes[owners[ids[0]][0]]
  sign={'x':round(anchor[0],5),'y':round(anchor[1],5),'ground':round(anchor[2],5),'height':round(float(hi[1]-ground),5),'width':round(float(width),5),'pole':round(float(max(0,lo[1]-ground+.15)),5),'boardBottom':round(float(lo[1]-ground),5),'source':f"{source['mesh']}:{source['primitive']}",'positions':pos,'uv':uv}
  if posts:sign['posts']=[{'x':p['x'],'bottom':round(p['bottom']-ground,5),'height':round(p['top']-p['bottom'],5)} for p in posts]
  signs.append(sign)
  removed.update(own)
 masks=collections.defaultdict(list)
 for i in sorted(removed):
  mi,face=owners[i];m=meshes[mi];masks[f"{m['mesh']}:{m['primitive']}"].append(face)
 path=ROOT/'js'/('glen-data.js' if slug=='glen' else f'nfs-{slug}-data.js');text=path.read_text();start=text.index('={"')+1;data=json.loads(text[start:].strip().rstrip(';'))
 from scipy.spatial import cKDTree
 selected=tris[list(removed)][:,:,[0,2,1]];tree=cKDTree(selected.mean(1));solid=set();counts={}
 # The collider builders round to four decimals; tolerate that rounding when
 # matching, then store the exact key of each shipped collision/support face.
 for k in ['walls','ceilings','support']:
  faces=(np.array(data['vertices']).reshape(-1,3)[np.array(data['indices']).reshape(-1,3)] if k=='support' else np.array(data.get(k,[])).reshape(-1,3,3))
  distances,indices=tree.query(faces.mean(1),k=4);matches=[]
  for t,ds,ii in zip(faces,distances,indices):
   for distance,index in zip(ds,ii):
    if distance>.003:break
    # Every vertex must correspond, not merely the face's bounding box/centre.
    if np.max(np.min(np.linalg.norm(t[:,None,:]-selected[index][None,:,:],axis=2),axis=1))<.003:matches.append(face_key(t));break
  counts[k]=len(matches);solid.update(matches)
 result={'signs':signs,'remove':dict(masks),'solidFaces':sorted(solid)}
 print(slug,len(signs),'signs,',len(removed),'visual faces, collision exclusions',counts)
 return result
if __name__=='__main__':
 data={slug:build(slug,name) for slug,name in [('summit','summit'),('rocky','rocky-pass'),('redrock','redrock-ridge'),('glen','glen-canyon-dam')]}
 (ROOT/'js/road-sign-data.js').write_text('// Generated by scripts/build-road-signs.py. Original traffic sign artwork and exact collision exclusions.\nglobalThis.DriftSignData='+json.dumps(data,separators=(',',':'))+';\n')
