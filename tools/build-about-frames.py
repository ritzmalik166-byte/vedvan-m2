"""Build the web frame sets for the home "About Vedvan" sequence.

Source: canvas2/frame_NNN.png (3840x2160, numbered from 001 with no gaps).
The source PNGs (~7 MB each) are far too heavy for the page, so this writes
WebP sets that keep the source numbering:
  assets/home/about/frames/landscape/frame_NNN.webp   1920x1080, full frame
  assets/home/about/frames/portrait/frame_NNN.webp    810x1080, centred 3:4 crop
  script/home/about.data.js                           frame count + paths

Rerun after replacing the source frames:
  python tools/build-about-frames.py   (requires Pillow)
"""
import os
import re
import shutil
from concurrent.futures import ProcessPoolExecutor

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, 'canvas2')
OUT = os.path.join(ROOT, 'assets', 'home', 'about', 'frames')
DATA = os.path.join(ROOT, 'script', 'home', 'about.data.js')
PATTERN = re.compile(r'^frame_(\d+)\.png$', re.I)
DIGITS = 3
# Export rate: frame_N is source timecode N-1 at 30 fps (frame_080 = 2s 19f)
FPS = 30

SETS = {
    'landscape': {'size': (1920, 1080), 'crop': None, 'quality': 66},
    'portrait': {'size': (810, 1080), 'crop': 3 / 4, 'quality': 68},
}


def collect():
    frames = []
    for name in os.listdir(SOURCE):
        m = PATTERN.match(name)
        if m:
            frames.append((int(m.group(1)), name))
    frames.sort()
    numbers = [n for n, _ in frames]
    expected = list(range(numbers[0], numbers[0] + len(numbers)))
    if numbers != expected:
        missing = sorted(set(expected) - set(numbers))
        raise SystemExit('Frame numbering has gaps: %s' % missing[:20])
    return frames


def convert(job):
    number, name = job
    image = Image.open(os.path.join(SOURCE, name)).convert('RGB')
    for set_name, spec in SETS.items():
        frame = image
        if spec['crop']:
            w, h = image.size
            cw = round(h * spec['crop'])
            left = (w - cw) // 2
            frame = image.crop((left, 0, left + cw, h))
        frame = frame.resize(spec['size'], Image.LANCZOS)
        out = os.path.join(OUT, set_name, 'frame_%0*d.webp' % (DIGITS, number))
        frame.save(out, 'WEBP', quality=spec['quality'], method=5)
    return number


def main():
    frames = collect()
    for set_name in SETS:
        folder = os.path.join(OUT, set_name)
        shutil.rmtree(folder, ignore_errors=True)
        os.makedirs(folder)

    with ProcessPoolExecutor() as pool:
        for done in pool.map(convert, frames, chunksize=4):
            if done % 50 == 0:
                print('frame', done)

    sets = ',\n    '.join(
        "%s: { path: 'assets/home/about/frames/%s/', width: %d, height: %d }" % (k, k, v['size'][0], v['size'][1])
        for k, v in SETS.items()
    )
    with open(DATA, 'w', encoding='utf-8', newline='\n') as f:
        f.write(
            '/* ==========================================================================\n'
            '   Vedvan - home "About Vedvan" frame sequence (generated)\n'
            '   Written by tools/build-about-frames.py from canvas2/frame_NNN.png; rerun\n'
            '   the script instead of editing by hand. Image i (0-based) is\n'
            '   <path>frame_<first + i, zero-padded to digits><extension>.\n'
            '   ========================================================================== */\n'
            'window.VedvanAboutFrames = {\n'
            '  fps: %d,\n'
            '  count: %d,\n'
            '  first: %d,\n'
            "  prefix: 'frame_',\n"
            '  digits: %d,\n'
            "  extension: '.webp',\n"
            '  sets: {\n    %s\n  }\n'
            '};\n' % (FPS, len(frames), frames[0][0], DIGITS, sets)
        )
    print('wrote', len(frames), 'frames')


if __name__ == '__main__':
    main()
