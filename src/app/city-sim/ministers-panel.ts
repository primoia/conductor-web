import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

type MinisterAlert = {
  emoji: string;
  minister: string;
  name: string; // Gamified minister name
  title: string;
  detail: string;
  severity: 'low' | 'medium' | 'high';
  hint?: string;
};

@Component({
  selector: 'app-ministers-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ministers-panel.html',
  styleUrls: ['./ministers-panel.scss']
})
export class MinistersPanel {
  cityHealth = 0.72;

  alerts: MinisterAlert[] = [
    {
      emoji: '🏗️',
      minister: 'Arquitetura',
      name: 'Arq. Helena Ramos',
      title: 'Arquivo muito grande',
      detail: 'agent-game.component.ts ultrapassou 1.200 linhas. Recomendo dividir em view, state e services.',
      severity: 'high',
      hint: 'Reduza complexidade e acoplamento, facilite testes.'
    },
    {
      emoji: '🧪',
      minister: 'Qualidade',
      name: 'Dr. Paulo Testa',
      title: 'Cobertura em queda',
      detail: 'Módulo living-screenplay-simple caiu de 72% para 64% esta semana.',
      severity: 'medium',
      hint: '2 testes focais recuperam ~5%.'
    },
    {
      emoji: '⚡',
      minister: 'Performance',
      name: 'Eng. Rita Hertz',
      title: 'p95 piorou 18%',
      detail: 'Carregamento do screenplay tem render extra na lista de agentes.',
      severity: 'medium'
    },
    {
      emoji: '🔒',
      minister: 'Segurança',
      name: 'Cap. Ícaro Shield',
      title: 'Dependência com CVE',
      detail: 'Atualizar pacote X para versão segura, sem quebra conhecida.',
      severity: 'low'
    }
  ];

  getHealthLabel(health: number): string {
    if (health >= 0.85) return 'Excelente';
    if (health >= 0.7) return 'Saudável';
    if (health >= 0.5) return 'Atenção';
    return 'Crítico';
  }

  // Modal state
  showModal = false;
  selected: MinisterAlert | null = null;

  openAlert(alert: MinisterAlert): void {
    this.selected = alert;
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selected = null;
  }

  act(action: 'fix' | 'simulate' | 'snooze'): void {
    // Placeholder for future actions; closes modal for now
    console.log(`[MinistersPanel] action=${action}`, this.selected);
    this.closeModal();
  }
}
