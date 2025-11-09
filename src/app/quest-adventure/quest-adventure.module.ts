import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';

// Componentes
import { QuestAdventureComponent } from './quest-adventure.component';
import { QuestCanvasComponent } from './components/quest-canvas/quest-canvas.component';
import { QuestChatModalComponent } from './components/quest-chat-modal/quest-chat-modal.component';
import { QuestTrackerComponent } from './components/quest-tracker/quest-tracker.component';

// Serviços
import { QuestStateService } from './services/quest-state.service';
import { NpcManagerService } from './services/npc-manager.service';
import { DialogueService } from './services/dialogue.service';
import { PlayerMovementService } from './services/player-movement.service';

// Rotas do módulo
const routes: Routes = [
  {
    path: '',
    component: QuestAdventureComponent
  }
];

@NgModule({
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    // Importar componentes standalone diretamente
    QuestAdventureComponent,
    QuestCanvasComponent,
    QuestChatModalComponent,
    QuestTrackerComponent
  ],
  providers: [
    QuestStateService,
    NpcManagerService,
    DialogueService,
    PlayerMovementService
  ]
})
export class QuestAdventureModule { }