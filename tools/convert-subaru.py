"""Convert the supplied Subaru S206 FBX; preserves original geometry and textures.
blender -b --python tools/convert-subaru.py -- SOURCE_DIR OUTPUT.glb
SOURCE_DIR contains source/wrx.fbx and textures/. Original author unspecified.
"""
import bpy,sys,json,struct
from pathlib import Path
from mathutils import Vector,Matrix
import numpy as np
source,out=map(Path,sys.argv[sys.argv.index('--')+1:]);source=source.resolve();out=out.resolve()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(source/'source/wrx.fbx'))
keep=[o for o in bpy.data.objects if o.type=='MESH']
def bounds(o):
 p=[o.matrix_world@Vector(c) for c in o.bound_box]
 return Vector([min(v[i] for v in p) for i in range(3)]),Vector([max(v[i] for v in p) for i in range(3)])
orientation=Matrix(((0,-1,0,0),(1,0,0,0),(0,0,1,0),(0,0,0,1)))
for o in keep:
 world=o.matrix_world.copy();o.parent=None;o.data=o.data.copy();o.data.transform(orientation@world);o.matrix_world=Matrix.Identity(4);o.animation_data_clear()
for o in list(bpy.data.objects):
 if o not in keep:bpy.data.objects.remove(o,do_unlink=True)
bpy.context.view_layer.update()
# The source's flare cards extend beyond the physical body. They must not shrink
# the vehicle or change its collision dimensions during normalization.
physical=[o for o in keep if not o.name.startswith('lights_')]
lo=Vector([min(bounds(o)[0][i] for o in physical) for i in range(3)]);hi=Vector([max(bounds(o)[1][i] for o in physical) for i in range(3)])
center=(lo+hi)/2;scale=4.58/(hi.x-lo.x)
normal=Matrix.Translation(Vector((-center.x*scale,-center.y*scale,.02-lo.z*scale)))@Matrix.Scale(scale,4)
for o in keep:o.data.transform(normal)
for m in bpy.data.materials:
 for node in m.node_tree.nodes:
  if node.type=='TEX_IMAGE' and node.image:
   p=source/'textures'/Path(node.image.filepath.replace('\\','/')).name
   if p.exists():node.image=bpy.data.images.load(str(p),check_existing=True);node.image.pack()
 for n in list(m.node_tree.nodes):
  if n.type=='TEX_IMAGE' and n.image and not n.image.packed_file:m.node_tree.nodes.remove(n)
 shader=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 shader.inputs['Roughness'].default_value=.46
 shader.inputs['Metallic'].default_value=.15
 for link in list(shader.inputs['Alpha'].links):m.node_tree.links.remove(link)
 shader.inputs['Alpha'].default_value=1
# Stable semantic material names keep paint away from carbon, windows and trim.
for old,new in [('Material.001','subaru-carpaint'),('Material.002','subaru-carbon'),('Material.003','subaru-details'),('Material.004','subaru-license'),('Material.005','subaru-tyres'),('Material.006','subaru-bottom')]:
 bpy.data.materials[old].name=new
glass=bpy.data.materials.new('Glass');glass.use_nodes=True
bs=glass.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(.23,.32,.38,1);bs.inputs['Alpha'].default_value=.55;bs.inputs['Roughness'].default_value=.14
for o in keep:
 if o.name.startswith('glasses_'):o.data.materials.clear();o.data.materials.append(glass)
# Black in the original glow atlas is empty/additive space, not opaque bodywork.
glow=bpy.data.images.load(str(source/'textures/car_subaru_imprezawrxsti_glow_Out.png'),check_existing=False)
w,h=glow.size;pixels=np.array(glow.pixels[:]).reshape(h,w,4);pixels[:,:,3]=np.max(pixels[:,:,:3],axis=2)
glow=bpy.data.images.new('subaru-glow-alpha',width=w,height=h,alpha=True);glow.pixels[:]=pixels.reshape(-1).tolist();glow.file_format='PNG';glow.pack()
lamps=[]
for name in ['headlights','taillights']:
 m=bpy.data.materials.new(name);m.use_nodes=True;nodes=m.node_tree.nodes;bs=nodes.get('Principled BSDF');tex=nodes.new('ShaderNodeTexImage');tex.image=glow
 m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color']);m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Emission Color']);m.node_tree.links.new(tex.outputs['Alpha'],bs.inputs['Alpha']);bs.inputs['Emission Strength'].default_value=.15;lamps.append(m)
