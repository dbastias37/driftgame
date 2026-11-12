"""Preserve the supplied BMW's intact LOD_A geometry, original normals and UVs.
Usage: blender -b --python tools/convert-bmw.py -- EXTRACTED_SOURCE_DIR OUTPUT.glb
The supplied Monkey Tool ASCII FBX cannot be read by Blender's binary importer.
This small importer reads its documented direct-per-vertex arrays without remeshing.
Source creator/license were not supplied; exporter identification is not attribution.
"""
import bpy,sys,json,re,os
from pathlib import Path
from mathutils import Vector,Matrix
source,out=map(Path,sys.argv[sys.argv.index('--')+1:]);source=source.resolve();out=out.resolve()
s=(source/'2001_bmw_m3_gtr_street_a.fbx').read_text()
def blocks(kind):
 for m in re.finditer(r'^\s*'+kind+r': (\d+), "'+kind+r'::([^"]*)", "[^"]*" \{',s,re.M):
  start=m.end();depth=1;end=start
  while depth:
   depth+=(s[end]=='{')-(s[end]=='}');end+=1
  yield int(m[1]),m[2],s[start:end-1]
def values(body,name,cast=float):
 m=re.search(r'\b'+name+r': \*\d+\s*\{\s*a:\s*([^}]+)',body)
 return [cast(n) for n in m[1].replace('\n','').replace(' ','').strip(',').split(',')]
textures={i:n for i,n,b in blocks('Texture')}
links={int(mat):int(tex) for tex,mat in re.findall(r'C: "OP",(\d+),(\d+), "DiffuseColor"',s)}
texture_for={n.rsplit('mm_',1)[-1]:textures[links[i]] for i,n,b in blocks('Material')}
bpy.ops.wm.read_factory_settings(use_empty=True)
materials={}
def material(key,role=None):
 name=role or ('bmw-paint' if key=='ext' else 'Glass' if key=='windows' else 'bmw-'+key)
 if name in materials:return materials[name]
 m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(.36,.39,.42,1)
 shader=m.node_tree.nodes.get('Principled BSDF')
 shader.inputs['Roughness'].default_value=.38 if key in ('ext','wheel') else .65
 shader.inputs['Metallic'].default_value=.25 if key in ('ext','wheel','rotor') else 0
 tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(source/texture_for[key]),check_existing=True);tex.image.pack()
 m.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color'])
 if name=='Glass':
  # The game also replaces this exact material with its garage/day/night glass.
  shader.inputs['Base Color'].default_value=(.09,.15,.19,1)
  m.node_tree.links.remove(shader.inputs['Base Color'].links[0])
  shader.inputs['Alpha'].default_value=.28;shader.inputs['Roughness'].default_value=.12
  m.surface_render_method='DITHERED'
 if role:
  m.node_tree.links.new(tex.outputs['Color'],shader.inputs['Emission Color']);shader.inputs['Emission Strength'].default_value=.12
 materials[name]=m;return m
objects=[];excluded=[];original_vertices=original_faces=0
for i,name,body in blocks('Geometry'):
 if 'DAMAGE' in name or 'BROKEN' in name:excluded.append(name);continue
 assert 'MappingInformationType: "ByVertice"' in body,name
 points=values(body,'Vertices');vertices=[(-points[j+2],-points[j],points[j+1]) for j in range(0,len(points),3)]
 indices=values(body,'PolygonVertexIndex',int);faces=[];face=[]
 for idx in indices:
  face.append(idx if idx>=0 else -idx-1)
  if idx<0:faces.append(face);face=[]
 assert not face,name
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
 uv=values(body,'UV');layer=mesh.uv_layers.new(name='UVMap')
 for loop in mesh.loops:layer.data[loop.index].uv=(uv[2*loop.vertex_index],uv[2*loop.vertex_index+1])
 normals=values(body,'Normals')
 for p in mesh.polygons:p.use_smooth=True
 mesh.normals_split_custom_set_from_vertices([(-normals[j+2],-normals[j],normals[j+1]) for j in range(0,len(normals),3)])
 key=name.rsplit('mm_',1)[-1];role=None
 if key=='lights' and ('TAIL' in name or 'BRAKES' in name):role='taillights'
 if key=='lights' and 'HEADLIGHT' in name:role='headlights'
 mesh.materials.append(material(key,role))
 if key=='lights' and name=='LOD_A_BODY_mm_lights':
  mesh.materials.append(material(key,'headlights'));mesh.materials.append(material(key,'taillights'))
  for polygon in mesh.polygons:
   c=sum((mesh.vertices[v].co for v in polygon.vertices),Vector())/len(polygon.vertices)
   if c.x>1.7:polygon.material_index=1
   elif c.x<-1.7:polygon.material_index=2
 if key=='lights' and name=='LOD_A_BOOT_mm_lights':mesh.materials[0]=material(key,'taillights')
 obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);objects.append(obj)
 original_vertices+=len(vertices);original_faces+=len(faces)
