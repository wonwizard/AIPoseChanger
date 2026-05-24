// 17 COCO keypoint indices (matches MediaPipe BLAZEPOSE_TO_COCO mapping)
// 0:nose 1:l_eye 2:r_eye 3:l_ear 4:r_ear
// 5:l_shoulder 6:r_shoulder 7:l_elbow 8:r_elbow 9:l_wrist 10:r_wrist
// 11:l_hip 12:r_hip 13:l_knee 14:r_knee 15:l_ankle 16:r_ankle

const POSE_CONNECTIONS = [
  [0, 1], [0, 2],         // nose → eyes
  [1, 3], [2, 4],         // eyes → ears
  [5, 6],                 // shoulder bar
  [5, 7], [7, 9],         // left arm
  [6, 8], [8, 10],        // right arm
  [5, 11], [6, 12],       // torso sides
  [11, 12],               // hip bar
  [11, 13], [13, 15],     // left leg
  [12, 14], [14, 16],     // right leg
];

const NORMALIZED_INITIAL_POSE = [
  { x: 0.50, y: 0.10 }, // 0 nose
  { x: 0.47, y: 0.09 }, // 1 left_eye
  { x: 0.53, y: 0.09 }, // 2 right_eye
  { x: 0.44, y: 0.10 }, // 3 left_ear
  { x: 0.56, y: 0.10 }, // 4 right_ear
  { x: 0.38, y: 0.25 }, // 5 left_shoulder
  { x: 0.62, y: 0.25 }, // 6 right_shoulder
  { x: 0.30, y: 0.42 }, // 7 left_elbow
  { x: 0.70, y: 0.42 }, // 8 right_elbow
  { x: 0.25, y: 0.57 }, // 9 left_wrist
  { x: 0.75, y: 0.57 }, // 10 right_wrist
  { x: 0.43, y: 0.56 }, // 11 left_hip
  { x: 0.57, y: 0.56 }, // 12 right_hip
  { x: 0.43, y: 0.72 }, // 13 left_knee
  { x: 0.57, y: 0.72 }, // 14 right_knee
  { x: 0.43, y: 0.90 }, // 15 left_ankle
  { x: 0.57, y: 0.90 }, // 16 right_ankle
];

const POINT_RADIUS = 7;
const HIT_RADIUS   = 18;

class SkeletonEditor {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');

    // Keypoints stored in image-normalized space [0,1]
    this.keypoints = NORMALIZED_INITIAL_POSE.map(kp => ({ ...kp }));
    this.bgImage   = null;

    // Where the background image is drawn on the canvas (letterbox rect)
    // Defaults to full canvas so the initial skeleton spans the whole area
    this.imageRect = { x: 0, y: 0, w: canvas.width, h: canvas.height };

    this.dragging  = null;

    canvas.addEventListener('mousedown',  e => this._onDown(this._pos(e)));
    canvas.addEventListener('mousemove',  e => this._onMove(this._pos(e)));
    canvas.addEventListener('mouseup',    () => this._onUp());
    canvas.addEventListener('mouseleave', () => this._onUp());

    canvas.addEventListener('touchstart', e => { e.preventDefault(); this._onDown(this._pos(e.touches[0])); }, { passive: false });
    canvas.addEventListener('touchmove',  e => { e.preventDefault(); this._onMove(this._pos(e.touches[0])); }, { passive: false });
    canvas.addEventListener('touchend',   () => this._onUp());

    this.render();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  setBackground(dataURL) {
    const img = new Image();
    img.onload = () => {
      this.bgImage = img;
      this._updateImageRect();
      this.render();
    };
    img.src = dataURL;
  }

  setKeypoints(kpList) {
    // kpList from MediaPipe is already in image-normalized [0,1] space
    this.keypoints = kpList.map(kp => ({ x: kp.x, y: kp.y }));
    this.render();
  }

