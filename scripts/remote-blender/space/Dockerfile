# Frankendom remote Blender (Armour, 2026-09-27): Blender 4.2 as the official `bpy` PyPI module (Cycles CPU, glTF importer bundled) + a Gradio
# endpoint that renders a GLB to stills. Space: sdk docker, port 7860, hardware cpu-upgrade (8 vCPU, ~$0.03/h), sleep-on-idle 15 min; never GPU.
# (The download.blender.org tarball came back as a non-xz body inside the HF builder, so the wheel is used instead.)
FROM python:3.11-slim
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends libxi6 libxxf86vm1 libxfixes3 libxrender1 libgl1 libxkbcommon0 libsm6 libice6 libegl1 libgomp1 \
 && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir bpy==4.2.0 "gradio>=5,<6" pillow
RUN useradd -m -u 1000 user
USER user
WORKDIR /home/user/app
COPY --chown=user app.py render.py ./
EXPOSE 7860
CMD ["python", "app.py"]
