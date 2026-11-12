"""Blender: import-tree-pine.py SOURCE.blend OUTPUT.js.

Retain the supplied pine's authored foliage cards and UVs, ground the trunk,
and derive a lower-detail copy for distant cells. No procedural cone substitute.
"""
import bpy, json, sys
from pathlib import Path
from mathutils import Vector

source, output = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.open_mainfile(filepath=source)
original = bpy.data.objects['Cylinder.001']
matrix = original.matrix_world.copy()
vertices = [matrix @ v.co for v in original.data.vertices]
base = min(v.z for v in vertices)
origin = Vector((original.location.x, original.location.y, base))

def pack(obj):
    mesh = obj.data
    mesh.calc_loop_triangles()
    parts = []
    for slot, label in enumerate(['pine-bark', 'pine-leaves']):
        part = {'material':label, 'position':[], 'normal':[], 'uv':[], 'index':[]}
        shared = {}
        for tri in mesh.loop_triangles:
            if tri.material_index != slot: continue
            for loop_index in tri.loops:
                loop = mesh.loops[loop_index]
                v = matrix @ mesh.vertices[loop.vertex_index].co - origin
                n = (matrix.to_3x3().inverted().transposed() @ mesh.vertices[loop.vertex_index].normal).normalized()
                uv = mesh.uv_layers.active.data[loop_index].uv
                values = tuple(round(float(x), 6) for x in [v.x,v.z,-v.y,n.x,n.z,-n.y,uv.x,uv.y])
                if values not in shared:
                    shared[values] = len(shared)
                    part['position'].extend(values[:3]);part['normal'].extend(values[3:6]);part['uv'].extend(values[6:])
                part['index'].append(shared[values])
        parts.append(part)
    return parts

near = pack(original)
duplicate = original.copy();duplicate.data = original.data.copy();bpy.context.collection.objects.link(duplicate)
bpy.context.view_layer.objects.active = duplicate
modifier = duplicate.modifiers.new('Distance simplification','DECIMATE');modifier.ratio=.14
bpy.ops.object.modifier_apply(modifier=modifier.name)
far = pack(duplicate)
data = [{'name':'pine', 'sourceAsset':'low-poly-pine-tree/untitled.blend','lods':[near,far]}]
Path(output).write_text('// Converted from the user-supplied pine_tree.rar; Y up, trunk base at zero.\nexport default '+json.dumps(data,separators=(',',':'))+';\n')
print('PINE',[(sum(len(p['index'])//3 for p in level)) for level in [near,far]])
