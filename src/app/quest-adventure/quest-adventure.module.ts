import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule, Routes } from '@angular/router';

// Componentes
import { QuestAdventureComponent } from './quest-adventure.component';
import { QuestCanvasComponent } from './components/quest-canvas/quest-canvas.component';
import { QuestChatModalComponent } from './components/quest-chat-modal/quest-chat-modal.component';
import { QuestTrackerComponent } from './components/quest-tracker/quest-tracker.component';
import { InventoryPanelComponent } from './components/inventory-panel/inventory-panel.component';

// Serviços
import { QuestStateService } from './services/quest-state.service';
import { NpcManagerService } from './services/npc-manager.service';
import { DialogueService } from './services/dialogue.service';
import { PlayerMovementService } from './services/player-movement.service';
import { InventoryService } from './services/inventory.service';
import { InventoryQuestIntegrationService } from './services/inventory-quest-integration.service';

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
    HttpClientModule,
    RouterModule.forChild(routes),
    // Importar componentes standalone diretamente
    QuestAdventureComponent,
    QuestCanvasComponent,
    QuestChatModalComponent,
    QuestTrackerComponent,
    InventoryPanelComponent
  ],
  providers: [
    QuestStateService,
    NpcManagerService,
    DialogueService,
    PlayerMovementService,
    InventoryService,
    InventoryQuestIntegrationService
  ]
})
export class QuestAdventureModule { }