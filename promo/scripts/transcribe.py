# Letra con tiempos de una canción sin letra en LRCLIB (borrador: hay que revisarla a mano).
import json
import sys

from faster_whisper import WhisperModel

model = WhisperModel(sys.argv[3] if len(sys.argv) > 3 else 'small.en', device='cpu', compute_type='int8')
segments, _ = model.transcribe(sys.argv[1], language='en', vad_filter=False, word_timestamps=True, beam_size=5)
out = []
for s in segments:
    out.append({'start': round(s.start, 2), 'end': round(s.end, 2), 'text': s.text.strip(),
                'words': [{'w': w.word, 's': round(w.start, 2), 'e': round(w.end, 2)} for w in s.words]})
    print(f'[{s.start:6.2f} - {s.end:6.2f}] {s.text.strip()}'.encode('ascii', 'replace').decode(), flush=True)
json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
