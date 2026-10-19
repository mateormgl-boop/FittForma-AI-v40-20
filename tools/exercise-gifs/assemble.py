# Une los cuadros PNG en un GIF animado con paleta compartida (bucle infinito).
# La paleta reserva los rojos de los músculos y los colores de bandas/colchonetas para que no se pierdan.
import sys, glob
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
SIZE = 300
frames = [Image.open(p).convert('RGB').resize((SIZE, SIZE), Image.LANCZOS) for p in sorted(glob.glob(src + '/*.png'))]
strip = Image.new('RGB', (frames[0].width, frames[0].height * len(frames)))
for i, f in enumerate(frames): strip.paste(f, (0, i * f.height))
FIXED = ['ff6a4d', 'f45a3e', 'e63b22', 'd4301a', 'c42a14', 'b8240f', '9c1e0c', '8f1a08', 'ff8a5c', 'f7a481', 'efc0aa', 'e7d6cf',
         '2bd96b', '1c4a33', 'd8c7a0', 'f4f6f8', 'd4d9de', 'a9b0b8', '59616a', '16191d']
base = strip.quantize(colors=256 - len(FIXED), method=Image.Quantize.MEDIANCUT).getpalette()[:3 * (256 - len(FIXED))]
pal_img = Image.new('P', (1, 1))
pal_img.putpalette(base + [int(c[i:i + 2], 16) for c in FIXED for i in (0, 2, 4)])
q = [f.quantize(palette=pal_img, dither=Image.Dither.NONE) for f in frames]
q[0].save(out, save_all=True, append_images=q[1:], duration=105, loop=0, optimize=True, disposal=1)
