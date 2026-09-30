"""One explicit stage per invocation, no automatic generation retries."""
from pathlib import Path
import json,time,hashlib,shutil,sys
from gradio_client import Client,handle_file
from huggingface_hub import get_token,HfApi
R=Path(__file__).resolve().parents[1];name,stage=sys.argv[1:3];out=R/'props'/name;out.mkdir(parents=True,exist_ok=True)
specs={
'bull-skull':'A real ancient bull skull wall trophy with two long curved horns rooted firmly at the lateral brow above the eye sockets. Horns sweep outward and up, naturally symmetrical. Long bovine nasal bone, two clear eye sockets, no lower jaw. Weathered ivory bone with fine pores and dark crevices, muted dark horn tips. No wood plaque, no ropes, no background wall. Entire horn tips visible.',
'gate':'A complete freestanding ancient Roman cellar portcullis gate within a thick grey-brown limestone semicircular arch frame. The stone arch and its two side piers are part of this one object. Nine slender rust-black iron vertical bars and three crossbars. Clear see-through gaps between every bar. Opening width 2.2m, overall height 2.7m, frame width about 2.8m. Flat base, no floor slab, no wall extending sideways. No door handles or ornament.',
'weapon-rack':'An EMPTY wall-mounted ancient weapon rack made of two weathered dark oak upright posts and two horizontal rails, six stout short pegs and a narrow top shelf. Wide low rectangle 4.5m wide and 2.5m high, shallow 0.34m depth. Rough genuine wood grain, iron nails, functional joinery. Absolutely no weapons, no shield, no helmet, no hanging objects. Clear open space between rails.',
'chest-banded':'One closed ancient rough oak storage chest with a flat lid, two dark rusted iron bands and a simple iron hasp. Low rectangular wooden box 0.75m wide, 0.60m deep, 0.50m tall. Aged wood grain, worn corners, no carving or ornament. Single chest, no objects on top.',
'chest-plain':'One closed plain ancient rough wooden storage chest with a flat lid, wooden plank construction and small dark hinge pins, no metal bands. Low rectangle 0.75m wide, 0.60m deep, 0.50m tall. Worn brown oak grain and visible joinery, no carving or decoration. Single chest, no objects on top.',
'table':'One small rough ancient oak table with a rectangular plank top, four straight stout legs, simple low stretchers and pegged joints. 0.95m wide, 0.70m deep, 0.75m high. Clear open negative space beneath tabletop and between legs, worn edges, authentic matte wood grain. Empty tabletop, no objects.',
'torch-sconce':'One ancient wall torch sconce with a small vertical rust-black iron mounting plate, short projecting curved bracket, and an open iron basket holding an unlit charred wooden torch. 0.45m tall and 0.22m deep. Functional hammered iron, aged dull rust, no fantasy ornament. No flame, smoke, sparks or glow. No wall or plaque.'}
seed=30093010+list(specs).index(name)
if stage=='design':
 space='black-forest-labs/FLUX.1-dev';prompt='Photorealistic game asset design, grounded ancient arena cellar. '+specs[name]+' Single isolated object, entire silhouette visible with generous margins, neutral light-grey seamless studio background, three-quarter front view, soft even studio lighting. Warm brown wood, grey-brown stone, soot black iron where appropriate. No text, logo, runes, heraldry, glow or additional props.'
 args=dict(prompt=prompt,seed=seed,randomize_seed=False,width=1024,height=1024,guidance_scale=3.5,num_inference_steps=28)
else:
 space='black-forest-labs/FLUX.1-Kontext-Dev';prompt='Preserve the exact object identity, shape, material and all its parts. Show this single object as a clean product photograph for 3D reconstruction on a uniform neutral light grey background. Keep all extremities in frame with margin, soft even lighting, no cast floor shadow, no floor plane, no additional objects. '+specs[name]
 if stage=='repair':prompt='Remove the entire wooden backing plaque, every nail and both ropes. Keep ONLY the real bone bull skull and its two attached horns. Replace the removed plaque and ropes with the same uniform light grey background. Preserve the exact skull and horn silhouette. The horns grow directly from the skull brow, with natural bone horn roots exposed. Matte aged ivory bone, matte brown-black horns; remove glossy coloured reflections. No other objects, no shadows on backdrop.'
 args=dict(input_image=handle_file(str(out/'design.png')),prompt=prompt,seed=seed,randomize_seed=False,guidance_scale=2.5,steps=28)
