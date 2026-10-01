"""Fold a glTF baseColorFactor into sRGB texels (Armour 2026-09-30, Lead P2 / Hero Look's Shieldmaiden L1 finding).

baseColorFactor is LINEAR; baseColorTexture texels are sRGB. The product has to be taken in linear light and encoded back:
out = sRGB(linear(texel) x factor). The old rebake-nb line multiplied the sRGB bytes by the linear factor, so every factor-only or
factor-tinted part came out too dark (factor 0.16 -> byte 41 instead of 111).
"""
import numpy as np


def srgb_to_linear(c):
    c = np.asarray(c, np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(c):
    c = np.clip(np.asarray(c, np.float64), 0, None)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def fold_base_factor(texels, factor):
    """texels: sRGB bytes as float/uint8 (..., 3), 0..255. factor: linear rgb. Returns uint8 sRGB."""
    f = np.asarray(factor, np.float64)[:3]
    t = np.asarray(texels, np.float64)
    if np.allclose(f, 1):
        return np.clip(t, 0, 255).astype(np.uint8)  # untouched texels stay byte-exact
    return np.clip(np.rint(linear_to_srgb(srgb_to_linear(t / 255) * f) * 255), 0, 255).astype(np.uint8)
