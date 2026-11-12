"""Import the supplied GT Racing 2 Glen Canyon Dam.

python3 scripts/build-glen-canyon.py /path/to/gt_racing_2_-_glen_canyon_dam.glb
Requires numpy, scipy, scikit-image and Pillow. Meshes/transforms/UVs remain
unchanged. Opaque texture PNGs are recompressed as JPEG at original resolution;
alpha textures stay PNG. The route is authored on the supplied roadway.
"""
import collections, hashlib, io, json, struct, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.spatial import cKDTree
from scipy.spatial.transform import Rotation
from scipy.ndimage import binary_closing, distance_transform_edt, gaussian_filter1d
from skimage.draw import polygon
from skimage.graph import route_through_array
ROOT=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1]);blob=source.read_bytes();size=struct.unpack_from('<I',blob,12)[0];g=json.loads(blob[20:20+size]);binary=blob[28+size:]
def acc(i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];dt={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']];w={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
 return np.ndarray((a['count'],w),dtype=dt,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',np.dtype(dt).itemsize*w),np.dtype(dt).itemsize)).copy()
tris=[];mats=[]
def visit(i,m):
 n=g['nodes'][i]
 if 'matrix' in n:l=np.array(n['matrix']).reshape(4,4).T
 else:
  l=np.eye(4);l[:3,:3]=Rotation.from_quat(n.get('rotation',[0,0,0,1])).as_matrix()@np.diag(n.get('scale',[1,1,1]));l[:3,3]=n.get('translation',[0,0,0])
 m=m@l
 if 'mesh' in n:
  for p in g['meshes'][n['mesh']]['primitives']:
   v=acc(p['attributes']['POSITION']);v=(np.c_[v,np.ones(len(v))]@m.T)[:,:3];idx=acc(p['indices']).reshape(-1,3) if 'indices' in p else np.arange(len(v)).reshape(-1,3);tris.extend(v[idx]);mats.extend([p.get('material',0)]*len(idx))
 for ch in n.get('children',[]):visit(ch,m)
for i in g['scenes'][g.get('scene',0)]['nodes']:visit(i,np.eye(4))
ts=np.array(tris);mats=np.array(mats);norm=np.cross(ts[:,1]-ts[:,0],ts[:,2]-ts[:,0]);area=np.linalg.norm(norm,axis=1)
solid=~np.isin(mats,[0,5,15,16,19])&(area>1e-5)&(ts[:,:,1].max(1)<150)
flat=(abs(norm[:,1])>area*.65)&solid
road=ts[np.isin(mats,[6,7,8,9,10,11,12,13])&flat]
origin=np.array([-600.,-450.]);step=.5;mask=np.zeros((1150,2500),bool)
for t in road:
 p=(t[:,[0,2]]-origin)/step;rr,cc=polygon(p[:,1],p[:,0],mask.shape);mask[rr,cc]=True
mask=binary_closing(mask,iterations=2);clear=distance_transform_edt(mask)*step;cost=np.where(mask,1+40/(clear+.1)**2,np.inf)
anchors=np.array([[-50,-5],[470,-2],[535,25],[560,25],[572,0],[573,-180],[567,-250],[550,-280],[520,-300],[475,-307],[450,-300],[425,-280],[402,-270],[415,-195],[385,-192],[275,-230],[150,-248],[0,-238],[-100,-220],[-175,-280],[-185,-300],[-184,-325],[-175,-375],[-185,-395],[-215,-401],[-238,-390],[-260,-335],[-270,-308],[-290,-300],[-310,-291],[-320,-270],[-335,-257],[-360,-256],[-380,-260],[-415,-251],[-435,-256],[-456,-280],[-465,-300],[-458,-330],[-451,-354],[-460,-367],[-473,-368],[-495,-349],[-521,-324],[-532,-308],[-533,-291],[-526,-274],[-515,-258],[-400,-135],[-355,-85],[-348,-62],[-341,-43],[-320,-20],[-290,6],[-260,18],[-220,20],[-190,22],[-155,32],[-135,32],[-115,24],[-95,9],[-70,-5],[-50,-5]])
valid=np.argwhere(mask);tree=cKDTree(valid);coords=[valid[tree.query(np.rint(((p-origin)/step)[::-1]).astype(int))[1]] for p in anchors]
points=[]
for p,q in zip(coords[:-1],coords[1:]):
 lo=np.maximum(np.minimum(p,q)-80,0);hi=np.minimum(np.maximum(p,q)+80,cost.shape)
 path,_=route_through_array(cost[lo[0]:hi[0],lo[1]:hi[1]],p-lo,q-lo,fully_connected=True);points.extend((np.array(path)+lo)[:-1])
points=np.array(points)[:,::-1]*step+origin
d=np.r_[0,np.cumsum(np.linalg.norm(np.diff(np.r_[points,points[:1]],axis=0),axis=1))];s=np.arange(0,d[-1],2);pp=np.r_[points,points[:1]];points=np.c_[np.interp(s,d,pp[:,0]),np.interp(s,d,pp[:,1])];points=gaussian_filter1d(points,2.5,axis=0,mode='wrap')
# Collect only walkable surfaces connected in 3D to the road: rooftops and
# overhead terrain cannot become a second invisible driving deck.
allfloor=ts[flat];v,ids=np.unique(np.round(allfloor.reshape(-1,3),3),axis=0,return_inverse=True);ids=ids.reshape(-1,3)
adj=collections.defaultdict(list)
for i,t in enumerate(ids):
 for n in t:adj[n].append(i)
_,near=cKDTree(v).query(road.reshape(-1,3));todo=list(set(f for n in near for f in adj[n]));seen=set()
while todo:
 f=todo.pop()
 if f in seen:continue
 seen.add(f)
 for n in ids[f]:todo.extend(j for j in adj[n] if j not in seen)
floor=allfloor[sorted(seen)]
def query_mesh(tris):
 grid=collections.defaultdict(list)
 for i,t in enumerate(tris):
  lo=np.floor(t[:,[0,2]].min(0)/32).astype(int);hi=np.floor(t[:,[0,2]].max(0)/32).astype(int)
  for x in range(lo[0],hi[0]+1):
   for z in range(lo[1],hi[1]+1):grid[x,z].append(i)
 def query(x,z):
  t=tris[grid[int(np.floor(x/32)),int(np.floor(z/32))]]
  if not len(t):return np.array([])
  a,b,c=t[:,0],t[:,1],t[:,2];d=(b[:,2]-c[:,2])*(a[:,0]-c[:,0])+(c[:,0]-b[:,0])*(a[:,2]-c[:,2]);d=np.where(abs(d)<1e-8,np.inf,d);u=((b[:,2]-c[:,2])*(x-c[:,0])+(c[:,0]-b[:,0])*(z-c[:,2]))/d;v=((c[:,2]-a[:,2])*(x-c[:,0])+(a[:,0]-c[:,0])*(z-c[:,2]))/d
  return (u*a[:,1]+v*b[:,1]+(1-u-v)*c[:,1])[(u>=-.00001)&(v>=-.00001)&(u+v<=1.00001)]
 return query
height=query_mesh(floor);roadheight=query_mesh(road);overhead=query_mesh(allfloor);rows=[];previous=40.;missing=[]
for i,p in enumerate(points):
 hs=roadheight(*p)
 if not len(hs):hs=height(*p)
 if not len(hs):missing.append((i,p.tolist()));continue
 h=hs[np.argmin(abs(hs-previous))];previous=h;t=points[(i+1)%len(points)]-points[i-1];n=np.array([-t[1],t[0]]);n/=np.linalg.norm(n);widths=[];sideheights=[]
 for sign in [-1,1]:
  last=h;width=.25
  for offset in np.arange(.25,80,.5):
   hs=height(*(p+n*offset*sign))
   if not len(hs):break
   hh=hs[np.argmin(abs(hs-last))]
   if abs(hh-last)>.4:break
   width=offset;last=hh
  widths.append(max(1,width-.15));hs=height(*(p+n*2*sign));sideheights.append(hs[np.argmin(abs(hs-h))] if len(hs) else h)
 bank=np.arctan2(sideheights[1]-sideheights[0],4);rows.append([*p,h,*widths,bank])
assert not missing,missing
rows=np.array(rows);dist=np.linalg.norm(np.roll(rows[:,:2],-1,axis=0)-rows[:,:2],axis=1)
assert abs(rows[0,2]-rows[-1,2])<.5
# Preserve the source's geometry, all textures and original texture resolutions.
replacement={}
for im in g.get('images',[]):
 view=g['bufferViews'][im['bufferView']];image=Image.open(io.BytesIO(binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]))
 if 'A' not in image.getbands() and 'transparency' not in image.info:
  out=io.BytesIO();image.convert('RGB').save(out,format='JPEG',quality=92,subsampling=0,optimize=True);replacement[im['bufferView']]=out.getvalue();im['mimeType']='image/jpeg'
packed=bytearray()
for i,view in enumerate(g['bufferViews']):
 while len(packed)%4:packed.append(0)
 data=replacement.get(i,binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]);view['byteOffset']=len(packed);view['byteLength']=len(data);packed.extend(data)
