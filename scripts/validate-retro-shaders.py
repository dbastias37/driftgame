"""Optional native EGL shader check (requires moderngl); not browser automation."""
import sys
from pathlib import Path
import moderngl
root=Path(sys.argv[1]);ctx=moderngl.create_standalone_context(backend='egl')
for path in sorted(root.glob('*.vert')):
    ctx.program(vertex_shader=path.read_text(),fragment_shader=path.with_suffix('.frag').read_text())
    print('PASS',path.name)
ctx.program(vertex_shader='#version 330\nin vec2 position;out vec2 vUv;void main(){vUv=(position+1.)*.5;gl_Position=vec4(position,0,1);}',fragment_shader=(root/'retro-post.frag').read_text())
print('PASS postprocess;',ctx.info['GL_RENDERER'])
