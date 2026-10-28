# Une los cuadros PNG en una animación WebP (bucle infinito).
# v57: WebP animado en vez de GIF: color completo (sin paleta de 256) y unas 4 veces menos peso.
import sys, glob, json
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
SIZE = 300
frames = [Image.open(p).convert('RGB').resize((SIZE, SIZE), Image.LANCZOS) for p in sorted(glob.glob(src + '/*.png'))]
durations = json.loads(sys.argv[3]) if len(sys.argv) > 3 else 100
frames[0].save(out, save_all=True, append_images=frames[1:], duration=durations, loop=0, quality=75, method=6)