while len(packed)%4:packed.append(0)
g['buffers'][0]['byteLength']=len(packed);js=json.dumps(g,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
out=struct.pack('<4sII',b'glTF',2,12+8+len(js)+8+len(packed))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(packed),b'BIN\0')+packed
asset=ROOT/'assets/bonus/glen-canyon-dam.glb';asset.write_bytes(out)
vertices,indices=np.unique(np.round(floor[:,:,[0,2,1]].reshape(-1,3),4),axis=0,return_inverse=True)
# True upright visible geometry only: no road-width barriers or giant bounds.
walls=ts[solid&(abs(norm[:,1])<area*.65)];ceilings=allfloor
seen=set();wallout=[]
for t in np.round(walls[:,:,[0,2,1]],4):
 key=tuple(sorted(map(tuple,t)))
 if key not in seen:seen.add(key);wallout.extend(t.reshape(-1).tolist())
data={'sourceSHA256':hashlib.sha256(out).hexdigest(),'originalSHA256':hashlib.sha256(blob).hexdigest(),'length':float(dist.sum()),'sections':rows.round(5).tolist(),'vertices':vertices.reshape(-1).tolist(),'indices':indices.tolist(),'walls':wallout,'ceilings':np.round(ceilings[:,:,[0,2,1]],4).reshape(-1).tolist(),'features':[]}
(ROOT/'js/glen-data.js').write_text('// Generated from the supplied GT Racing 2 model by build-glen-canyon.py.\n(globalThis.DriftNFSData??={}).glen='+json.dumps(data,separators=(',',':'))+';\n')
print(json.dumps({'length':data['length'],'rows':len(rows),'floor':len(floor),'walls':len(wallout)//9,'minWidth':rows[:,3:5].min(axis=0).tolist(),'maxGrade':max(abs(np.roll(rows[:,2],-1)-rows[:,2])/dist),'assetBytes':len(out)}))
