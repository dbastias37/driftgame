import json,struct,collections,io
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
def load(name):
 b=(ROOT/'assets/bonus'/f'{name}.glb').read_bytes();size=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+size]);binary=b[28+size:]
 def acc(i):
  a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];dt={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']];w={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
  return np.ndarray((a['count'],w),dtype=dt,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',np.dtype(dt).itemsize*w),np.dtype(dt).itemsize)).copy()
 view=g['bufferViews'][g['images'][0]['bufferView']];im=Image.open(io.BytesIO(binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']])).convert('RGBA')
 tris=[];uvs=[]
 def visit(i,m):
  n=g['nodes'][i]
  if 'matrix' in n:l=np.array(n['matrix']).reshape(4,4).T
  else:
   from scipy.spatial.transform import Rotation
   l=np.eye(4);l[:3,:3]=Rotation.from_quat(n.get('rotation',[0,0,0,1])).as_matrix()@np.diag(n.get('scale',[1,1,1]));l[:3,3]=n.get('translation',[0,0,0])
  m=m@l
  if 'mesh' in n:
   for p in g['meshes'][n['mesh']]['primitives']:
    v=acc(p['attributes']['POSITION']);v=(np.c_[v,np.ones(len(v))]@m.T)[:,:3];idx=acc(p['indices']).reshape(-1,3);tris.extend(v[idx]);uvs.extend(acc(p['attributes']['TEXCOORD_0'])[idx])
  for ch in n.get('children',[]):visit(ch,m)
 for i in g['scenes'][g.get('scene',0)]['nodes']:visit(i,np.eye(4))
 return np.array(tris),np.array(uvs),im
