"""Matte the existing silent fox video, preserving enclosed white eyes/pages.
Offline asset step: ffmpeg + numpy/scipy/Pillow. No runtime segmentation/model call.
"""
from pathlib import Path
import subprocess
import numpy as np
from scipy import ndimage
from PIL import Image
root = Path(__file__).resolve().parents[1] / 'androidApp/src/main'
raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(root/'res/raw/fox_reading.mp4'), '-vf', 'fps=12,scale=640:640', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
frames = []
for rgb in np.frombuffer(raw, dtype=np.uint8).reshape(-1,640,640,3):
    # Only near-white components connected to the outside are background.
    white = (rgb.min(axis=2) > 170) & (rgb.max(axis=2).astype(int) - rgb.min(axis=2) < 30)
    seed = np.zeros_like(white); seed[0,:]=white[0,:]; seed[-1,:]=white[-1,:]; seed[:,0]=white[:,0]; seed[:,-1]=white[:,-1]
    outside = ndimage.binary_propagation(seed, mask=white)
    alpha = (~outside).astype(np.float32)
    # Remove the subpixel white fringe without hollowing out the cream character.
    edge = ndimage.binary_dilation(outside) & ~outside
    alpha[edge] = np.clip((255-rgb[edge].min(axis=1).astype(float))/50,0,1)
    rgba = np.dstack((rgb,(alpha*255).astype(np.uint8)))
    frames.append(Image.fromarray(rgba).crop((96,96,576,584)))
# Long calm pause between each original forward-moving page turn; never reverse it.
durations = [83] * len(frames); durations[-1] = 1500
out=root/'res/raw/fox_reading_room.webp'
frames[0].save(out, save_all=True, append_images=frames[1:], duration=durations, loop=0, quality=87, method=4, minimize_size=False)
frames[0].save(root/'res/drawable-nodpi/fox_reading_room_still.webp', quality=91, method=6)
print(f'{len(frames)} frames, {frames[0].size}, {out.stat().st_size} bytes')