for o in keep:
 if not o.name.startswith('lights_'):continue
 o.data.materials.clear()
 for m in lamps:o.data.materials.append(m)
 for p in o.data.polygons:p.material_index=0 if p.center.x>0 else 1
bpy.context.view_layer.update()
wheels=[];wheel_objects=[]
for tag,role in [('BL','rear-left'),('BR','rear-right'),('FL','front-left'),('FR','front-right')]:
 parts=[o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith('wheel'+tag+'_')]
 assert len(parts)==2,(tag,[o.name for o in parts])
 bpy.ops.object.select_all(action='DESELECT')
 for o in parts:o.select_set(True)
 bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();o=bpy.context.object;o.name='wheel-'+role;wheel_objects.append(o)
 low,high=bounds(o);c=(low+high)/2;radius=(high.z-low.z)/2;dz=.02-low.z;o.data.transform(Matrix.Translation(Vector((0,0,dz))));c.z+=dz
 wheels.append({'node':o.name,'x':round(c.x,6),'y':round(c.z,6),'z':round(-c.y,6),'radius':round(radius,6)})
body_objects=[o for o in bpy.data.objects if o.type=='MESH' and o not in wheel_objects]
bpy.ops.object.select_all(action='DESELECT')
for o in body_objects:o.select_set(True)
bpy.context.view_layer.objects.active=body_objects[0];bpy.ops.object.join();bpy.context.object.name='subaru-body'
fit={'name':'Subaru Impreza WRX STI S206 NBR','length':4.58,'width':round((hi.y-lo.y)*scale,6),'height':round((hi.z-lo.z)*scale,6),'wheels':wheels,'headlights':[[2.10,.66,-.67],[2.10,.66,.67]]}
assert all((p['x']>0)==('front' in p['node']) for p in wheels),wheels
out.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_animations=False,export_cameras=False,export_lights=False,export_yup=True,export_apply=True)
# Keep flare alpha fractional for the software renderer as well as WebGL.
blob=out.read_bytes();json_size=struct.unpack_from('<I',blob,12)[0];document=json.loads(blob[20:20+json_size]);binary=blob[20+json_size:]
for material in document['materials']:
 if material.get('name') in ('headlights','taillights'):
  material['pbrMetallicRoughness']['baseColorFactor']=[1,1,1,.75]
encoded=json.dumps(document,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
out.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(encoded)+len(binary))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+binary)
out.with_suffix('.fit.json').write_text(json.dumps(fit,indent=2)+'\n');print('FIT',json.dumps(fit))
# Exact supplied paint-island mask; carbon and all other materials stay original.
mask=bpy.data.images.load(str(source/'textures/car_subaru_imprezawrxsti_occ_mk_Out_mask.png'),check_existing=True)
w,h=mask.size;pixels=np.array(mask.pixels[:]).reshape(h,w,4);rows=[]
for y in range(128):
 row=[];inside=False;sy=h-1-min(h-1,int((y+.5)*h/128))
 for x in range(129):
  white=x<128 and pixels[sy,min(w-1,int((x+.5)*w/128)),0]>.94
  if white!=inside:row.append(x);inside=white
 rows.append(row)
maskfile=Path(__file__).resolve().parents[1]/'js/subaru-paint-mask.js'
maskfile.write_text('// Body paint islands from the original Subaru UV mask.\nconst rows='+json.dumps(rows,separators=(',',':'))+';\nexport function subaruPaintMask(u,v){const row=rows[Math.min(127,Math.max(0,Math.floor(v*128)))],x=Math.min(127,Math.max(0,Math.floor(u*128)));for(let i=0;i<row.length;i+=2)if(x>=row[i]&&x<row[i+1])return true;return false;}\n')
