"""Rebuild game GLBs from the two user-supplied Ford FBX archives.
Usage: blender -b --python tools/convert-fords.py -- INPUT_ROOT
INPUT_ROOT has shelby/source/gt55.fbx and mustang/source/GTF.fbx with textures.
The supplied archives contain no creator or redistribution-license metadata.
"""
import bpy, sys, json
from pathlib import Path
from mathutils import Vector, Matrix
import numpy as np
root = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
repo = Path(__file__).resolve().parents[1]
configs = [('shelby', 'gt55.fbx', 'shelby-gt500', '2013 Ford Shelby GT500', 4.78, 'fordshelbygt500'),
           ('mustang', 'GTF.fbx', 'mustang-gt-fastback', 'Ford Mustang GT Fastback', 4.784, 'fordmustanggtfastback')]
mask_rows = {}
def bounds(obj):
    points = [obj.matrix_world @ Vector(v) for v in obj.bound_box]
    return (Vector([min(v[i] for v in points) for i in range(3)]),
            Vector([max(v[i] for v in points) for i in range(3)]))
def join(objects, name):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    return obj
for skin, fbx, basename, name, length, tex_prefix in configs:
    source = root / skin
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(source / 'source' / fbx))
    meshes = [obj for obj in bpy.data.objects if obj.type == 'MESH']
    # Original +Y is the car's nose; after export its front becomes game +X.
    orientation = Matrix(((0,1,0,0),(-1,0,0,0),(0,0,1,0),(0,0,0,1)))
    for obj in meshes:
        world = obj.matrix_world.copy()
        obj.parent = None
        obj.data = obj.data.copy()
        obj.data.transform(orientation @ world)
        obj.matrix_world = Matrix.Identity(4)
        obj.animation_data_clear()
    for obj in list(bpy.data.objects):
        if obj not in meshes: bpy.data.objects.remove(obj, do_unlink=True)
    bpy.context.view_layer.update()
    low = Vector([min(bounds(obj)[0][i] for obj in meshes) for i in range(3)])
    high = Vector([max(bounds(obj)[1][i] for obj in meshes) for i in range(3)])
    center = (low + high) / 2
    scale = length / (high.x - low.x)
    normalize = Matrix.Translation(Vector((-center.x*scale, -center.y*scale, .02-low.z*scale))) @ Matrix.Scale(scale, 4)
    for obj in meshes: obj.data.transform(normalize)
    for material in bpy.data.materials:
        if not material.use_nodes: continue
        for node in list(material.node_tree.nodes):
            if node.type == 'TEX_IMAGE' and node.image:
                path = source / 'textures' / Path(node.image.filepath.replace('\\', '/')).name
                if path.exists():
                    node.image = bpy.data.images.load(str(path), check_existing=True)
                    node.image.pack()
                else:
                    # The archives omit the referenced license-plate atlas.
                    material.node_tree.nodes.remove(node)
        shader = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        shader.inputs['Roughness'].default_value = .46 if material.name.startswith('exterior') else .7
        shader.inputs['Metallic'].default_value = .2 if material.name.startswith(('exterior','details')) else 0
        if material.name.startswith('glass'): material.name = 'Glass'
        if material.name.startswith(('glows_front','glows_back')):
            material.name = 'headlights' if material.name.startswith('glows_front') else 'taillights'
            texture = next(n for n in material.node_tree.nodes if n.type == 'TEX_IMAGE')
            material.node_tree.links.new(texture.outputs['Color'], shader.inputs['Emission Color'])
            shader.inputs['Emission Strength'].default_value = .15
    bpy.context.view_layer.update()
    wheels, wheel_objects = [], []
    for tag, role in [('BL','rear-left'),('BR','rear-right'),('FL','front-left'),('FR','front-right')]:
        parts = [obj for obj in bpy.data.objects if obj.type == 'MESH' and obj.name.startswith('wheel'+tag+'_')]
        assert len(parts) == 2, (skin,tag,[obj.name for obj in parts])
        wheel = join(parts, 'wheel-'+role)
        wheel_objects.append(wheel)
        lo, hi = bounds(wheel)
        pivot = (lo + hi) / 2
        radius = (hi.z - lo.z) / 2
        shift = .02 - lo.z
        wheel.data.transform(Matrix.Translation(Vector((0,0,shift))))
        pivot.z += shift
        wheels.append(dict(node=wheel.name, x=round(pivot.x,6), y=round(pivot.z,6), z=round(-pivot.y,6), radius=round(radius,6)))
    body = join([obj for obj in bpy.data.objects if obj.type=='MESH' and obj not in wheel_objects], skin+'-body')
    bpy.context.view_layer.update()
    lamps = [v.co for poly in body.data.polygons if body.data.materials[poly.material_index].name=='headlights' for v in [body.data.vertices[i] for i in poly.vertices]]
    light_centers = []
    for side in [-1,1]:
        points = [v for v in lamps if v.y*side>0]
        lo = Vector([min(v[i] for v in points) for i in range(3)])
        hi = Vector([max(v[i] for v in points) for i in range(3)])
        c = (lo+hi)/2
        light_centers.append([round(c.x,4),round(c.z,4),round(-c.y,4)])
    fit = dict(name=name, length=length, width=round((high.y-low.y)*scale,6), height=round((high.z-low.z)*scale,6), wheels=wheels, headlights=light_centers)
    out = repo / 'assets/models' / (basename+'.glb')
    out.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_animations=False,export_cameras=False,export_lights=False,export_yup=True,export_apply=True)
    out.with_suffix('.fit.json').write_text(json.dumps(fit,indent=2)+'\n')
    assert out.stat().st_size < 25*1024*1024
    assert len([obj for obj in bpy.data.objects if obj.type=='MESH'])==5
    for wheel in wheel_objects:
        lo,hi=bounds(wheel)
        assert abs(lo.z-.02)<1e-5, (wheel.name,lo.z)
    print('FIT',skin,json.dumps(fit),'BYTES',out.stat().st_size)
    # Red/white islands from the authored paint mask preserve stripes, chrome and lamps.
    mask = bpy.data.images.load(str(source/'textures'/('car_'+tex_prefix+'_occ_mk1.png')),check_existing=True)
    w,h=mask.size
    pixels=np.array(mask.pixels[:]).reshape(h,w,4)
    rows=[]
    for y in range(128):
        row=[]; inside=False; sy=h-1-min(h-1,int((y+.5)*h/128))
        for x in range(129):
            white=x<128 and pixels[sy,min(w-1,int((x+.5)*w/128)),0]>.94
            if white!=inside: row.append(x); inside=white
        rows.append(row)
    mask_rows[skin]=rows
(repo/'js/ford-paint-masks.js').write_text('// Paint-only UV islands from the original supplied Ford texture masks.\nconst rowsBySkin='+json.dumps(mask_rows,separators=(',',':'))+';\nexport function fordPaintMask(skin,u,v){const rows=rowsBySkin[skin];if(!rows)return false;const row=rows[Math.min(127,Math.max(0,Math.floor(v*128)))],x=Math.min(127,Math.max(0,Math.floor(u*128)));for(let i=0;i<row.length;i+=2)if(x>=row[i]&&x<row[i+1])return true;return false;}\n')
