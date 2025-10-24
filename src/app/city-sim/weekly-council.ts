import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-weekly-council',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './weekly-council.html',
  styleUrls: ['./weekly-council.scss']
})
export class WeeklyCouncil {
  week = 'Semana da Resiliência';
  priorities = [
    { emoji: '🏗️', title: 'Desmembrar agente monolítico', impact: 'Alto', effort: 'Baixo' },
    { emoji: '🧪', title: 'Recuperar cobertura', impact: 'Médio', effort: 'Baixo' },
    { emoji: '⚡', title: 'Reduzir p95 em 15%', impact: 'Alto', effort: 'Médio' },
  ];
}
