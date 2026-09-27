# Gradio endpoint: upload a GLB, get front/back stills + a receipt (wall seconds). One render at a time (queue concurrency 1), no retries.
import json, os, subprocess, tempfile, time
import gradio as gr

def render(glb, views, width, height, samples, yaw_deg, pitch_deg, fill):
    t0 = time.time(); out = tempfile.mkdtemp(prefix='fk-')
    cmd = ['blender', '-b', '-noaudio', '--python', 'render.py', '--', '--glb', glb, '--out', out, '--views', views, '--size', f'{int(width)}x{int(height)}',
           '--samples', str(int(samples)), '--yaw', str(yaw_deg), '--pitch', str(pitch_deg), '--fill', str(fill)]
    p = subprocess.run(cmd, capture_output=True, text=True, timeout=1500)
    pngs = sorted(os.path.join(out, f) for f in os.listdir(out) if f.endswith('.png'))
    receipt = {'wall_s': round(time.time() - t0, 1), 'views': views, 'size': f'{int(width)}x{int(height)}', 'samples': int(samples), 'returncode': p.returncode,
               'blender_tail': p.stdout[-1500:] + p.stderr[-800:], 'cpu': os.cpu_count()}
    return pngs, json.dumps(receipt)

demo = gr.Interface(render, [gr.File(label='GLB', type='filepath'), gr.Textbox('front,back', label='views'), gr.Number(420, label='width'), gr.Number(720, label='height'),
                             gr.Number(24, label='samples'), gr.Number(20, label='yaw deg'), gr.Number(12, label='pitch deg'), gr.Number(0.9, label='fill')],
                    [gr.Gallery(label='stills'), gr.Textbox(label='receipt')], title='Frankendom Blender', flagging_mode='never')
demo.queue(default_concurrency_limit=1, max_size=4).launch(server_name='0.0.0.0', server_port=7860)
