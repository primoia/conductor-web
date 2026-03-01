import {
  Component, ElementRef, ViewChild,
  AfterViewInit, OnDestroy, NgZone,
} from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { PaletteColor } from '../../models/media-studio.models';
import { P, palRgba, lerpPal } from '../../constants/media-studio-palette';
import { MediaStudioWebSocketService } from '../../services/media-studio-websocket.service';

@Component({
  selector: 'app-visualizer-canvas',
  standalone: true,
  template: `<canvas #cvs></canvas>`,
  styleUrls: ['./visualizer-canvas.component.scss'],
})
export class VisualizerCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('cvs') canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private rafId = 0;
  private W = 0;
  private H = 0;
  private cx = 0;
  private cy = 0;
  private scale = 1;
  private time = 0;
  private curPal: PaletteColor = { ...P['idle'] };
  private tgtPal: PaletteColor = { ...P['idle'] };
  private animState: 'idle' | 'connecting' | 'listening' | 'recording' | 'speaking' = 'idle';
  private expandScale = 1.0;
  private destroy$ = new Subject<void>();
  private resizeHandler = () => this.resize();

  constructor(
    private zone: NgZone,
    private wsSvc: MediaStudioWebSocketService,
  ) {}

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', this.resizeHandler);

    this.wsSvc.tgtPal$.pipe(takeUntil(this.destroy$)).subscribe((p) => (this.tgtPal = p));
    this.wsSvc.animState$.pipe(takeUntil(this.destroy$)).subscribe((s) => (this.animState = s));

    this.zone.runOutsideAngular(() => {
      this.animate();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.resizeHandler);
  }

  private resize(): void {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    this.W = canvas.width = Math.round(rect.width);
    this.H = canvas.height = Math.round(rect.height);
    this.cx = this.W / 2;
    this.cy = this.H / 2;
    this.scale = Math.min(this.W, this.H) / 1200;
  }

  private animate = (): void => {
    this.time += 0.016;
    this.curPal = lerpPal(this.curPal, this.tgtPal, 0.06);
    const tgtExpand = this.animState === 'recording' ? 1.15 : this.animState === 'speaking' ? 1.08 : 1.0;
    this.expandScale += (tgtExpand - this.expandScale) * 0.06;
    this.wsSvc.updateAudioData();
    this.drawScene(this.time);
    this.rafId = requestAnimationFrame(this.animate);
  };

  // ─── MAIN DRAW ───
  private drawScene(t: number): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    this.drawBackground(t);

    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.scale(this.expandScale, this.expandScale);

    const s = this.scale;
    const lvl = this.wsSvc.smoothLevel;
    const active = this.animState === 'listening' || this.animState === 'recording' || this.animState === 'speaking';
    const rec = this.animState === 'recording';

    this.drawEnergyField(s, lvl, t, active, rec);
    this.drawHelmet(s, lvl, t, active, rec);
    this.drawVisor(s, lvl, t, active, rec);
    this.drawCore(s, lvl, t, active, rec);
    this.drawSidePanels(s, lvl, t, active);
    this.drawCrest(s, lvl, t, active, rec);

    ctx.restore();
  }

  // ─── BACKGROUND ───
  private drawBackground(t: number): void {
    const ctx = this.ctx;
    const p = this.curPal;

    const bg = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, Math.max(this.W, this.H) * 0.8);
    bg.addColorStop(0, `rgba(${Math.round(p.r * 0.06 + 10)},${Math.round(p.g * 0.06 + 15)},${Math.round(p.b * 0.08 + 26)},1)`);
    bg.addColorStop(1, '#0a0f1a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.W, this.H);

    const s = this.wsSvc.smoothLevel;
    const alpha = 0.04 + s * 0.025;
    ctx.strokeStyle = palRgba(p, alpha);
    ctx.lineWidth = 0.5;
    const hexR = 40 * this.scale;
    const cols = Math.ceil(this.W / (hexR * 1.75)) + 2;
    const rows = Math.ceil(this.H / (hexR * 1.55)) + 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const hx = c * hexR * 1.75 + (r % 2) * hexR * 0.875;
        const hy = r * hexR * 1.55;
        const dist = Math.hypot(hx - this.cx, hy - this.cy) / Math.max(this.W, this.H);
        if (dist > 0.55) continue;
        const a = alpha * (1 - dist * 1.8);
        if (a <= 0) continue;
        ctx.globalAlpha = a;
        this.drawHex(hx, hy, hexR * 0.48);
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawHex(x: number, y: number, r: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 3) * i - Math.PI / 6;
      const px = x + Math.cos(ang) * r;
      const py = y + Math.sin(ang) * r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // ─── ENERGY FIELD ───
  private drawEnergyField(s: number, lvl: number, t: number, active: boolean, rec: boolean): void {
    if (!active) return;
    const ctx = this.ctx;
    const p = this.curPal;

    for (let i = 0; i < 3; i++) {
      const r = (180 + i * 40) * s + lvl * 30 * s;
      const expand = Math.sin(t * 2 + i * 1.5) * 5 * s;
      const alpha = 0.04 + lvl * 0.06 - i * 0.015;
      if (alpha <= 0) continue;
      ctx.strokeStyle = palRgba(p, alpha);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let j = 0; j < 8; j++) {
        const ang = (Math.PI / 4) * j - Math.PI / 8 + t * 0.15 * (i % 2 ? 1 : -1);
        const rr = r + expand + Math.sin(t * 3 + j) * 3 * s;
        const px = Math.cos(ang) * rr;
        const py = Math.sin(ang) * rr;
        j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }

    if (rec) {
      const count = 12;
      for (let i = 0; i < count; i++) {
        const phase = t * 1.5 + i * 0.52;
        const life = (phase % 2) / 2;
        const angle = (i / count) * Math.PI * 2 + t * 0.3;
        const dist = (120 + life * 100) * s;
        const px = Math.cos(angle) * dist;
        const py = Math.sin(angle) * dist - life * 80 * s;
        const alpha = (1 - life) * 0.4;
        const sz = (1 - life) * 3 * s;
        ctx.fillStyle = palRgba(p, alpha);
        ctx.beginPath();
        ctx.arc(px, py, sz, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ─── HELMET SHELL ───
  private drawHelmet(s: number, lvl: number, t: number, active: boolean, rec: boolean): void {
    const ctx = this.ctx;
    const p = this.curPal;
    const w = 150 * s;
    const h = 190 * s;
    const bevel = 35 * s;
    const breathe = Math.sin(t * 0.8) * 2 * s;

    ctx.beginPath();
    ctx.moveTo(0, -h - breathe);
    ctx.lineTo(w + bevel, -h * 0.45);
    ctx.lineTo(w, h * 0.35 + breathe);
    ctx.lineTo(w * 0.4, h * 0.55 + breathe);
    ctx.lineTo(0, h * 0.65 + breathe);
    ctx.lineTo(-w * 0.4, h * 0.55 + breathe);
    ctx.lineTo(-w, h * 0.35 + breathe);
    ctx.lineTo(-w - bevel, -h * 0.45);
    ctx.closePath();

    const fillAlpha = 0.06 + lvl * 0.04;
    const hfill = ctx.createLinearGradient(0, -h, 0, h * 0.6);
    hfill.addColorStop(0, palRgba(p, fillAlpha * 1.5));
    hfill.addColorStop(0.5, palRgba(p, fillAlpha * 0.5));
    hfill.addColorStop(1, 'transparent');
    ctx.fillStyle = hfill;
    ctx.fill();

    ctx.strokeStyle = palRgba(p, 0.25 + lvl * 0.2);
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();

    ctx.save();
    ctx.scale(0.94, 0.95);
    ctx.beginPath();
    ctx.moveTo(0, -h - breathe);
    ctx.lineTo(w + bevel, -h * 0.45);
    ctx.lineTo(w, h * 0.35 + breathe);
    ctx.lineTo(w * 0.4, h * 0.55 + breathe);
    ctx.lineTo(0, h * 0.65 + breathe);
    ctx.lineTo(-w * 0.4, h * 0.55 + breathe);
    ctx.lineTo(-w, h * 0.35 + breathe);
    ctx.lineTo(-w - bevel, -h * 0.45);
    ctx.closePath();
    ctx.strokeStyle = palRgba(p, 0.12 + lvl * 0.1);
    ctx.lineWidth = 1 * s;
    ctx.stroke();
    ctx.restore();
  }

  // ─── VISOR BAND ───
  private drawVisor(s: number, lvl: number, t: number, active: boolean, rec: boolean): void {
    const ctx = this.ctx;
    const p = this.curPal;
    const vw = 155 * s;
    const vh = 30 * s;
    const vy = -20 * s;
    const angleSlant = 8 * s;

    ctx.beginPath();
    ctx.moveTo(-vw - angleSlant, vy - vh);
    ctx.lineTo(vw + angleSlant, vy - vh);
    ctx.lineTo(vw, vy + vh);
    ctx.lineTo(-vw, vy + vh);
    ctx.closePath();

    const vbg = ctx.createLinearGradient(-vw, vy, vw, vy);
    vbg.addColorStop(0, 'transparent');
    vbg.addColorStop(0.2, palRgba(p, 0.06 + lvl * 0.04));
    vbg.addColorStop(0.5, palRgba(p, 0.1 + lvl * 0.08));
    vbg.addColorStop(0.8, palRgba(p, 0.06 + lvl * 0.04));
    vbg.addColorStop(1, 'transparent');
    ctx.fillStyle = vbg;
    ctx.fill();

    ctx.strokeStyle = palRgba(p, 0.3 + lvl * 0.3);
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();

    ctx.shadowColor = palRgba(p, 0.3 + lvl * 0.3);
    ctx.shadowBlur = 20 + lvl * 30;
    ctx.strokeStyle = palRgba(p, 0.2 + lvl * 0.2);
    ctx.lineWidth = 1 * s;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Spectrum analyzer inside visor
    if (active) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-vw - angleSlant + 2, vy - vh + 2);
      ctx.lineTo(vw + angleSlant - 2, vy - vh + 2);
      ctx.lineTo(vw - 2, vy + vh - 2);
      ctx.lineTo(-vw + 2, vy + vh - 2);
      ctx.closePath();
      ctx.clip();

      const freqData = this.wsSvc.freqData;
      const tdData = this.wsSvc.tdData;
      const barCount = 64;
      const barW = (vw * 2) / barCount;
      const maxBarH = vh * 1.8;

      for (let i = 0; i < barCount; i++) {
        const fi = Math.floor((i / barCount) * freqData.length * 0.8);
        const val = freqData[fi] / 255;
        const barH = val * maxBarH;
        if (barH < 1) continue;

        const x = -vw + i * barW;
        const center = 1 - Math.abs(i - barCount / 2) / (barCount / 2);
        const alpha = (0.25 + val * 0.6) * (0.5 + center * 0.5);

        if (rec) {
          const ratio = val;
          if (ratio > 0.7) {
            ctx.fillStyle = `rgba(255,${Math.round(80 - ratio * 80)},${Math.round(80 - ratio * 60)},${alpha})`;
          } else if (ratio > 0.4) {
            ctx.fillStyle = `rgba(255,${Math.round(200 - ratio * 100)},40,${alpha})`;
          } else {
            ctx.fillStyle = `rgba(${Math.round(p.r * 0.5 + 100)},${Math.round(p.g * 0.8 + 60)},${Math.round(p.b * 0.3)},${alpha})`;
          }
        } else {
          ctx.fillStyle = palRgba(p, alpha);
        }

        ctx.fillRect(x, vy - barH / 2, barW - 1, barH);
      }

      // Waveform overlay
      ctx.strokeStyle = palRgba(p, 0.3 + lvl * 0.4);
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      for (let i = 0; i < tdData.length; i++) {
        const x = -vw + (i / tdData.length) * vw * 2;
        const v = (tdData[i] - 128) / 128;
        const y = vy + v * vh * 0.8;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.restore();
    }

    // Scan line (recording)
    if (rec) {
      const scanY = vy - vh + ((t * 40 * s) % (vh * 2));
      ctx.strokeStyle = palRgba(p, 0.25);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-vw, scanY);
      ctx.lineTo(vw, scanY);
      ctx.stroke();
    }
  }

  // ─── CENTRAL CORE ───
  private drawCore(s: number, lvl: number, t: number, active: boolean, rec: boolean): void {
    const ctx = this.ctx;
    const p = this.curPal;
    const coreR = (8 + lvl * 8) * s;
    const vy = -20 * s;

    const glow = ctx.createRadialGradient(0, vy, 0, 0, vy, coreR * 6);
    glow.addColorStop(0, palRgba(p, 0.15 + lvl * 0.2));
    glow.addColorStop(0.5, palRgba(p, 0.03));
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(-coreR * 6, -coreR * 6 + vy, coreR * 12, coreR * 12);

    ctx.shadowColor = palRgba(p, 0.6 + lvl * 0.4);
    ctx.shadowBlur = 20 + lvl * 40;
    ctx.fillStyle = palRgba(p, 0.8 + lvl * 0.2);
    ctx.beginPath();
    ctx.arc(0, vy, coreR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255,255,255,${0.4 + lvl * 0.5})`;
    ctx.beginPath();
    ctx.arc(0, vy, coreR * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    if (active) {
      const chR = coreR * 3;
      ctx.strokeStyle = palRgba(p, 0.12 + lvl * 0.1);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-chR, vy); ctx.lineTo(-coreR * 1.5, vy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(coreR * 1.5, vy); ctx.lineTo(chR, vy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, vy - chR); ctx.lineTo(0, vy - coreR * 1.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, vy + coreR * 1.5); ctx.lineTo(0, vy + chR); ctx.stroke();
    }
  }

  // ─── SIDE PANELS ───
  private drawSidePanels(s: number, lvl: number, t: number, active: boolean): void {
    if (!active) return;
    const ctx = this.ctx;
    const p = this.curPal;
    const freqData = this.wsSvc.freqData;
    const panelW = 6 * s;
    const panelH = 4 * s;
    const startX = 170 * s;
    const startY = -60 * s;
    const count = 8;

    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < count; i++) {
        const fi = Math.floor((i / count) * freqData.length * 0.4);
        const val = freqData[fi] / 255;
        const x = side * startX + side * (val * 20 * s);
        const y = startY + i * (panelH + 4 * s);
        const alpha = 0.1 + val * 0.4;
        ctx.fillStyle = palRgba(p, alpha);
        ctx.fillRect(x - (side > 0 ? 0 : panelW + val * 20 * s), y, panelW + val * 20 * s, panelH);
      }
    }
  }

  // ─── CREST / ANTENNAS ───
  private drawCrest(s: number, lvl: number, t: number, active: boolean, rec: boolean): void {
    const ctx = this.ctx;
    const p = this.curPal;
    const crestH = 30 * s;
    const crestW = 20 * s;
    const baseY = -190 * s - Math.sin(t * 0.8) * 2 * s;

    ctx.beginPath();
    ctx.moveTo(0, baseY - crestH);
    ctx.lineTo(crestW, baseY);
    ctx.lineTo(-crestW, baseY);
    ctx.closePath();
    ctx.fillStyle = palRgba(p, 0.12 + lvl * 0.1);
    ctx.fill();
    ctx.strokeStyle = palRgba(p, 0.25 + lvl * 0.2);
    ctx.lineWidth = 1 * s;
    ctx.stroke();

    if (rec) {
      ctx.shadowColor = palRgba(p, 0.5);
      ctx.shadowBlur = 15;
      ctx.fillStyle = palRgba(p, 0.3 + lvl * 0.3);
      ctx.beginPath();
      ctx.arc(0, baseY - crestH * 0.3, 4 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Two antennas
    for (let side = -1; side <= 1; side += 2) {
      const ax = side * 55 * s;
      const ay = baseY + 10 * s;
      const antH = 80 * s + lvl * 15 * s;
      const antTipX = ax + side * 20 * s;
      const antTipY = ay - antH;
      const sway = Math.sin(t * 1.2 + side * 0.8) * 4 * s;

      // Stem
      ctx.strokeStyle = palRgba(p, 0.18 + lvl * 0.12);
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(ax + side * 8 * s + sway, ay - antH * 0.5, antTipX + sway, antTipY);
      ctx.stroke();

      // Tip orb
      const tipR = (2.5 + lvl * 2) * s;
      const pulse = 0.5 + Math.sin(t * 3 + side * 1.5) * 0.3;
      ctx.shadowColor = palRgba(p, 0.4 * pulse);
      ctx.shadowBlur = 12 + lvl * 15;
      ctx.fillStyle = palRgba(p, 0.5 + lvl * 0.3 + pulse * 0.2);
      ctx.beginPath();
      ctx.arc(antTipX + sway, antTipY, tipR, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Outer glow ring
      ctx.strokeStyle = palRgba(p, 0.08 + lvl * 0.08 + pulse * 0.06);
      ctx.lineWidth = 1 * s;
      ctx.beginPath();
      ctx.arc(antTipX + sway, antTipY, tipR * 2.5, 0, Math.PI * 2);
      ctx.stroke();

      // Radio wave rings
      if (active) {
        for (let w = 0; w < 3; w++) {
          const speed = 1.8;
          const phase = (t * speed + w * 0.7 + side * 0.4) % 2.1;
          const life = phase / 2.1;
          if (life > 1) continue;
          const waveR = tipR * 2 + life * 35 * s;
          const alpha = (1 - life) * (0.2 + lvl * 0.15);
          ctx.strokeStyle = palRgba(p, alpha);
          ctx.lineWidth = (1.5 - life * 1) * s;
          ctx.beginPath();
          ctx.arc(antTipX + sway, antTipY, waveR, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Segment marks on stem
      for (let j = 1; j <= 3; j++) {
        const frac = j * 0.25;
        const mx = ax + (antTipX + sway - ax) * frac;
        const my = ay + (antTipY - ay) * frac;
        ctx.fillStyle = palRgba(p, 0.1 + lvl * 0.06);
        ctx.beginPath();
        ctx.arc(mx, my, 1.5 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
