"""Blender: convert supplied Nova SS / Skyline sources, without rebuilding their meshes.
Usage: blender -b --python tools/convert-replacement-cars.py -- nova|r34 SOURCE.blend TEXTURE_DIR OUTPUT.glb
The sibling .fit.json records game-axis pivots/lamps for the shared contact rig.
"""
import bpy,sys,json,math
from pathlib import Path
from mathutils import Vector,Matrix
kind,source,textures,out=sys.argv[sys.argv.index('--')+1:]
bpy.ops.wm.open_mainfile(filepath=str(Path(source).resolve()))
texture_dir=Path(textures).resolve()
def bounds(o):
 p=[o.matrix_world@Vector(c) for c in o.bound_box]
 return Vector([min(v[i] for v in p) for i in range(3)]),Vector([max(v[i] for v in p) for i in range(3)])
if kind=='nova':
 keep=[o for o in bpy.data.objects if o.type=='MESH' and o.name not in ['Plane','Plane.001','Plane.002']]
 orientation=Matrix(((0,-1,0,0),(1,0,0,0),(0,0,1,0),(0,0,0,1)))
 target_length=4.81
else:
 # The source also contains damaged cars, a widebody and untextured backups.
 keep=[o for o in bpy.data.collections['Skyline Stock Done'].all_objects if o.type=='MESH']
 orientation=Matrix(((-1,0,0,0),(0,-1,0,0),(0,0,1,0),(0,0,0,1)))
 target_length=4.6
for o in list(bpy.data.objects):
 if o not in keep:bpy.data.objects.remove(o,do_unlink=True)
for image in bpy.data.images:
 if image.source=='FILE' and not image.packed_file:
  p=texture_dir/Path(image.filepath.replace('\\','/')).name
  if p.exists():image.filepath=str(p);image.reload();image.pack()
for o in keep:
 o.hide_viewport=False;o.hide_render=False;o.hide_set(False)
 o.animation_data_clear()
 for modifier in list(o.modifiers):o.modifiers.remove(modifier)
 o.data=o.data.copy();o.data.transform(orientation@o.matrix_world);o.matrix_world=Matrix.Identity(4)
 for poly in o.data.polygons:poly.use_smooth=False
bpy.context.view_layer.update()
lo=Vector([min(bounds(o)[0][i] for o in keep) for i in range(3)])
hi=Vector([max(bounds(o)[1][i] for o in keep) for i in range(3)])
center=(lo+hi)/2;scale=target_length/(hi.x-lo.x)
normal=Matrix.Translation(Vector((-center.x*scale,-center.y*scale,.02-lo.z*scale)))@Matrix.Scale(scale,4)
for o in keep:o.data.transform(normal)
bpy.context.view_layer.update()
wheel_objects=[o for o in keep if o.name.startswith('Wheel' if kind=='nova' else 'Roda')]
assert len(wheel_objects)==4
# Precisely level each original tire. A slight source asymmetry must not float one side.
wheel_centers=[]
for o in sorted(wheel_objects,key=lambda o:bounds(o)[0].x):
 low,high=bounds(o);c=(low+high)/2;radius=(high.z-low.z)/2
 dz=.02-low.z;o.data.transform(Matrix.Translation(Vector((0,0,dz))));c.z+=dz
 o.name=('wheel-front-' if c.x>0 else 'wheel-rear-')+('left' if c.y>0 else 'right')
 # glTF export maps Blender (x,y,z) to game (x,z,-y).
 wheel_centers.append({'node':o.name,'x':round(c.x,6),'y':round(c.z,6),'z':round(-c.y,6),'radius':round(radius,6)})
# Light roles retain the original texture/geometry, and can be driven independently.
if kind=='r34':
 for name,role,color in [('Front Light','headlights',(1,.94,.8,1)),('Back Light','taillights',(.8,.018,.005,1))]:
  m=bpy.data.materials[name];m.name=role;n=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');n.inputs['Emission Color'].default_value=color;n.inputs['Emission Strength'].default_value=.15
 glass=bpy.data.materials.get('Glass')
 if glass:
  n=next(n for n in glass.node_tree.nodes if n.type=='BSDF_PRINCIPLED');n.inputs['Metallic'].default_value=.35;n.inputs['Roughness'].default_value=.2
