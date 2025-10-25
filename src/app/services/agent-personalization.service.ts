import { Injectable } from '@angular/core';

export interface AgentProfile {
  agentId: string;
  displayName: string; // "Maria"
  role: string;        // "Inspetora de Qualidade"
  emoji: string;       // "🔍"
}

interface StoredProfiles {
  [agentId: string]: AgentProfile;
}

const STORAGE_KEY = 'agent_profiles_v1';

@Injectable({ providedIn: 'root' })
export class AgentPersonalizationService {
  private cache: Map<string, AgentProfile> = new Map();
  private initialized = false;

  private ensureLoaded(): void {
    if (this.initialized) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredProfiles;
        for (const [id, profile] of Object.entries(parsed)) {
          this.cache.set(id, profile);
        }
      }
    } catch {
      // ignore storage errors
    }
    this.initialized = true;
  }

  private persist(): void {
    try {
      const obj: StoredProfiles = {};
      for (const [id, profile] of this.cache.entries()) obj[id] = profile;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
      // ignore
    }
  }

  getProfile(agentId: string): AgentProfile {
    this.ensureLoaded();
    const existing = this.cache.get(agentId);
    if (existing) return existing;
    const generated = this.generateDefaultProfile(agentId);
    return generated;
  }

  setProfile(agentId: string, partial: Partial<AgentProfile>): void {
    this.ensureLoaded();
    const current = this.getProfile(agentId);
    const updated: AgentProfile = {
      agentId,
      displayName: partial.displayName ?? current.displayName,
      role: partial.role ?? current.role,
      emoji: partial.emoji ?? current.emoji,
    };
    this.cache.set(agentId, updated);
    this.persist();
  }

  getAllProfiles(): AgentProfile[] {
    this.ensureLoaded();
    return Array.from(this.cache.values());
  }

  upsertMany(profiles: AgentProfile[]): void {
    this.ensureLoaded();
    for (const p of profiles) this.cache.set(p.agentId, p);
    this.persist();
  }

  private generateDefaultProfile(agentId: string): AgentProfile {
    const letter = this.pickLetterForAgent(agentId);
    const roles = [
      { role: 'Inspetora de Qualidade', emoji: '🔍' },
      { role: 'Analista', emoji: '📊' },
      { role: 'Engenheiro', emoji: '🏗️' },
      { role: 'Ministro', emoji: '🏛️' },
    ];
    const idx = Math.abs(this.hash(agentId)) % roles.length;
    const chosen = roles[idx];
    return {
      agentId,
      displayName: `Inspetor ${letter}`,
      role: chosen.role,
      emoji: chosen.emoji,
    };
  }

  private pickLetterForAgent(agentId: string): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const idx = Math.abs(this.hash(agentId)) % letters.length;
    return letters[idx];
  }

  private hash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
  }
}
