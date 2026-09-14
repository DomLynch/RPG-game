"""Face landmarks of a frontal portrait (MediaPipe Face Mesh, 468 points) → JSON beside the image, plus a debug overlay.
Run with the face venv: ~/.venvs/face/bin/python scripts/character/landmarks.py <image.png>"""
import json
import sys

import cv2
import mediapipe as mp

path = sys.argv[1]
im = cv2.imread(path)
h, w = im.shape[:2]
with mp.solutions.face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1, refine_landmarks=True, min_detection_confidence=0.5) as mesh:
    res = mesh.process(cv2.cvtColor(im, cv2.COLOR_BGR2RGB))
if not res.multi_face_landmarks:
    sys.exit('no face found')
pts = [(lm.x * w, lm.y * h) for lm in res.multi_face_landmarks[0].landmark]
json.dump({'width': w, 'height': h, 'points': pts}, open(path.rsplit('.', 1)[0] + '.landmarks.json', 'w'))
dbg = im.copy()
for x, y in pts:
    cv2.circle(dbg, (int(x), int(y)), 1, (0, 255, 0), -1)
KEY = (33, 133, 362, 263, 1, 61, 291, 152, 10, 234, 454, 168, 105, 334, 46, 276, 55, 285, 159, 145, 386, 374, 0, 17, 13, 14, 2, 98, 327, 199)
for i in KEY:
    x, y = pts[i]; cv2.circle(dbg, (int(x), int(y)), 4, (0, 0, 255), -1); cv2.putText(dbg, str(i), (int(x) + 4, int(y)), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (255, 255, 0), 1)
cv2.imwrite(path.rsplit('.', 1)[0] + '.landmarks.png', dbg)
# Silhouette mask: the face-oval landmarks filled, pulled in so the background never bleeds, feathered.
OVAL = (10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109)
import numpy as np
mask = np.zeros((h, w), np.uint8)
cv2.fillPoly(mask, [np.array([[int(pts[i][0]), int(pts[i][1])] for i in OVAL], np.int32)], 255)
mask = cv2.erode(mask, np.ones((13, 13), np.uint8))
mask = cv2.GaussianBlur(mask, (0, 0), 8)
# The eye openings are geometry (eyeball meshes): the photo's whites must never land on the lids.
EYES = ((33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246), (362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398))
holes = np.zeros((h, w), np.uint8)
for eye in EYES:
    cv2.fillPoly(holes, [np.array([[int(pts[i][0]), int(pts[i][1])] for i in eye], np.int32)], 255)
holes = cv2.GaussianBlur(cv2.dilate(holes, np.ones((9, 9), np.uint8)), (0, 0), 3)
mask = (mask.astype(np.float32) * (1 - holes.astype(np.float32) / 255)).astype(np.uint8)
cv2.imwrite(path.rsplit('.', 1)[0] + '.mask.png', mask)
print('landmarks', len(pts), {i: [round(pts[i][0]), round(pts[i][1])] for i in KEY})
