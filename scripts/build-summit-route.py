"""Derive native driving data from the supplied Summit GLB. Requires numpy and scipy.

The atlas identifies both asphalt lanes; welded transverse edges recover the
complete cycle without guessing a spline. The render mesh remains untouched.
Run from any directory: python3 scripts/build-summit-route.py
"""
import collections
import hashlib
import json
import struct
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
blob = (ROOT / 'assets/bonus/summit.glb').read_bytes()
size = struct.unpack_from('<I', blob, 12)[0]
gltf = json.loads(blob[20:20 + size])
binary = blob[28 + size:]

def accessor(index):
    a = gltf['accessors'][index]
    v = gltf['bufferViews'][a['bufferView']]
    dtype = {5126: '<f4', 5125: '<u4', 5123: '<u2', 5121: 'u1'}[a['componentType']]
    width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    return np.frombuffer(binary, dtype=dtype, count=a['count'] * width,
                         offset=v.get('byteOffset', 0) + a.get('byteOffset', 0)).reshape(-1, width)

meshes = []
def visit(index, matrix):
    node = gltf['nodes'][index]
    local = np.array(node.get('matrix', np.eye(4).flatten())).reshape(4, 4).T
    matrix = matrix @ local
    if 'mesh' in node:
        primitive = gltf['meshes'][node['mesh']]['primitives'][0]
        p = accessor(primitive['attributes']['POSITION'])
        vertices = (np.c_[p, np.ones(len(p))] @ matrix.T)[:, :3]
        meshes.append((vertices, accessor(primitive['attributes']['TEXCOORD_0']) * 512,
                       accessor(primitive['indices']).reshape(-1, 3)))
    for child in node.get('children', []):
        visit(child, matrix)
visit(0, np.eye(4))

parents, coordinates, links = {}, {}, []
def key(p): return tuple(np.round(p, 2))
def root(k):
    parents.setdefault(k, k)
    if parents[k] != k:
        parents[k] = root(parents[k])
    return parents[k]
def weld(a, b): parents[root(a)] = root(b)

support, roofs = [], []
for vertices, uv, indices in meshes:
    lo, hi = uv.min(0), uv.max(0)
    asphalt = lo[1] > 317 and hi[1] < 361 and lo[0] > 21 and hi[0] < 153
    checkers = 288 < lo[0] < 289 and 383 < lo[1] < 384
    triangles = vertices[indices]
    normals = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
    areas = np.linalg.norm(normals, axis=1)
    walkable = np.abs(normals[:, 1]) > areas * .65
    support.extend(triangles[walkable])
    roofs.extend(triangles[walkable & (areas > 8)])
    if not (asphalt or checkers):
        continue
    assert len(vertices) % 4 == 0
    for i in range(0, len(vertices), 4):
        v, tex = vertices[i:i + 4], uv[i:i + 4]
        ids = [key(p) for p in v]
        coordinates.update(zip(ids, v))
        order = np.argsort(tex[:, 1])
        a, b = [ids[int(j)] for j in order[:2]], [ids[int(j)] for j in order[2:]]
        weld(*a); weld(*b); links.append((a[0], b[0]))

sections, graph = collections.defaultdict(list), collections.defaultdict(set)
for k, v in coordinates.items(): sections[root(k)].append(v)
for a, b in links:
    a, b = root(a), root(b)
    if a != b:
        graph[a].add(b); graph[b].add(a)
assert all(len(v) == 3 for v in sections.values())
assert all(len(v) == 2 for v in graph.values())
centers = {k: np.mean(v, axis=0) for k, v in sections.items()}
start = min(centers, key=lambda k: np.linalg.norm(centers[k] - [462.58, -29.13, 1021.87]))
ordered, previous, current = [start], None, start
while True:
    choices = graph[current] - {previous}
    nxt = min(choices, key=lambda k: centers[k][0])  # Forward through sector 1.
    if nxt == start: break
    assert nxt not in ordered
    ordered.append(nxt); previous, current = current, nxt
assert len(ordered) == len(sections)
points = np.array([centers[k] for k in ordered])
distance = np.linalg.norm(np.roll(points, -1, axis=0)[:, [0, 2]] - points[:, [0, 2]], axis=1)
stations = np.r_[0, np.cumsum(distance)]

