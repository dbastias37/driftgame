"""Build native road/floor data for NFS III Especial from the supplied meshes.

Usage: python scripts/build-nfs-special.py /path/to/nfs-source
Run import-nfs-fbx.py with Blender for rocky/ and redrock/ first. numpy/scipy.
The source models are not rescaled and no visual meshes are removed.
"""
import collections,hashlib,json,struct,sys
from pathlib import Path
import numpy as np
from scipy.spatial import cKDTree
ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path(sys.argv[1])

def weld(vertices):
    parent=np.arange(len(vertices))
    def root(i):
        while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
        return i
    for a,b in cKDTree(vertices).query_pairs(.025):parent[root(a)]=root(b)
    ids=np.array([root(i) for i in range(len(vertices))]);unique,ids=np.unique(ids,return_inverse=True)
    return vertices[unique],ids

def route(slug,size):
    a=np.load(SOURCE/slug/'mesh.npz');q=a['quads'];uv=a['uv']*size;lo,hi=uv.min(1),uv.max(1)
    road=((lo[:,1]>265)&(hi[:,1]<329)&(hi[:,0]<193)) if slug=='rocky' else (hi[:,0]<256)&(hi[:,1]<192)
    normals=np.cross(q[:,1]-q[:,0],q[:,2]-q[:,0]);walkable=np.abs(normals[:,1])>np.linalg.norm(normals,axis=1)*.5
    _,ids=weld(q.reshape(-1,3));ids=ids.reshape(-1,4);edges=collections.defaultdict(list)
    def key(a,b):return tuple(sorted([a,b]))
    for f in np.flatnonzero(walkable):
        for j in range(4):edges[key(ids[f,j],ids[f,(j+1)%4])].append((int(f),j))
    for seed in np.flatnonzero(road):
        inset=set(np.argsort(uv[seed,:,1])[:2]);inc=next(j for j in range(4) if {j,(j+1)%4}==inset)
        seams=[j for j in range(4) if j%2!=inc%2 and any(road[n] for n,_ in edges[key(ids[seed,j],ids[seed,(j+1)%4])] if n!=seed)]
        if len(seams)==1:break
    center=next(iter(inset&{seams[0],(seams[0]+1)%4}));f=seed;seen=set();rows=[]
    while f not in seen:
        seen.add(f);rows.append(q[f,center]);out=(inc+2)%4;nextCenter=(center-1)%4 if center==inc else (center+1)%4
        choices=[(n,j) for n,j in edges[key(ids[f,out],ids[f,(out+1)%4])] if n!=f]
        assert len(choices)==1,(slug,'Open or ambiguous road seam',f,choices)
        n,j=choices[0];vertex=ids[f,nextCenter];center=next(k for k in [j,(j+1)%4] if ids[n,k]==vertex);f,inc=n,j
    assert f==seed and len(rows)>1000,(slug,'Road must close')
    points=np.array(rows);start=np.array([462.58,-29.13,1021.87] if slug=='rocky' else [-788,-4,630])
    points=np.roll(points,-np.argmin(np.linalg.norm(points-start,axis=1)),axis=0)
    if slug=='rocky' and points[1,0]>points[0,0]:points=np.r_[points[:1],points[:0:-1]]
    return points,a['triangles']

