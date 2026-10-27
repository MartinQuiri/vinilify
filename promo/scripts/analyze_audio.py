# Tempo, cuadrícula de golpes y energía de la canción, para cortar el video al ritmo.
import json
import sys
import wave

import numpy as np
from scipy.signal import find_peaks

path = sys.argv[1]
with wave.open(path) as w:
    rate = w.getframerate()
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768

hop = 512
win = 2048
frames = 1 + (len(x) - win) // hop
idx = np.arange(win)[None, :] + hop * np.arange(frames)[:, None]
spec = np.abs(np.fft.rfft(x[idx] * np.hanning(win), axis=1))
logspec = np.log1p(spec * 10)
# Flujo espectral (cuánto "aparece" de golpe): base para detectar golpes.
flux = np.maximum(0, np.diff(logspec, axis=0)).sum(axis=1)
flux = np.concatenate([[0], flux])
flux = (flux - flux.mean()) / (flux.std() + 1e-9)
fps = rate / hop

# Tempo por autocorrelación del flujo, buscando entre 70 y 180 BPM.
ac = np.correlate(flux, flux, mode='full')[len(flux) - 1:]
lags = np.arange(len(ac))
bpm_of = lambda lag: 60 * fps / lag
valid = (bpm_of(np.maximum(lags, 1)) >= 70) & (bpm_of(np.maximum(lags, 1)) <= 180)
best = lags[valid][np.argmax(ac[valid])]
bpm = bpm_of(best)
# Afinar el tempo y la fase probando una rejilla fina.
period = 60 / bpm
best_score, best_phase, best_period = -1, 0, period
times = np.arange(len(flux)) / fps
for p in np.linspace(period * 0.98, period * 1.02, 81):
    for ph in np.linspace(0, p, 64, endpoint=False):
        beats = np.arange(ph, times[-1], p)
        score = flux[np.clip((beats * fps).astype(int), 0, len(flux) - 1)].mean()
        if score > best_score:
            best_score, best_phase, best_period = score, ph, p

rms = np.sqrt((x[idx] ** 2).mean(axis=1))
per_sec = [float(rms[(times >= s) & (times < s + 1)].mean()) for s in range(int(times[-1]))]
onsets, _ = find_peaks(flux, height=1.5, distance=int(0.12 * fps))

result = {
    'bpm': 60 / best_period,
    'beat_period': best_period,
    'first_beat': best_phase,
    'energy_per_second': per_sec,
    'strong_onsets': [round(float(t), 3) for t in times[onsets]],
}
json.dump(result, open(sys.argv[2], 'w'), indent=1)
print(f"BPM {result['bpm']:.2f}  periodo {best_period:.4f}s  primer golpe {best_phase:.3f}s")
peak = max(per_sec)
for s, e in enumerate(per_sec[:100]):
    print(f'{s:3d}s ' + '#' * int(40 * e / peak))