# Spatial bins for exact road contact and overhead detection.
triangles = np.array(support)
grid = collections.defaultdict(list)
for index, tri in enumerate(triangles):
    lo, hi = np.floor(tri[:, [0, 2]].min(0) / 32).astype(int), np.floor(tri[:, [0, 2]].max(0) / 32).astype(int)
    for x in range(lo[0], hi[0] + 1):
        for z in range(lo[1], hi[1] + 1): grid[x, z].append(index)
def heights(x, z):
    candidates = triangles[grid[int(np.floor(x / 32)), int(np.floor(z / 32))]]
    a, b, c = candidates[:, 0], candidates[:, 1], candidates[:, 2]
    den = (b[:, 2] - c[:, 2]) * (a[:, 0] - c[:, 0]) + (c[:, 0] - b[:, 0]) * (a[:, 2] - c[:, 2])
    den = np.where(np.abs(den) < 1e-9, np.inf, den)
    u = ((b[:, 2] - c[:, 2]) * (x - c[:, 0]) + (c[:, 0] - b[:, 0]) * (z - c[:, 2])) / den
    v = ((c[:, 2] - a[:, 2]) * (x - c[:, 0]) + (a[:, 0] - c[:, 0]) * (z - c[:, 2])) / den
    mask = (u >= -.0001) & (v >= -.0001) & (u + v <= 1.0001)
    return (u * a[:, 1] + v * b[:, 1] + (1 - u - v) * c[:, 1])[mask]

rows, covered = [], []
for i, k in enumerate(ordered):
    p = points[i]; tangent = points[(i + 1) % len(points)] - points[i - 1]
    normal = np.array([-tangent[2], 0, tangent[0]]); normal /= np.linalg.norm(normal)
    cross = sorted(sections[k], key=lambda q: np.dot(q - p, normal))
    p = cross[1]  # Preserve the actual shared centre vertex, including camber.
    left, right = np.linalg.norm((cross[0] - p)[[0, 2]]), np.linalg.norm((cross[2] - p)[[0, 2]])
    bank = np.arctan2(cross[2][1] - cross[0][1], left + right)
    roof = heights(p[0], p[2]) - p[1]; roof = roof[(roof > 3) & (roof < 35)]
    covered.append(float(roof.min()) if len(roof) else 0)
    rows.append([float(p[0]), float(p[2]), float(p[1]), float(left), float(right), float(bank)])

points = np.array([[r[0], r[2], r[1]] for r in rows])
distance = np.linalg.norm(np.roll(points, -1, axis=0)[:, [0, 2]] - points[:, [0, 2]], axis=1)
stations = np.r_[0, np.cumsum(distance)]

# Short overhead signs must not turn an entire sector into a tunnel.
features, run = [], None
for i, value in enumerate(covered + [0]):
    if value and run is None: run = i
    if not value and run is not None:
        if stations[i] - stations[run] > 45:
            features.append({'kind': 'tunnel', 'start': round(stations[run], 3),
                             'end': round(stations[i], 3), 'clearance': round(min(covered[run:i]), 3)})
        run = None

# Retain only support triangles near the driven strip. All visual scenery stays
# in the existing GLB, and is never duplicated in this data file.
from scipy.spatial import cKDTree
tree = cKDTree(points[:, [0, 2]])
mean = triangles.mean(1); d, ids = tree.query(mean[:, [0, 2]])
mask = (d < 32) & (np.abs(mean[:, 1] - points[ids, 1]) < 8)
contact = triangles[mask].copy()
contact = contact[:, :, [0, 2, 1]].reshape(-1, 9)
data = {'sourceSHA256': hashlib.sha256(blob).hexdigest(), 'length': round(float(stations[-1]), 4),
        'sections': np.round(rows, 5).tolist(), 'support': np.round(contact, 5).tolist(), 'features': features}
target = ROOT / 'js/summit-data.js'
target.write_text('// Generated by scripts/build-summit-route.py; source and attribution: assets/SCENERY-CREDITS.md\n'
                  + 'globalThis.DriftSummitData=' + json.dumps(data, separators=(',', ':')) + ';\n')
print(json.dumps({'sections': len(rows), 'length': data['length'], 'supportTriangles': len(contact),
                  'tunnels': features, 'bytes': target.stat().st_size}, indent=2))
