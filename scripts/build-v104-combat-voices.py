"""Dedicated synthetic battle calls. Never imports/overwrites promotion audio."""
from pathlib import Path
import sys,json,dataclasses,hashlib,urllib.request,argparse,os
parser=argparse.ArgumentParser()
parser.add_argument('--only-red-panther',action='store_true')
parser.add_argument('--runtime',type=Path,default=os.environ.get('VOICEVOX_RUNTIME'),help='VOICEVOX Core 0.17.0 directory containing site/ and runtime/')
parser.add_argument('--check-runtime',action='store_true',help='Check required runtime files without downloading models or rendering audio')
args=parser.parse_args()
ROOT=Path(__file__).resolve().parents[1]
if args.runtime is None:
    parser.error('Specify --runtime or VOICEVOX_RUNTIME; no machine-specific runtime is assumed.')
RUNTIME=Path(args.runtime).expanduser().resolve()
required=['site/voicevox_core/__init__.py','runtime/onnxruntime/lib/voicevox_onnxruntime.dll',
          'runtime/dict/open_jtalk_dic_utf_8-1.11/sys.dic','runtime/models/vvms/4.vvm']
missing=[name for name in required if not (RUNTIME/name).is_file()]
if missing:
    parser.error('Incomplete VOICEVOX Core 0.17.0 runtime: '+', '.join(missing))
if args.check_runtime:
    print('Required runtime files are present. No model download or synthesis was performed.')
    raise SystemExit(0)
OUT=ROOT/'assets/source/v104/combat-audio'
MODEL=ROOT/'outputs/motion-review/remediation-r3/12.vvm'
if not MODEL.exists():
    MODEL.parent.mkdir(parents=True,exist_ok=True)
    with urllib.request.urlopen('https://github.com/VOICEVOX/voicevox_vvm/releases/download/0.17.0/12.vvm',timeout=60) as r:MODEL.write_bytes(r.read())
assert hashlib.sha256(MODEL.read_bytes()).hexdigest()=='894464a6cbf59bdf930b8406097f44d2f25bb762db5bc71c9e9c31e1f904c715'
sys.path.insert(0,str(RUNTIME/'site'))
from voicevox_core.blocking import Onnxruntime,OpenJtalk,Synthesizer,VoiceModelFile
rt=RUNTIME/'runtime'
ort=Onnxruntime.load_once(filename=str(rt/'onnxruntime/lib/voicevox_onnxruntime.dll'))
synth=Synthesizer(ort,OpenJtalk(rt/'dict/open_jtalk_dic_utf_8-1.11'),acceleration_mode='CPU',cpu_num_threads=4)
for model in [rt/'models/vvms/4.vvm',MODEL]:
    with VoiceModelFile.open(model) as m:synth.load_voice_model(m)
OUT.mkdir(parents=True,exist_ok=True)
cast=[('crazy-king',21,'剣崎雌雄',['いくぜ！','おらぁ！','ぐっ！','くそっ……。'],1.18),
      ('kumaverson',53,'麒ヶ島宗麟',['任せておけ。','せいっ！','ぬうっ。','ここまでか……。'],1.12),
      ('babayaga',11,'玄野武宏',['行くぞ。','はっ。','ぐっ。','まだ……。'],1.2)]
red_panther=[
    ('red-panther-knife',['仕留める！','ぐっ！','ぐああっ……。'],1.19,.015),
    ('red-panther-shield',['押し切る！','くそっ！','うあっ……。'],1.07,-.035),
    ('red-panther-smg',['そこだ！','くっ！','ぐあっ……。'],1.2,0),
    ('red-panther-commander',['排除しろ！','ちっ！','ここまでか……。'],1.13,-.015),
]
rows=[]
def render(kind,style,name,lines,speed,events,pitch=0):
    for event,text in zip(events,lines):
        q=synth.create_audio_query(text,style);q.speed_scale=speed;q.intonation_scale=1.0
        q.pitch_scale=pitch
        q.pre_phoneme_length=.015;q.post_phoneme_length=.035;q.output_sampling_rate=48000;q.output_stereo=False
        data=synth.synthesis(q,style);file=OUT/f'voice-{kind}-{event}.wav';file.write_bytes(data)
        query=dataclasses.asdict(q);(OUT/f'voice-{kind}-{event}.json').write_text(json.dumps(query,ensure_ascii=False,indent=2),encoding='utf-8',newline='\n')
        rows.append(dict(kind=kind,event=event,text=text,styleId=style,credit='VOICEVOX:'+name,source=str(file.relative_to(ROOT)).replace('\\','/'),sha256=hashlib.sha256(data).hexdigest(),synthetic=True))
        print(kind,event,flush=True)
if not args.only_red_panther:
    for kind,style,name,lines,speed in cast:
        render(kind,style,name,lines,speed,['deploy','attack','hurt','death'])
for kind,lines,speed,pitch in red_panther:
    render(kind,52,'雀松朱司',lines,speed,['attack','hurt','death'],pitch)
if args.only_red_panther:
    previous=json.loads((OUT/'voices.json').read_text(encoding='utf-8'))
    rows=[r for r in previous['cast'] if r['kind'] not in {r[0] for r in red_panther}]+rows
(OUT/'voices.json').write_text(json.dumps(dict(engine='VOICEVOX Core 0.17.0',cast=rows,licenses=['https://www.virvoxproject.com/voicevoxの利用規約','https://frontier.creatia.cc/fanclubs/413/posts/4507'],note='Dedicated new utterances for each named character and each RED PANTHER role; no reused character recording or story full reading.'),ensure_ascii=False,indent=2),encoding='utf-8',newline='\n')