def bounds(obj):
 coords=[obj.matrix_world@Vector(c) for c in obj.bound_box]
 return Vector([min(v[i] for v in coords) for i in range(3)]),Vector([max(v[i] for v in coords) for i in range(3)])
bpy.context.view_layer.update()
lo=Vector([min(bounds(o)[0][i] for o in objects) for i in range(3)]);hi=Vector([max(bounds(o)[1][i] for o in objects) for i in range(3)])
scale=4.49/(hi.x-lo.x);center=(hi+lo)*.5
normal=Matrix.Translation(Vector((-center.x*scale,-center.y*scale,.02-lo.z*scale)))@Matrix.Scale(scale,4)
for o in objects:o.data.transform(normal)
bpy.context.view_layer.update()
def join(parts,name):
 bpy.ops.object.select_all(action='DESELECT')
 for o in parts:o.select_set(True)
 bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();o=bpy.context.object;o.name=name;return o
wheels=[];wheel_objects=[]
for tag,role in [('FL','front-left'),('FR','front-right'),('BL','rear-left'),('BR','rear-right')]:
 # Original brake calipers stay on the chassis; only rim, rotor, tire spin.
 parts=[o for o in bpy.data.objects if o.type=='MESH' and o.name.startswith('WHEEL_'+tag+'_') and 'CALIPER' not in o.name]
 assert len(parts)==3,(tag,[o.name for o in parts])
 o=join(parts,'wheel-'+role);wheel_objects.append(o);low,high=bounds(o);c=(low+high)*.5
 dz=.02-low.z;o.data.transform(Matrix.Translation(Vector((0,0,dz))));c.z+=dz
 wheels.append({'node':o.name,'x':round(c.x,6),'y':round(c.z,6),'z':round(-c.y,6),'radius':round((high.z-low.z)/2,6)})
join([o for o in bpy.data.objects if o.type=='MESH' and o not in wheel_objects],'bmw-body')
fit={'name':'2001 BMW M3 GTR E46 Strassenversion','length':4.49,'width':round((hi.y-lo.y)*scale,6),'height':round((hi.z-lo.z)*scale,6),'wheels':wheels,'headlights':[[1.92,.61,-.58],[1.92,.61,.58]]}
out.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_animations=False,export_cameras=False,export_lights=False,export_yup=True,export_apply=True)
out.with_suffix('.fit.json').write_text(json.dumps(fit,indent=2)+'\n')
print('FIT',json.dumps(fit));print('SOURCE PRESERVED',original_vertices,'vertices',original_faces,'polygons; skipped',len(excluded),'overlapping damage/broken variants')
# Optional front-three-quarter visual inspection: set BMW_PREVIEW_PATH.
if os.environ.get("BMW_PREVIEW_PATH"):
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=False
 scene.render.resolution_x=720;scene.render.resolution_y=440;scene.render.resolution_percentage=100
 scene.world=bpy.data.worlds.new('studio');scene.world.use_nodes=True
 scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.15,.19,.25,1)
 scene.world.node_tree.nodes['Background'].inputs[1].default_value=.8
 for loc,power,size in [((2,-4,6),1600,5),((-3,2,4),1200,4),((2,4,2),900,3)]:
  bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(Vector((0,0,.5))-light.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,0));floor=bpy.context.object
 mat=bpy.data.materials.new('studio-floor');mat.diffuse_color=(.025,.034,.05,1);floor.data.materials.append(mat)
 bpy.ops.object.camera_add(location=(6,-7,3.4));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,.6))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=6.0;scene.camera=camera
 scene.render.filepath=os.environ['BMW_PREVIEW_PATH']
 bpy.ops.render.render(write_still=True)
