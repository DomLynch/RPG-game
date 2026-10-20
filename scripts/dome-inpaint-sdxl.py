"""Banner-free sky dome pictures (Dom 2026-10-20: "remove the red banners painted into the sky dome image"): inpaint each banner with the PUBLIC SDXL inpainting model, on the T4.
Per banner: a 768 px window round its hand-drawn box, banner-red pixels inside the box (dilated 3 px, never outside the box) are the mask, the window goes to the model at 1024, and the result is pasted back
INSIDE THE MASK ONLY, so everything else in the picture is the original's pixels. Roofs are not banners: they are outside the boxes.
Usage: python3 dome-inpaint-sdxl.py <src image> <dst image> "x0,y0,x1,y1;x0,y0,x1,y1;..."   (same size and format out as in; webp quality 92)"""
import os
import sys

import numpy as np
import torch
from diffusers import AutoPipelineForInpainting
from PIL import Image, ImageFilter

src, dst, boxes_arg = sys.argv[1], sys.argv[2], sys.argv[3]
boxes = [tuple(map(int, b.split(','))) for b in boxes_arg.split(';')]
img = Image.open(src).convert('RGB')
W, H = img.size
arr = np.array(img)
# banner cloth: saturated red (hue wraps at 0), the same test the Mac-side Telea check used
hsv = np.array(img.convert('HSV')).astype(int)   # PIL HSV is 0..255 hue
red = ((hsv[..., 0] <= 12) | (hsv[..., 0] >= 243)) & (hsv[..., 1] >= 90) & (hsv[..., 2] >= 40)
DEV = 'cuda' if torch.cuda.is_available() else 'mps' if torch.backends.mps.is_available() else 'cpu'   # the T4 job, or the Mac's M5 GPU (Dom 2026-10-20: "just do it on the macbook")
pipe = AutoPipelineForInpainting.from_pretrained('diffusers/stable-diffusion-xl-1.0-inpainting-0.1', torch_dtype=torch.float16, variant='fp16').to(DEV)
PROMPT = 'weathered wooden log gate frame and rocky cliff behind it, dark fantasy orc fortress, matching the surroundings, sharp detail, no flag, no banner, no cloth'
NEG = 'banner, flag, red cloth, fabric, text, symbol, logo, blurry'
out = img.copy()
WIN = 768
for n, (x0, y0, x1, y1) in enumerate(boxes):
    m = np.zeros((H, W), np.uint8)
    if os.environ.get('FULLMASK') == '1': m[y0:y1, x0:x1] = 255   # a banner the red test cannot isolate (red-brown wood behind it): the whole box is repainted
    else: m[y0:y1, x0:x1][red[y0:y1, x0:x1]] = 255
    mi = Image.fromarray(m).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MaxFilter(7))   # about 6 px: the cloth's dark outline too
    box_only = np.zeros((H, W), np.uint8); box_only[y0:y1, x0:x1] = 255
    mask = np.minimum(np.array(mi), box_only)
    if mask.sum() == 0:
        print('box', n, 'has no banner red, skipped'); continue
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    wx0 = min(max(0, cx - WIN // 2), max(0, W - WIN)); wy0 = min(max(0, cy - WIN // 2), max(0, H - WIN))
    ww, wh = min(WIN, W), min(WIN, H)
    crop = out.crop((wx0, wy0, wx0 + ww, wy0 + wh)); mcrop = Image.fromarray(mask[wy0:wy0 + wh, wx0:wx0 + ww])
    res = pipe(prompt=PROMPT, negative_prompt=NEG, image=crop.resize((1024, 1024), Image.LANCZOS), mask_image=mcrop.resize((1024, 1024), Image.NEAREST),
               strength=0.99, num_inference_steps=30, guidance_scale=7.5, generator=torch.Generator('cpu').manual_seed(1000 + n)).images[0].resize((ww, wh), Image.LANCZOS)
    piece = Image.composite(res, crop, mcrop.filter(ImageFilter.GaussianBlur(1.2)))   # a 1 px soft edge, still inside the dilated mask
    out.paste(piece, (wx0, wy0))
    print('box', n, 'done, masked px', int((mask > 0).sum()))
if dst.endswith('.webp'): out.save(dst, 'WEBP', quality=92, method=6)
elif dst.endswith('.jpg'): out.save(dst, 'JPEG', quality=94)
else: out.save(dst)
print('saved', dst, out.size)
