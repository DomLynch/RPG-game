"""Shrink the embedded JPEG textures of one GLB to at most N pixels a side (World, Test Zone B2b; the kit texture pass).
Everything else (geometry, accessors, materials) is copied byte for byte; only the image buffer views are replaced and the views re-laid.
    python3 -I scripts/shrink-glb-textures.py <in.glb> <out.glb> <max-px> [quality]
Single embedded buffer, JPEG images only (the same contract as scripts/optimize-glb.mjs)."""
import io, json, struct, sys
from PIL import Image

GLB_MAGIC, JSON_CHUNK, BIN_CHUNK, ALIGN, DEFAULT_QUALITY = 0x46546C67, 0x4E4F534A, 0x004E4942, 4, 85


def pad(n):
    return (ALIGN - n % ALIGN) % ALIGN


def main(src, dst, max_px, quality):
    raw = open(src, 'rb').read()
    assert struct.unpack('<I', raw[:4])[0] == GLB_MAGIC, 'Expected GLB'
    jlen = struct.unpack('<I', raw[12:16])[0]
    doc, binary = json.loads(raw[20:20 + jlen]), raw[28 + jlen:]
    assert len(doc['buffers']) == 1, 'one embedded buffer'
    views = doc['bufferViews']
    replaced = {}
    for im in doc.get('images', []):
        v = views[im['bufferView']]
        data = binary[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
        pic = Image.open(io.BytesIO(data))
        assert pic.format == 'JPEG', 'JPEG images only'
        if max(pic.size) > max_px:
            scale = max_px / max(pic.size)
            pic = pic.resize((max(1, round(pic.width * scale)), max(1, round(pic.height * scale))), Image.LANCZOS)
        out = io.BytesIO()
        pic.convert('RGB').save(out, 'JPEG', quality=quality, optimize=True)
        replaced[im['bufferView']] = out.getvalue()
    chunks, at = [], 0
    for i, v in enumerate(views):
        body = replaced.get(i, binary[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']])
        v['byteOffset'], v['byteLength'] = at, len(body)
        chunks.append(body + b'\0' * pad(len(body)))
        at += len(chunks[-1])
    new_bin = b''.join(chunks)
    doc['buffers'][0]['byteLength'] = len(new_bin)
    j = json.dumps(doc, separators=(',', ':')).encode()
    j += b' ' * pad(len(j))
    total = 12 + 8 + len(j) + 8 + len(new_bin)
    open(dst, 'wb').write(struct.pack('<III', GLB_MAGIC, 2, total) + struct.pack('<II', len(j), JSON_CHUNK) + j + struct.pack('<II', len(new_bin), BIN_CHUNK) + new_bin)
    print(f'{src}: {len(raw)} -> {dst}: {total} bytes (images at most {max_px}px)')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]) if len(sys.argv) > 4 else DEFAULT_QUALITY)
