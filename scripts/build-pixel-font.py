"""Regenerate Drift Pixel from the licensed DejaVu Sans Mono installed on Linux.
Run from repository root with Pillow and fontTools. The shipped WOFF has no runtime dependencies.
"""
from PIL import Image,ImageDraw,ImageFont
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from pathlib import Path
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',13,layout_engine=ImageFont.Layout.BASIC)
chars=list(range(32,384))+[0x20ac,0x2190,0x2191,0x2192,0x2193,0x2197,0x2212,0x25b6,0x2161,0x2713,0x2013,0x2014,0x2026,0x2018,0x2019,0x201c,0x201d,0x00d7]
chars=sorted(set(chars));names=['.notdef']+['uni%04X'%c for c in chars];glyphs={};metrics={}
for code,name in [(None,'.notdef')]+list(zip(chars,names[1:])):
    im=Image.new('L',(20,22));d=ImageDraw.Draw(im);d.text((1,16),chr(code) if code else '?',font=font,fill=255,anchor='ls');pen=TTGlyphPen(None)
    for y in range(22):
      x=0
      while x<20:
        if im.getpixel((x,y))<115:x+=1;continue
        a=x
        while x<20 and im.getpixel((x,y))>=115:x+=1
        left=(a-1)*64;right=(x-1)*64;bottom=(15-y)*64;top=bottom+64
        pen.moveTo((left,bottom));pen.lineTo((right,bottom));pen.lineTo((right,top));pen.lineTo((left,top));pen.closePath()
    glyphs[name]=pen.glyph();metrics[name]=(512,0)
fb=FontBuilder(1024,isTTF=True);fb.setupGlyphOrder(names);fb.setupCharacterMap(dict(zip(chars,names[1:])));fb.setupGlyf(glyphs);fb.setupHorizontalMetrics(metrics);fb.setupHorizontalHeader(ascent=832,descent=-256);fb.setupOS2(sTypoAscender=832,sTypoDescender=-256,usWinAscent=1024,usWinDescent=320);fb.setupNameTable({'familyName':'Drift Pixel','styleName':'Regular','uniqueFontIdentifier':'DriftPixel 1.0','fullName':'Drift Pixel','psName':'DriftPixel','version':'Version 1.0','copyright':'Derived from DejaVu Sans Mono. Bitstream Vera and DejaVu font license.'});fb.setupPost();fb.setupMaxp();fb.font.flavor='woff';fb.save('assets/fonts/drift-pixel.woff')
