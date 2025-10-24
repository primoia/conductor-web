import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-neighborhood-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './neighborhood-view.html',
  styleUrls: ['./neighborhood-view.scss']
})
export class NeighborhoodView {
  mode: 'monolith' | 'modular' = 'monolith';
  toggle() { this.mode = this.mode === 'monolith' ? 'modular' : 'monolith'; }
}
