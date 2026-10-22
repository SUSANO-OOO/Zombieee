"""Dedicated synthetic battle calls. Never imports/overwrites promotion audio."""
from pathlib import Path
import sys,json,dataclasses,hashlib,urllib.request
ROOT=Path(__file__).resolve().parents[1]
RUNTIME=Path('C:/Users/okait/Documents/Codex/2026-07-11/new-chat/output/promo-20261010/r3/voicevox')
OUT=ROOT/'assets/source/v104/combat-audio';OUT.mkdir(parents=True,exist_ok=True)
MODEL=ROOT/'outputs/motion-review/remediation-r3/12.vvm'
if not MODEL.exists():
    with urllib.request.urlopen('https://github.com/VOICEVOX/voicevox_vvm/releases/download/0.17.0/12.vvm',timeout=60) as r:MODEL.write_bytes(r.read())
assert hashlib.sha256(MODEL.read_bytes()).hexdigest()=='894464a6cbf59bdf930b8406097f44d2f25bb762db5bc71c9e9c31e1f904c715'
sys.path.insert(0,str(RUNTIME/'site'))
from voicevox_core.blocking import Onnxruntime,OpenJtalk,Synthesizer,VoiceModelFile
rt=RUNTIME/'runtime'
ort=Onnxruntime.load_once(filename=str(rt/'onnxruntime/lib/voicevox_onnxruntime.dll'))
synth=Synthesizer(ort,OpenJtalk(rt/'dict/open_jtalk_dic_utf_8-1.11'),acceleration_mode='CPU',cpu_num_threads=4)
for model in [rt/'models/vvms/4.vvm',MODEL]:
    with VoiceModelFile.open(model) as m:synth.load_voice_model(m)
cast=[('crazy-king',21,'剣崎雌雄',['いくぜ！','おらぁ！','ぐっ！','くそっ……。'],1.18),
      ('kumaverson',53,'麒ヶ島宗麟',['任せておけ。','せいっ！','ぬうっ。','ここまでか……。'],1.12),
      ('babayaga',11,'玄野武宏',['行くぞ。','はっ。','ぐっ。','まだ……。'],1.2)]
rows=[]
for kind,style,name,lines,speed in cast:
    for event,text in zip(['deploy','attack','hurt','death'],lines):
        q=synth.create_audio_query(text,style);q.speed_scale=speed;q.intonation_scale=1.0
        q.pre_phoneme_length=.015;q.post_phoneme_length=.035;q.output_sampling_rate=48000;q.output_stereo=False
        data=synth.synthesis(q,style);file=OUT/f'voice-{kind}-{event}.wav';file.write_bytes(data)
        query=dataclasses.asdict(q);(OUT/f'voice-{kind}-{event}.json').write_text(json.dumps(query,ensure_ascii=False,indent=2),encoding='utf-8',newline='\n')
        rows.append(dict(kind=kind,event=event,text=text,styleId=style,credit='VOICEVOX:'+name,source=str(file.relative_to(ROOT)).replace('\\','/'),sha256=hashlib.sha256(data).hexdigest(),synthetic=True))
        print(kind,event,flush=True)
(OUT/'voices.json').write_text(json.dumps(dict(engine='VOICEVOX Core 0.17.0',cast=rows,licenses=['https://www.virvoxproject.com/voicevoxの利用規約','https://frontier.creatia.cc/fanclubs/413/posts/4507'],note='Synthetic voices assigned only to these three named characters; no story full reading.'),ensure_ascii=False,indent=2),encoding='utf-8',newline='\n')