else:
 # The lamp lenses are part of the original atlas. A UV emission mask lights only
 # those lenses; the SS badge, grille and body never glow with the brake input.
 import numpy as np
 original=bpy.data.materials['Material_Nova'];img=bpy.data.images['Color.jpg'];w,h=img.size
 pixels=np.array(img.pixels[:],dtype=np.float32).reshape(h,w,4)
 for role,rects in [('headlights',[(95,664,190,768),(812,664,907,768)]),('taillights',[(52,892,218,952),(789,892,956,952)])]:
  mask=np.zeros_like(pixels);mask[:,:,3]=1
  for x0,y0,x1,y1 in rects:
   x0,x1=int(x0*w/1024),int(x1*w/1024);y0,y1=int(y0*h/1024),int(y1*h/1024)
   mask[h-y1:h-y0,x0:x1,:3]=pixels[h-y1:h-y0,x0:x1,:3]
  em=bpy.data.images.new('nova-'+role,width=w,height=h);em.pixels=mask.ravel();em.pack()
  material=original.copy();material.name=role
  n=next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED');tex=material.node_tree.nodes.new('ShaderNodeTexImage');tex.image=em;material.node_tree.links.new(tex.outputs['Color'],n.inputs['Emission Color']);n.inputs['Emission Strength'].default_value=.15
  for o in keep:
   if o in wheel_objects:continue
   idx=len(o.data.materials);o.data.materials.append(material)
   for poly in o.data.polygons:
    us=[o.data.uv_layers.active.data[j].uv for j in poly.loop_indices]
    # Atlas rows: front grille 636..822; rear grille 868..995.
    if role=='headlights' and all(.195<u.y<.39 for u in us):poly.material_index=idx
    if role=='taillights' and all(.025<u.y<.16 for u in us):poly.material_index=idx
# Batch by material but preserve one node per axle wheel, and retain all visible pieces.
body_objects=[o for o in keep if o not in wheel_objects]
bpy.ops.object.select_all(action='DESELECT')
for o in body_objects:o.select_set(True)
bpy.context.view_layer.objects.active=body_objects[0];bpy.ops.object.join();body=bpy.context.object;body.name='nova-ss-body' if kind=='nova' else 'skyline-r34-body'
# World-space positions, ready for Three.js: +X forward, +Y up, +Z lateral.
if kind=='nova':
 # Positions correspond to the lenses printed on the supplied grille texture.
 headlights=[[2.382,.62,-.65],[2.382,.62,.65]]
else:
 headlights=[[2.19,.696,-.64],[2.19,.696,.64]]
fit={'name':'Chevrolet Nova SS' if kind=='nova' else 'Nissan Skyline R34','length':target_length,'width':round((hi.y-lo.y)*scale,6),'height':round((hi.z-lo.z)*scale,6),'wheels':wheel_centers,'headlights':headlights}
out=Path(out).resolve();out.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_animations=False,export_extras=False,export_cameras=False,export_lights=False,export_yup=True,export_apply=True)
out.with_suffix('.fit.json').write_text(json.dumps(fit,indent=2)+'\n')
print('FIT',json.dumps(fit))
# Reproducible visual inspection; not included in the runtime asset.
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE_NEXT';scene.render.resolution_x=1000;scene.render.resolution_y=700;scene.render.resolution_percentage=100;scene.eevee.taa_render_samples=32
scene.world=bpy.data.worlds.new('Review world');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.25,.28,.32,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
for pos,energy,size in [((2,4,7),1700,5),((-4,-3,5),1400,5),((4,-2,3),900,3)]:
 d=bpy.data.lights.new('Review softbox','AREA');d.energy=energy;d.shape='DISK';d.size=size;o=bpy.data.objects.new(d.name,d);scene.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,.6))-o.location).to_track_quat('-Z','Y').to_euler()
c=bpy.data.cameras.new('Review camera');cam=bpy.data.objects.new(c.name,c);scene.collection.objects.link(cam);cam.location=(7,-6,4);cam.rotation_euler=(Vector((0,0,.7))-cam.location).to_track_quat('-Z','Y').to_euler();c.type='ORTHO';c.ortho_scale=6.4;scene.camera=cam
scene.render.film_transparent=False;scene.render.filepath=str(out.with_suffix('.review.png'));bpy.ops.render.render(write_still=True)
