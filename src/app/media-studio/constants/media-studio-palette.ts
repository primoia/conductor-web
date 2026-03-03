import { AgentColor, EngineColorEntry, PaletteColor } from '../models/media-studio.models';

export const P: Record<string, PaletteColor> = {
  idle:     { r: 0,   g: 180, b: 220, hex: '#00b4dc' },
  listen:   { r: 0,   g: 212, b: 255, hex: '#00d4ff' },
  vosk:     { r: 68,  g: 138, b: 255, hex: '#448aff' },
  whisper:  { r: 206, g: 96,  b: 240, hex: '#ce60f0' },
  rec:      { r: 255, g: 64,  b: 96,  hex: '#ff4060' },
  green:    { r: 0,   g: 232, b: 123, hex: '#00e87b' },
  speaking:  { r: 255, g: 179, b: 71,  hex: '#ffb347' },
  thinking:  { r: 206, g: 96,  b: 240, hex: '#ce60f0' },
};

const EXTRA_COLORS: { r: number; g: number; b: number; css: string; cssDim: string; cssBg: string }[] = [
  { r: 0,   g: 230, b: 118, css: '#00e676', cssDim: '#00e67640', cssBg: '#00e67608' },
  { r: 255, g: 171, b: 0,   css: '#ffab00', cssDim: '#ffab0040', cssBg: '#ffab0008' },
  { r: 255, g: 82,  b: 82,  css: '#ff5252', cssDim: '#ff525240', cssBg: '#ff525208' },
  { r: 0,   g: 229, b: 255, css: '#00e5ff', cssDim: '#00e5ff40', cssBg: '#00e5ff08' },
];

const ENGINE_COLORS: Record<string, EngineColorEntry> = {
  vosk:    { pal: P['vosk'],    css: '#448aff', cssDim: '#448aff40', cssBg: '#448aff08' },
  whisper: { pal: P['whisper'], css: '#ce60f0', cssDim: '#ce60f040', cssBg: '#ce60f008' },
};

let extraIdx = 0;

export function getEngineColor(engine: string): EngineColorEntry {
  if (ENGINE_COLORS[engine]) return ENGINE_COLORS[engine];
  const c = EXTRA_COLORS[extraIdx % EXTRA_COLORS.length];
  extraIdx++;
  ENGINE_COLORS[engine] = {
    pal: { r: c.r, g: c.g, b: c.b, hex: c.css },
    css: c.css,
    cssDim: c.cssDim,
    cssBg: c.cssBg,
  };
  return ENGINE_COLORS[engine];
}

export function palRgba(p: PaletteColor, a: number): string {
  return `rgba(${p.r},${p.g},${p.b},${a})`;
}

export function lerpPal(a: PaletteColor, b: PaletteColor, t: number): PaletteColor {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
    hex: b.hex,
  };
}

export const AGENT_COLORS: AgentColor[] = [
  { color: '#00e5ff', dim: '#00e5ff55', glow: 'rgba(0,229,255,0.35)' },
  { color: '#ce60f0', dim: '#ce60f055', glow: 'rgba(206,96,240,0.35)' },
  { color: '#00e676', dim: '#00e67655', glow: 'rgba(0,230,118,0.35)' },
  { color: '#ffab00', dim: '#ffab0055', glow: 'rgba(255,171,0,0.35)' },
  { color: '#ff5277', dim: '#ff527755', glow: 'rgba(255,82,119,0.35)' },
  { color: '#448aff', dim: '#448aff55', glow: 'rgba(68,138,255,0.35)' },
  { color: '#ff6e40', dim: '#ff6e4055', glow: 'rgba(255,110,64,0.35)' },
  { color: '#76ff03', dim: '#76ff0355', glow: 'rgba(118,255,3,0.35)' },
  { color: '#e040fb', dim: '#e040fb55', glow: 'rgba(224,64,251,0.35)' },
  { color: '#18ffff', dim: '#18ffff55', glow: 'rgba(24,255,255,0.35)' },
];