  // Returns a skeleton-only PNG sized to the image's natural aspect ratio
  getSkeletonImageDataURL() {
    const off = document.createElement('canvas');

    if (this.bgImage) {
      const nat = this.bgImage.naturalWidth / this.bgImage.naturalHeight;
      if (nat >= 1) { off.width = 512; off.height = Math.round(512 / nat); }
      else          { off.height = 512; off.width = Math.round(512 * nat); }
    } else {
      off.width = off.height = 512;
    }

    const ctx = off.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, off.width, off.height);

    // Skeleton fills the full offscreen canvas (no letterboxing needed)
    const toSkel = kp => ({ x: kp.x * off.width, y: kp.y * off.height });
    this._drawSkeleton(ctx, toSkel, 6, '#ffffff', 3, '#818cf8');

    return off.toDataURL('image/png');
  }

  render() {
    const { ctx, canvas } = this;
    const { width: cw, height: ch } = canvas;

    ctx.clearRect(0, 0, cw, ch);

    // Dark background fills the whole canvas (shows in letterbox bars)
    ctx.fillStyle = '#1a1f35';
    ctx.fillRect(0, 0, cw, ch);

    if (this.bgImage) {
      const { x, y, w, h } = this.imageRect;
      ctx.drawImage(this.bgImage, x, y, w, h);
      // Semi-transparent overlay only over the image area
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.fillRect(x, y, w, h);
    }

    this._drawSkeleton(
      ctx,
      kp => this._toCanvas(kp),
      POINT_RADIUS,
      'rgba(255,255,255,0.85)', 2, '#818cf8'
    );
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  _updateImageRect() {
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const ir = this.bgImage.naturalWidth / this.bgImage.naturalHeight;
    const cr = cw / ch;
    let w, h;
    if (ir > cr) { w = cw;   h = cw / ir; }
    else         { h = ch;   w = ch * ir; }
    this.imageRect = { x: (cw - w) / 2, y: (ch - h) / 2, w, h };
  }

  // image-normalized [0,1] → canvas pixel coords
  _toCanvas(kp) {
    const { x, y, w, h } = this.imageRect;
    return { x: x + kp.x * w, y: y + kp.y * h };
  }

  // canvas pixel coords → image-normalized [0,1], clamped
  _toImage(cx, cy) {
    const { x, y, w, h } = this.imageRect;
    return {
      x: Math.max(0, Math.min(1, (cx - x) / w)),
      y: Math.max(0, Math.min(1, (cy - y) / h)),
    };
  }

  _drawSkeleton(ctx, toCanvas, dotRadius, lineColor, lineWidth, dotColor) {
    ctx.strokeStyle = lineColor;
    ctx.lineWidth   = lineWidth;
    for (const [a, b] of POSE_CONNECTIONS) {
      const pa = toCanvas(this.keypoints[a]);
      const pb = toCanvas(this.keypoints[b]);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }
    for (const kp of this.keypoints) {
      const p = toCanvas(kp);
      ctx.beginPath();
      ctx.arc(p.x, p.y, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = dotColor;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    }
  }

  _pos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (this.canvas.width  / rect.width),
      y: (e.clientY - rect.top)  * (this.canvas.height / rect.height),
    };
  }

  _nearest(x, y) {
    let best = -1, bestD = Infinity;
    for (let i = 0; i < this.keypoints.length; i++) {
      const p = this._toCanvas(this.keypoints[i]);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) { bestD = d; best = i; }
    }
    return bestD <= HIT_RADIUS ? best : -1;
  }

  _onDown({ x, y }) {
    const idx = this._nearest(x, y);
    if (idx >= 0) { this.dragging = idx; this.canvas.style.cursor = 'grabbing'; }
  }

  _onMove({ x, y }) {
    if (this.dragging === null) {
      this.canvas.style.cursor = this._nearest(x, y) >= 0 ? 'grab' : 'default';
      return;
    }
    const norm = this._toImage(x, y);
    this.keypoints[this.dragging].x = norm.x;
    this.keypoints[this.dragging].y = norm.y;
    this.render();
  }

  _onUp() {
    this.dragging = null;
    this.canvas.style.cursor = 'default';
  }
}
