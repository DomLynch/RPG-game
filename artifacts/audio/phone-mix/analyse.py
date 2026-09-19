"""Reproduce spectral comparisons from audio-preview WAVs; requires NumPy."""
import json
from pathlib import Path
import re
import subprocess
import wave

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / "artifacts/audio/phone-mix-before"
AFTER = ROOT / "artifacts/audio/phone-mix-after"
BANDS = [(0, 250), (250, 1000), (1000, 4000), (4000, 8000), (8000, 24001)]


def read(path):
    with wave.open(str(path)) as source:
        assert source.getframerate() == 48000 and source.getnchannels() == 1
        return np.frombuffer(source.readframes(source.getnframes()), dtype="<i2").astype(float) / 32768


def spectrum(samples):
    frames = np.lib.stride_tricks.sliding_window_view(samples, 2048)[::1024]
    power = np.sum(np.abs(np.fft.rfft(frames * np.hanning(2048))) ** 2, axis=0)
    frequency = np.fft.rfftfreq(2048, 1 / 48000)
    return {
        "centroidHz": round(float(np.sum(power * frequency) / np.sum(power)), 1),
        "bandEnergyPercent": [round(float(100 * np.sum(power[(frequency >= low) & (frequency < high)]) / np.sum(power)), 3) for low, high in BANDS],
    }


old_loudness = json.loads((BASE / "loudness.json").read_text())["loudness"]
new_loudness = json.loads((AFTER / "loudness.json").read_text())["loudness"]
rows = {}
for path in sorted((AFTER / "events").glob("*.wav")):
    old, new = read(BASE / "events" / path.name), read(path)
    before, after = spectrum(old), spectrum(new)
    name = "events/" + path.stem
    rows[path.stem] = {
        "before": before, "after": after,
        "lufsDelta": round(new_loudness[name]["lufsIntegrated"] - old_loudness[name]["lufsIntegrated"], 1),
        "phoneLufsDelta": round(new_loudness[name]["lufsPhone"] - old_loudness[name]["lufsPhone"], 1),
        "peakDbfs": new_loudness[name]["peakDbfs"],
        "maxBandShareChangePoints": round(max(abs(a - b) for a, b in zip(before["bandEnergyPercent"], after["bandEnergyPercent"])), 3),
    }
    meter = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True, check=True)
    rows[path.stem]["truePeakDbtp"] = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", meter.stderr)[-1])
result = {"method": "48 kHz mono, 2048-sample Hann windows, 1024 hop, summed FFT power; descriptive spectrum, not a listening test", "bandsHz": BANDS, "probes": rows}
(ROOT / "artifacts/audio/phone-mix/frequency.json").write_text(json.dumps(result, indent=2) + "\n")
assert max(row["truePeakDbtp"] for row in rows.values()) <= -1, "reconstructed peaks must retain headroom"
for name, row in rows.items():
    print(f'{name:34} delta {row["lufsDelta"]:+.1f} dB; true peak {row["truePeakDbtp"]:.1f}; centroid {row["after"]["centroidHz"]:.0f} Hz; band shift {row["maxBandShareChangePoints"]:.3f} pp')
