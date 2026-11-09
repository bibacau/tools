"""Optional CPU-only speech service. No third-party audio requests."""
import json, os, subprocess, tempfile, wave
from fastapi import FastAPI, UploadFile, HTTPException
from vosk import Model, KaldiRecognizer
app = FastAPI()
model_path = os.environ.get('MODEL_PATH', '/models/model')
model = Model(model_path) if os.path.isdir(model_path) else None
@app.get('/health')
def health():
    if model is None:
        raise HTTPException(503, 'Install an extracted Vosk model at /models/model')
    return {'ok': True}
@app.post('/transcribe')
async def transcribe(audio: UploadFile):
    if model is None:
        raise HTTPException(503, 'No installed model')
    data = await audio.read(25 * 1024 * 1024 + 1)
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(413, 'Recording too large')
    with tempfile.TemporaryDirectory() as folder:
        source, output = folder+'/input', folder+'/audio.wav'
        with open(source, 'wb') as f:
            f.write(data)
        result = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', source, '-t', '600', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', output], capture_output=True, timeout=60)
        if result.returncode:
            raise HTTPException(400, 'Unsupported audio format')
        rec = KaldiRecognizer(model, 16000)
        parts = []
        with wave.open(output) as f:
            while chunk := f.readframes(4000):
                if rec.AcceptWaveform(chunk):
                    parts.append(json.loads(rec.Result()).get('text', ''))
        parts.append(json.loads(rec.FinalResult()).get('text', ''))
        return {'text': ' '.join(filter(None, parts))}