def summit():
    source=json.loads((ROOT/'js/summit-data.js').read_text().split('=',1)[1].strip().rstrip(';'))
    points=np.array(source['sections'])[:,[0,2,1]]
    blob=(ROOT/'assets/bonus/summit.glb').read_bytes();size=struct.unpack_from('<I',blob,12)[0];g=json.loads(blob[20:20+size]);binary=blob[28+size:]
    def acc(i):
        a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];dt={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']];w={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
        return np.frombuffer(binary,dtype=dt,count=a['count']*w,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,w)
    triangles=[]
    def visit(i,m):
        n=g['nodes'][i];m=m@np.array(n.get('matrix',np.eye(4).flatten())).reshape(4,4).T
        if 'mesh' in n:
            for p in g['meshes'][n['mesh']]['primitives']:
                v=acc(p['attributes']['POSITION']);v=(np.c_[v,np.ones(len(v))]@m.T)[:,:3];triangles.extend(v[acc(p['indices']).reshape(-1,3)])
        for child in n.get('children',[]):visit(child,m)
    for i in g['scenes'][g.get('scene',0)]['nodes']:visit(i,np.eye(4))
    return points,np.array(triangles)

def build(slug,points,alltri,model):
    normals=np.cross(alltri[:,1]-alltri[:,0],alltri[:,2]-alltri[:,0]);areas=np.linalg.norm(normals,axis=1)
    flat=alltri[np.abs(normals[:,1])>areas*.65]
    vertices,ids=weld(flat.reshape(-1,3));ids=ids.reshape(-1,3)
    # Flood only surfaces connected to the actual road; roofs and canopy quads
    # never become an invisible driving deck. Low curbs are included by contact.
    adjacency=collections.defaultdict(list)
    for i,t in enumerate(ids):
        for v in t:adjacency[int(v)].append(i)
    _,nearest=cKDTree(vertices).query(points)
    selected=set();todo=list({f for v in nearest for f in adjacency[int(v)]})
    while todo:
        f=todo.pop()
        if f in selected:continue
        selected.add(f)
        for v in ids[f]:todo.extend(n for n in adjacency[int(v)] if n not in selected)
    floor=flat[sorted(selected)]
    # Keep overhead candidates separately for shelter and camera clearance.
    def query_mesh(tris):
        grid=collections.defaultdict(list)
        for i,t in enumerate(tris):
            lo,hi=np.floor(t[:,[0,2]].min(0)/32).astype(int),np.floor(t[:,[0,2]].max(0)/32).astype(int)
            for x in range(lo[0],hi[0]+1):
                for z in range(lo[1],hi[1]+1):grid[x,z].append(i)
        def query(x,z):
            ts=tris[grid[int(np.floor(x/32)),int(np.floor(z/32))]]
            if not len(ts):return np.array([])
            a,b,c=ts[:,0],ts[:,1],ts[:,2];den=(b[:,2]-c[:,2])*(a[:,0]-c[:,0])+(c[:,0]-b[:,0])*(a[:,2]-c[:,2]);den=np.where(np.abs(den)<1e-9,np.inf,den)
            u=((b[:,2]-c[:,2])*(x-c[:,0])+(c[:,0]-b[:,0])*(z-c[:,2]))/den;v=((c[:,2]-a[:,2])*(x-c[:,0])+(a[:,0]-c[:,0])*(z-c[:,2]))/den
            mask=(u>=-.0001)&(v>=-.0001)&(u+v<=1.0001)
            return (u*a[:,1]+v*b[:,1]+(1-u-v)*c[:,1])[mask]
        return query
    height=query_mesh(floor);overhead=query_mesh(flat);rows=[];covered=[]
    for i,p in enumerate(points):
        tangent=points[(i+1)%len(points)]-points[i-1];n=np.array([-tangent[2],0,tangent[0]]);n/=np.linalg.norm(n)
        widths=[];ends=[]
        for sign in [-1,1]:
            previous=p[1];width=.25
            for offset in np.arange(.25,128,.5):
                h=height(p[0]+n[0]*offset*sign,p[2]+n[2]*offset*sign)
                if not len(h):break
                current=h[np.argmin(np.abs(h-previous))]
                if abs(current-previous)>.65:break
                width=offset;previous=current
            widths.append(max(1,width-.15));ends.append(previous)
        bank=np.arctan2(ends[1]-ends[0],sum(widths))
        # Bank for gravity follows the local carriageway, not far-away terrain.
        near=[]
        for sign in [-1,1]:
            hs=height(p[0]+n[0]*2*sign,p[2]+n[2]*2*sign);near.append(hs[np.argmin(abs(hs-p[1]))] if len(hs) else p[1])
        bank=np.arctan2(near[1]-near[0],4)
        rows.append([p[0],p[2],p[1],*widths,bank])
        roof=overhead(p[0],p[2])-p[1];roof=roof[(roof>3)&(roof<35)];covered.append(float(roof.min()) if len(roof) else 0)
    dist=np.linalg.norm(np.roll(points,-1,axis=0)[:,[0,2]]-points[:,[0,2]],axis=1);stations=np.r_[0,np.cumsum(dist)];features=[];run=None
    for i,value in enumerate(covered+[0]):
        if value and run is None:run=i
        if not value and run is not None:
            if stations[i]-stations[run]>45:features.append({'kind':'tunnel','start':round(stations[run],3),'end':round(stations[i],3),'clearance':round(min(covered[run:i]),3)})
            run=None
    v,indices=weld(floor.reshape(-1,3));v=v[:,[0,2,1]]
    data={'sourceSHA256':hashlib.sha256((ROOT/'assets/bonus'/model).read_bytes()).hexdigest(),'length':round(float(stations[-1]),4),'sections':np.round(rows,5).tolist(),'vertices':np.round(v,5).reshape(-1).tolist(),'indices':indices.tolist(),'features':features}
    output=ROOT/'js'/('nfs-'+slug+'-data.js');output.write_text('// Generated by scripts/build-nfs-special.py; supplied NFS III model.\n(globalThis.DriftNFSData??={})['+json.dumps(slug)+']='+json.dumps(data,separators=(',',':'))+';\n')
    print(json.dumps({'map':slug,'rows':len(rows),'length':data['length'],'floor':len(floor),'widthMin':np.min(rows,axis=0)[3:5].tolist(),'widthMax':np.max(rows,axis=0)[3:5].tolist(),'features':features,'bytes':output.stat().st_size}),flush=True)

for slug,size,model in [('rocky',690,'rocky-pass.glb'),('redrock',744,'redrock-ridge.glb')]:build(slug,*route(slug,size),model)
build('summit',*summit(),'summit.glb')
