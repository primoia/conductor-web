import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

type MinisterAlert = {
  emoji: string;
  minister: string;
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
      title: 'Arquivo muito grande',
      detail: 'agent-game.component.ts ultrapassou 1.200 linhas. Recomendo dividir em view, state e services.',
      severity: 'high',
      hint: 'Reduza complexidade e acoplamento, facilite testes.'
    },
    {
      emoji: '🧪',
      minister: 'Qualidade',
      title: 'Cobertura em queda',
      detail: 'Módulo living-screenplay-simple caiu de 72% para 64% esta semana.',
      severity: 'medium',
      hint: '2 testes focais recuperam ~5%.'
    },
    {
      emoji: '⚡',
      minister: 'Performance',
      title: 'p95 piorou 18%',
      detail: 'Carregamento do screenplay tem render extra na lista de agentes.',
      severity: 'medium'
    },
    {
      emoji: '🔒',
      minister: 'Segurança',
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
}
