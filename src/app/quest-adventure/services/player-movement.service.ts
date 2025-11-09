import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Position } from '../models/quest.models';

@Injectable({
  providedIn: 'root'
})
export class PlayerMovementService {
  // Estado do player
  private position: Position = { x: 512, y: 400 };
  private targetPosition: Position | null = null;
  private isMoving = false;
  private moveSpeed = 200; // pixels por segundo

  // Sprites e animação
  private currentDirection: 'up' | 'down' | 'left' | 'right' | 'idle' = 'idle';
  private animationFrame = 0;

  // Subjects
  private positionSubject = new BehaviorSubject<Position>(this.position);
  private isMovingSubject = new BehaviorSubject<boolean>(false);
  private directionSubject = new BehaviorSubject<string>('idle');

  // Public Observables
  position$ = this.positionSubject.asObservable();
  isMoving$ = this.isMovingSubject.asObservable();
  direction$ = this.directionSubject.asObservable();

  // Limites do mapa (dinâmicos)
  private MAP_BOUNDS = {
    minX: 50,
    maxX: 974,
    minY: 50,
    maxY: 718
  };

  constructor() {}

  /**
   * Atualiza os limites do mapa baseado no tamanho do canvas
   */
  updateMapBounds(canvasWidth: number, canvasHeight: number) {
    this.MAP_BOUNDS = {
      minX: 50,
      maxX: canvasWidth - 50,
      minY: 50,
      maxY: canvasHeight - 50
    };
  }

  /**
   * Obtém a posição atual do player
   */
  getCurrentPosition(): Position {
    return { ...this.position };
  }

  /**
   * Verifica se o player está em movimento
   */
  isCurrentlyMoving(): boolean {
    return this.isMoving;
  }

  /**
   * Define a posição inicial do player
   */
  setPosition(position: Position) {
    this.position = this.clampPosition(position);
    this.positionSubject.next(this.position);
  }

  /**
   * Move o player para uma posição específica
   */
  moveToPosition(target: Position) {
    if (this.isMoving) {
      this.stopMovement();
    }

    this.targetPosition = this.clampPosition(target);
    this.isMoving = true;
    this.isMovingSubject.next(true);

    this.startMovementAnimation();
  }

  /**
   * Inicia a animação de movimento
   */
  private startMovementAnimation() {
    const startPos = { ...this.position };
    const endPos = this.targetPosition!;

    // Calcula distância e duração
    const distance = this.getDistance(startPos, endPos);
    const duration = (distance / this.moveSpeed) * 1000; // em ms

    // Determina direção
    this.updateDirection(startPos, endPos);

    const startTime = performance.now();
    let animationFrameId: number;

    const animate = (currentTime: number) => {
      if (!this.isMoving) return;

      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Função de easing suave (ease-out)
      const easedProgress = this.easeOutQuad(progress);

      // Interpolação suave com easing
      this.position.x = startPos.x + (endPos.x - startPos.x) * easedProgress;
      this.position.y = startPos.y + (endPos.y - startPos.y) * easedProgress;

      // Atualiza frame de animação
      this.animationFrame = Math.floor((elapsed / 100) % 4);

      // Emite nova posição (cria novo objeto para evitar mutação)
      this.positionSubject.next({ x: this.position.x, y: this.position.y });

      // Continua animação ou finaliza
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        this.stopMovement();
      }
    };

    animationFrameId = requestAnimationFrame(animate);
  }

  /**
   * Função de easing para movimento suave (ease-out quadrático)
   */
  private easeOutQuad(t: number): number {
    return t * (2 - t);
  }

  /**
   * Para o movimento
   */
  stop() {
    this.stopMovement();
  }

  private stopMovement() {
    this.isMoving = false;
    this.isMovingSubject.next(false);
    this.targetPosition = null;
    this.currentDirection = 'idle';
    this.directionSubject.next('idle');
    this.animationFrame = 0;
  }

  /**
   * Cria um caminho entre dois pontos (para pathfinding futuro)
   */
  private createPath(start: Position, end: Position): Position[] {
    // Por enquanto, retorna linha reta
    // Futuramente pode implementar A* pathfinding
    const steps = 30;
    const path: Position[] = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      path.push({
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t
      });
    }

    return path;
  }

  /**
   * Atualiza a direção baseado no movimento
   */
  private updateDirection(from: Position, to: Position) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      this.currentDirection = dx > 0 ? 'right' : 'left';
    } else {
      this.currentDirection = dy > 0 ? 'down' : 'up';
    }

    this.directionSubject.next(this.currentDirection);
  }

  /**
   * Calcula distância entre dois pontos
   */
  private getDistance(pos1: Position, pos2: Position): number {
    return Math.sqrt(
      Math.pow(pos2.x - pos1.x, 2) +
      Math.pow(pos2.y - pos1.y, 2)
    );
  }

  /**
   * Limita a posição aos bounds do mapa
   */
  private clampPosition(position: Position): Position {
    return {
      x: Math.max(this.MAP_BOUNDS.minX, Math.min(this.MAP_BOUNDS.maxX, position.x)),
      y: Math.max(this.MAP_BOUNDS.minY, Math.min(this.MAP_BOUNDS.maxY, position.y))
    };
  }

  /**
   * Obtém a posição atual
   */
  getPosition(): Position {
    return { ...this.position };
  }

  /**
   * Verifica se está se movendo
   */
  getIsMoving(): boolean {
    return this.isMoving;
  }

  /**
   * Obtém o frame de animação atual
   */
  getAnimationFrame(): number {
    return this.animationFrame;
  }

  /**
   * Move o player instantaneamente (teleport)
   */
  teleport(position: Position) {
    this.stopMovement();
    this.position = this.clampPosition(position);
    this.positionSubject.next(this.position);
  }

  /**
   * Movimento relativo
   */
  moveRelative(dx: number, dy: number) {
    const newPos = {
      x: this.position.x + dx,
      y: this.position.y + dy
    };
    this.moveToPosition(newPos);
  }

  /**
   * Configurações de velocidade
   */
  setMoveSpeed(speed: number) {
    this.moveSpeed = Math.max(50, Math.min(500, speed));
  }

  getMoveSpeed(): number {
    return this.moveSpeed;
  }
}