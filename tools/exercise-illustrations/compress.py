# Reduce el PNG de la lámina: paleta adaptativa de 256 colores (octree conserva bien el rojo de los músculos) y borra el original.
import os, sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG).save(dst, optimize=True)
os.remove(src)
