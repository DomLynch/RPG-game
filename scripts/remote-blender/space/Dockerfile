# Frankendom remote Blender (Armour, 2026-09-27): headless Blender 4.2 LTS + a Gradio endpoint that renders a GLB to stills.
# Space: sdk docker, port 7860, hardware cpu-upgrade (8 vCPU, ~$0.03/h) with sleep-on-idle 15 min; never a GPU tier.
FROM python:3.11-slim
ENV DEBIAN_FRONTEND=noninteractive BLENDER_VER=4.2.3 BLENDER_URL=https://download.blender.org/release/Blender4.2/blender-4.2.3-linux-x64.tar.xz
RUN apt-get update && apt-get install -y --no-install-recommends xz-utils curl ca-certificates libxi6 libxxf86vm1 libxfixes3 libxrender1 libgl1 libxkbcommon0 libsm6 libice6 libegl1 libgomp1 \
 && rm -rf /var/lib/apt/lists/* \
 && curl -sSL "$BLENDER_URL" -o /tmp/blender.tar.xz && mkdir -p /opt/blender && tar -xJf /tmp/blender.tar.xz -C /opt/blender --strip-components=1 && rm /tmp/blender.tar.xz
RUN pip install --no-cache-dir gradio==5.* pillow
RUN useradd -m -u 1000 user
USER user
WORKDIR /home/user/app
COPY --chown=user app.py render.py ./
ENV PATH=/opt/blender:$PATH
EXPOSE 7860
CMD ["python", "app.py"]