if name=='gate' and stage=='product':
 prompt='Keep this stone arch frame and iron portcullis gate. Remove the entire stone floor slab and all paving between and in front of the two piers. Both piers end at the same level, and the bars stop at that level. Show only the arch with piers and see-through iron bars on a uniform neutral light grey background. Soft diffuse studio lighting, no ground plane or backdrop shadow, no added objects. Preserve worn grey-brown stone and matte rust-black iron.'
 args['prompt']=prompt
if name=='weapon-rack' and stage=='product':
 prompt='Remove every sword, blade, hilt and weapon from this wooden rack. Leave an EMPTY wooden frame with its two posts, horizontal rails and shelf only. Add six short blunt wooden hanging pegs to the rails. Uniform pale grey background. Preserve the worn wood.'
 args['prompt']=prompt
if name=='chest-plain' and stage=='product':
 prompt='Remove the large metal corner brackets and metal straps from this chest. Replace them with plain worn wooden pegged joints. Keep only a small simple latch and hinge pins. Preserve the rectangular wooden chest, closed flat lid and brown plank grain. Single isolated plain wooden chest on a uniform neutral grey studio background.'
 args['prompt']=prompt
if name=='torch-sconce' and stage=='product':
 prompt='Extinguish and remove the flame completely. Remove the large rectangular wall panel and stone surround. Leave only the small iron torch bracket, its small mounting plate and an UNLIT charred wooden torch. Plain functional hammered iron, no ornament. Isolated single object on uniform pale grey background.'
 args['prompt']=prompt
if name=='torch-sconce' and stage=='plain':
 args['input_image']=handle_file(str(out/'product.png'))
 prompt='Replace the elaborate ornamental metal holder with a SIMPLE plain black iron wall bracket: a small rectangular mounting plate, one bent square iron arm projecting forward, and a plain iron cup holding the same unlit charred wooden torch. Remove the hanging finial, the decorative bowl, carved rings, scrollwork and every ornament. Functional Roman cellar hardware, weathered matte rust-black iron. Single isolated object on uniform light grey background. No flame.'
 args['prompt']=prompt
if stage=='repair2':
 args['input_image']=handle_file(str(out/'repair.png'))
 prompt='Erase both coils of rope wrapped around the left and right horn roots. Replace those rope coils with natural smooth horn and bone connections. Keep everything else about the skull and horns unchanged. Make the background uniform pale grey with no shadow.'
 args['prompt']=prompt
if name=='torch-sconce' and stage=='simple-design':
 space='black-forest-labs/FLUX.1-dev'
 prompt='Studio product photo of a single very simple ancient iron wall-mounted torch holder. A small flat rectangular iron plate with two round bolt holes, a short right-angle iron arm attached to its centre, and one small cylindrical empty iron cup welded at the outer end. The cup is open at the top. These three parts form one connected object. Rough hammered matte dark rusty iron, utilitarian cellar hardware. Three-quarter view, uniform pale grey background, soft even illumination. Entire small object visible. Plain smooth shapes. No torch, no flame, no candle, no ornament, no decoration, no finial, no text.'
 args=dict(prompt=prompt,seed=seed,randomize_seed=False,width=1024,height=1024,guidance_scale=3.5,num_inference_steps=28)
if name=='torch-sconce' and stage=='simple-product':
 args['input_image']=handle_file(str(out/'simple-design.png'))
 prompt='Preserve this exact simple iron wall bracket and cup as one connected object. Neutral pale grey studio background, soft diffuse lighting, no cast shadow. Keep the empty open cup, short arm and flat wall plate. All plain matte weathered iron. No additions, no ornament, no flame.'
 args['prompt']=prompt
t=time.time();client=Client(space,token=get_token(),verbose=False)
try:
 result=client.predict(**args,api_name='/infer');p=result[0] if isinstance(result,(tuple,list)) else result;p=p['path'] if isinstance(p,dict) else p;shutil.copyfile(p,out/(stage+'.png'))
 record={'space':space,'revision':HfApi().space_info(space).sha,'seed':seed,'prompt':prompt,'seconds':round(time.time()-t,2),'sha256':hashlib.sha256((out/(stage+'.png')).read_bytes()).hexdigest(),'attempts':1}
 (out/(stage+'.json')).write_text(json.dumps(record,indent=2));print(json.dumps(record))
except Exception as e:
 (out/(stage+'-failure.txt')).write_text(type(e).__name__+': '+str(e));print(type(e).__name__,str(e)[:400]);sys.exit(1)
