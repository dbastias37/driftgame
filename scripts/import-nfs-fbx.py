import bpy,sys,json,math
from pathlib import Path
from mathutils import Vector
import numpy as np
source=Path(sys.argv[sys.argv.index('--')+1]);slug=source.name
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(next(source.glob('*.fbx'))))
atlas=next(source.glob('*.png'))
for im in bpy.data.images:
    if im.source=='FILE': im.filepath=str(atlas);im.reload()
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
print('OBJECTS',len(objects),[(o.name,len(o.data.vertices),len(o.data.polygons)) for o in objects[:16]])
quads=[];uvs=[];triangles=[];groups={}
for o in objects:
    mesh=o.data;uv=mesh.uv_layers.active
    points=np.array([tuple(o.matrix_world@v.co) for v in mesh.vertices])[:,[0,2,1]];points[:,2]*=-1
    for poly in mesh.polygons:
        verts=points[list(poly.vertices)];tex=np.array([tuple(uv.data[i].uv) for i in poly.loop_indices]);tex[:,1]=1-tex[:,1]
        bounds=tuple(np.round(np.r_[tex.min(0),tex.max(0)]*np.array([bpy.data.images[0].size[0],bpy.data.images[0].size[1]]*2),1))
        key=','.join(map(str,bounds));g=groups.setdefault(key,{'faces':0,'objects':set(),'sample':verts.mean(0).tolist()});g['faces']+=1;g['objects'].add(o.name)
        if len(verts)==4:quads.append(verts);uvs.append(tex)
        for i in range(1,len(verts)-1):triangles.append(verts[[0,i,i+1]])
np.savez_compressed(source/'mesh.npz',quads=np.array(quads),uv=np.array(uvs),triangles=np.array(triangles))
for g in groups.values():g['objects']=sorted(g['objects'])[:4]
(source/'uv-groups.json').write_text(json.dumps(groups,indent=2))
print('BOUNDS',np.min(triangles,axis=(0,1)),np.max(triangles,axis=(0,1)),'QUADS',len(quads),'TRIS',len(triangles))
bpy.ops.export_scene.gltf(filepath=str(source/(slug+'.glb')),export_format='GLB',export_yup=True,export_cameras=False,export_lights=False)
