"""Rasterize licensed Anton into a proportional, heavy 48-pixel PSX display face.
Usage: python3 scripts/build-display-font.py /path/to/Anton-Regular.ttf
The CSS data URL keeps the small atlas font local and avoids external font requests.
"""
import base64, io, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

font=ImageFont.truetype(sys.argv[1],48,layout_engine=ImageFont.Layout.BASIC)
fallback=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',44)
chars=sorted(set(list(range(32,384))+[0x20ac,0x2190,0x2191,0x2192,0x2193,0x2197,0x2198,0x2212,0x25b6,0x2161,0x2713,0x2013,0x2014,0x2026,0x2018,0x2019,0x201c,0x201d,0x00d7]))
names=['.notdef']+['uni%04X'%c for c in chars];glyphs={};metrics={}
for code,name in [(None,'.notdef')]+list(zip(chars,names[1:])):
    f=fallback if code and code>=0x2000 else font
    text=chr(code) if code else '?';im=Image.new('L',(90,80));d=ImageDraw.Draw(im);d.text((4,58),text,font=f,fill=255,anchor='ls');pen=TTGlyphPen(None)
    for y in range(80):
        x=0
        while x<90:
            if im.getpixel((x,y))<100:x+=1;continue
            a=x
            while x<90 and im.getpixel((x,y))>=100:x+=1
            left=(a-4)*20;right=(x-4)*20;bottom=(57-y)*20;top=bottom+20
            pen.moveTo((left,bottom));pen.lineTo((right,bottom));pen.lineTo((right,top));pen.lineTo((left,top));pen.closePath()
    glyphs[name]=pen.glyph();metrics[name]=(round(f.getlength(text)*20)+20,0)
fb=FontBuilder(960,isTTF=True);fb.setupGlyphOrder(names);fb.setupCharacterMap(dict(zip(chars,names[1:])));fb.setupGlyf(glyphs);fb.setupHorizontalMetrics(metrics);fb.setupHorizontalHeader(ascent=960,descent=-260);fb.setupOS2(sTypoAscender=960,sTypoDescender=-260,usWinAscent=1200,usWinDescent=350,usWeightClass=900);fb.setupNameTable({'familyName':'Drift Display','styleName':'Heavy','uniqueFontIdentifier':'DriftDisplay 1.0','fullName':'Drift Display Heavy','psName':'DriftDisplay-Heavy','version':'Version 1.0','copyright':'Derived from Anton, Copyright 2020 The Anton Project Authors. SIL Open Font License 1.1. Symbols from DejaVu Sans Bold.'});fb.setupPost();fb.setupMaxp();fb.font.flavor='woff';out=io.BytesIO();fb.save(out)
data=base64.b64encode(out.getvalue()).decode()
Path('css/display-font.css').write_text('@font-face{font-family:DriftDisplay;src:url(data:font/woff;base64,'+data+') format("woff");font-weight:100 900;font-style:normal;font-display:swap}\n')
print('Display face:',len(out.getvalue()),'bytes')
