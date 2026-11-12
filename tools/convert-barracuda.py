"""Convert the user-supplied 1970 Plymouth Barracuda without replacing its meshes.
blender -b --python tools/convert-barracuda.py -- SOURCE_DIR OUTPUT.glb
SOURCE_DIR contains source/hemi.fbx and textures/. No creator/license was supplied.
"""
import bpy,sys,json
from pathlib import Path
from mathutils import Vector,Matrix
source,out=map(Path,sys.argv[sys.argv.index('--')+1:]);source=source.resolve();out=out.resolve()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=str(source/'source/hemi.fbx'))
keep=[o for o in bpy.data.objects if o.type=='MESH']
def bounds(o):
 p=[o.matrix_world@Vector(c) for c in o.bound_box]
 return Vector([min(v[i] for v in p) for i in range(3)]),Vector([max(v[i] for v in p) for i in range(3)])
# FBX has front along Blender +Y; game +X is obtained before glTF Y-up conversion.
orientation=Matrix(((0,1,0,0),(-1,0,0,0),(0,0,1,0),(0,0,0,1)))
for o in keep:
 world=o.matrix_world.copy();o.parent=None;o.data=o.data.copy();o.data.transform(orientation@world);o.matrix_world=Matrix.Identity(4);o.animation_data_clear()
for o in list(bpy.data.objects):
 if o not in keep:bpy.data.objects.remove(o,do_unlink=True)
bpy.context.view_layer.update()
lo=Vector([min(bounds(o)[0][i] for o in keep) for i in range(3)]);hi=Vector([max(bounds(o)[1][i] for o in keep) for i in range(3)])
center=(lo+hi)/2;scale=4.74/(hi.x-lo.x)
normal=Matrix.Translation(Vector((-center.x*scale,-center.y*scale,.02-lo.z*scale)))@Matrix.Scale(scale,4)
for o in keep:o.data.transform(normal)
for m in bpy.data.materials:
 for node in m.node_tree.nodes:
  if node.type=='TEX_IMAGE' and node.image:
   p=source/'textures'/Path(node.image.filepath.replace('\\','/')).name
   if p.exists():node.image=bpy.data.images.load(str(p),check_existing=True);node.image.pack()
for m in bpy.data.materials:
 for n in list(m.node_tree.nodes):
  if n.type=='TEX_IMAGE' and n.image and not n.image.packed_file:m.node_tree.nodes.remove(n)
 shader=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 shader.inputs['Roughness'].default_value=.46 if m.name.startswith('exterior') else .7
 shader.inputs['Metallic'].default_value=.2 if m.name.startswith(('exterior','details')) else 0
 if m.name.startswith('glass'):m.name='Glass'
 if m.name.startswith(('glows_front','glows_back')):
  m.name='headlights' if m.name.startswith('glows_front') else 'taillights'
  tex=next(n for n in m.node_tree.nodes if n.type=='TEX_IMAGE');m.node_tree.links.new(tex.outputs['Color'],shader.inputs['Emission Color']);shader.inputs['Emission Strength'].default_value=.15
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
bpy.context.view_layer.objects.active=body_objects[0];bpy.ops.object.join();bpy.context.object.name='barracuda-body'
fit={'name':'1970 Plymouth Barracuda','length':4.74,'width':round((hi.y-lo.y)*scale,6),'height':round((hi.z-lo.z)*scale,6),'wheels':wheels,'headlights':[[2.19,.59,-.67],[2.19,.59,.67]]}
out.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_animations=False,export_cameras=False,export_lights=False,export_yup=True,export_apply=True)
out.with_suffix('.fit.json').write_text(json.dumps(fit,indent=2)+'\n');print('FIT',json.dumps(fit))
# Compact exact-island lookup for the workshop; keep all chrome/lights separate.
import numpy as np
mask=bpy.data.images.load(str(source/'textures/car_plymouthhemicuda_occ_mk1.png'),check_existing=True)
w,h=mask.size;pixels=np.array(mask.pixels[:]).reshape(h,w,4);rows=[]
for y in range(128):
 row=[];inside=False;sy=h-1-min(h-1,int((y+.5)*h/128))
 for x in range(129):
  white=x<128 and pixels[sy,min(w-1,int((x+.5)*w/128)),0]>.94
  if white!=inside:row.append(x);inside=white
 rows.append(row)
maskfile=Path(__file__).resolve().parents[1]/'js/barracuda-paint-mask.js'
maskfile.write_text('// Paint-only UV islands from the mask supplied with the Barracuda; grille, lamps and trim stay original.\nconst rows='+json.dumps(rows,separators=(',',':'))+';\nexport function barracudaPaintMask(u,v){const row=rows[Math.min(127,Math.max(0,Math.floor(v*128)))],x=Math.min(127,Math.max(0,Math.floor(u*128)));for(let i=0;i<row.length;i+=2)if(x>=row[i]&&x<row[i+1])return true;return false;}\n')
