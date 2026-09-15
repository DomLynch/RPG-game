# GPT brief — two extra portraits for the jaw (same man as `gpt_front.png`)

Paste to GPT with `gpt_front.png` attached as the identity reference:

> Same man as the attached photo — identical face, skin, buzz cut, heavy brows, stubble, olive skin, neutral expression,
> mouth closed, no smile. Photorealistic studio photograph, plain mid-grey backdrop, soft even light, no shadows on the
> backdrop, no hat, no jewellery, shoulders bare. Square 1024×1024, head fills ~70% of the frame, centred.
>
> Shot A — **worm's-eye front**: camera 30 cm below chin level looking up at ~45°, straight on. The underside of the jaw,
> the chin and the throat must be fully visible; the nostrils visible; the top of the head cut off is fine.
>
> Shot B — **worm's-eye three-quarter**: same camera height and 45° tilt, but from 45° to the subject's right, so the jawline
> from chin to ear is seen from below.

Checks before saving (each shot):
- The head is not tilted or turned differently from the front reference — same hair, same stubble pattern, same ears.
- The chin is a real rounded chin ahead of the lower lip (it is in the references); no beard beyond stubble.
- Backdrop uniform grey; nothing behind the chin.

Save as `artifacts/source/face/gpt/jaw_a.png` and `jaw_b.png`, then run:

```bash
node scripts/create-head.mjs artifacts/source/keentools artifacts/source/face/gpt_front.png artifacts/source/face/gpt/raw4.png artifacts/source/face/gpt/raw3.png artifacts/source/face/gpt/raw2.png artifacts/source/face/gpt/raw1.png artifacts/source/face/gpt/jaw_a.png artifacts/source/face/gpt/jaw_b.png
```

(`KEENTOOLS_API_KEY` in the environment; one billed job, ~4 min.) Point `head.KT_GLB` at the new GLB and rebuild with the
usual `HEAD_PHOTO=1 HEAD_KT=1 blender -b -P scripts/character/parts.py -- --body realistic`. Add the two views to the
`cams` list in `keentools_head` (azimuth 0 and −45°, elevation −45°) so the coverage mask knows the jaw was photographed.
