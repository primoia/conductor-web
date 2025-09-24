import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DraggableCircle, CircleData, CircleEvent } from './draggable-circle.component';

describe('DraggableCircle', () => {
  let component: DraggableCircle;
  let fixture: ComponentFixture<DraggableCircle>;
  let mockCircleData: CircleData;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DraggableCircle]
    }).compileComponents();

    fixture = TestBed.createComponent(DraggableCircle);
    component = fixture.componentInstance;

    // Mock data para testes
    mockCircleData = {
      id: 'test-circle',
      emoji: '🔥',
      category: 'auth',
      title: 'Test Circle',
      description: 'Circle for testing'
    };

    component.data = mockCircleData;
    component.position = { x: 100, y: 100 };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit circleEvent on click when not dragging', () => {
    // Arrange
    spyOn(component.circleEvent, 'emit');
    const mockEvent = new MouseEvent('click');

    // Act
    component.onCircleClick(mockEvent);

    // Assert
    expect(component.circleEvent.emit).toHaveBeenCalledWith({
      circle: mockCircleData,
      position: { x: 100, y: 100 },
      type: 'click'
    });
  });

  it('should NOT emit click when has moved (after drag)', () => {
    // Arrange
    spyOn(component.circleEvent, 'emit');
    component.dragState.hasMoved = true;
    const mockEvent = new MouseEvent('click');

    // Act
    component.onCircleClick(mockEvent);

    // Assert
    expect(component.circleEvent.emit).not.toHaveBeenCalled();
  });

  it('should start drag on mousedown', () => {
    // Arrange
    const mockTarget = document.createElement('div');
    const mockEvent = new MouseEvent('mousedown', {
      clientX: 150,
      clientY: 200,
      button: 0
    });
    Object.defineProperty(mockEvent, 'target', {
      value: mockTarget
    });
    spyOn(component.circleEvent, 'emit');

    // Act
    component.onMouseDown(mockEvent);

    // Assert
    expect(component.dragState.isDragging).toBe(true);
    expect(component.dragState.startX).toBe(150);
    expect(component.dragState.startY).toBe(200);
    expect(component.circleEvent.emit).toHaveBeenCalledWith({
      circle: mockCircleData,
      position: { x: 100, y: 100 },
      type: 'dragStart'
    });
  });

  it('should update position externally', () => {
    // Arrange
    const newPosition = { x: 300, y: 400 };

    // Act
    component.updatePosition(newPosition);

    // Assert
    expect(component.position).toEqual(newPosition);
  });

  it('should return isDragging status', () => {
    // Arrange & Act
    component.dragState.isDragging = true;

    // Assert
    expect(component.isDragging).toBe(true);
  });

  // 🔥 TESTES DE REGRESSÃO - DETECTAR QUANDO DRAG QUEBRA
  describe('Drag Functionality Regression Tests', () => {

    it('should complete full drag cycle: mousedown → mousemove → mouseup', () => {
      // ARRANGE
      const startPosition = { x: 100, y: 100 };
      const endPosition = { x: 200, y: 200 };

      spyOn(component.circleEvent, 'emit');
      spyOn(component.positionChange, 'emit');

      // Simular container para cálculos
      const mockContainer = document.createElement('div');
      mockContainer.style.width = '800px';
      mockContainer.style.height = '600px';
      mockContainer.getBoundingClientRect = () => ({
        left: 0, top: 0, width: 800, height: 600,
        right: 800, bottom: 600, x: 0, y: 0, toJSON: () => {}
      }) as DOMRect;
      component.container = mockContainer;

      // ACT 1: Iniciar drag
      const mockTarget = document.createElement('div');
      const mouseDownEvent = new MouseEvent('mousedown', {
        clientX: startPosition.x,
        clientY: startPosition.y,
        button: 0
      });
      Object.defineProperty(mouseDownEvent, 'target', {
        value: mockTarget
      });

      component.onMouseDown(mouseDownEvent);

      // ASSERT 1: Drag iniciou
      expect(component.dragState.isDragging).toBe(true);
      expect(component.circleEvent.emit).toHaveBeenCalledWith({
        circle: mockCircleData,
        position: startPosition,
        type: 'dragStart'
      });

      // ACT 2: Mover mouse (simular movimento significativo)
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: endPosition.x,
        clientY: endPosition.y
      });

      // Simular primeiro movimento pequeno que será ignorado
      const smallMoveEvent = new MouseEvent('mousemove', {
        clientX: startPosition.x + 2, // Movimento < 5px
        clientY: startPosition.y + 2
      });
      component['onMouseMove'](smallMoveEvent);
      expect(component.dragState.hasMoved).toBe(false);

      // Movimento grande que ativa o drag
      component['onMouseMove'](mouseMoveEvent);

      // ASSERT 2: Posição foi atualizada
      expect(component.dragState.hasMoved).toBe(true);
      expect(component.positionChange.emit).toHaveBeenCalled();

      // ACT 3: Soltar mouse
      const mouseUpEvent = new MouseEvent('mouseup');
      component['onMouseUp'](mouseUpEvent);

      // ASSERT 3: Drag finalizou
      expect(component.dragState.isDragging).toBe(false);
      expect(component.circleEvent.emit).toHaveBeenCalledWith({
        circle: mockCircleData,
        position: jasmine.any(Object),
        type: 'dragEnd'
      });
    });

    it('should NOT drag when disabled', () => {
      // ARRANGE
      component.disabled = true;
      spyOn(component.circleEvent, 'emit');

      // ACT
      const mockTarget = document.createElement('div');
      const mouseDownEvent = new MouseEvent('mousedown', { button: 0 });
      Object.defineProperty(mouseDownEvent, 'target', {
        value: mockTarget
      });
      component.onMouseDown(mouseDownEvent);

      // ASSERT
      expect(component.dragState.isDragging).toBe(false);
      expect(component.circleEvent.emit).not.toHaveBeenCalled();
    });

    it('should NOT drag on right-click (button !== 0)', () => {
      // ARRANGE
      spyOn(component.circleEvent, 'emit');

      // ACT
      const mockTarget = document.createElement('div');
      const rightClickEvent = new MouseEvent('mousedown', { button: 2 }); // Right click
      Object.defineProperty(rightClickEvent, 'target', {
        value: mockTarget
      });
      component.onMouseDown(rightClickEvent);

      // ASSERT
      expect(component.dragState.isDragging).toBe(false);
      expect(component.circleEvent.emit).not.toHaveBeenCalled();
    });

    it('should respect container boundaries during drag', () => {
      // ARRANGE
      const mockContainer = document.createElement('div');
      mockContainer.getBoundingClientRect = () => ({
        left: 0, top: 0, width: 400, height: 300,
        right: 400, bottom: 300, x: 0, y: 0, toJSON: () => {}
      }) as DOMRect;
      component.container = mockContainer;

      component.dragState = {
        isDragging: true,
        startX: 100,
        startY: 100,
        offsetX: 30,
        offsetY: 30,
        hasMoved: true
      };

      // ACT: Tentar mover para fora dos limites
      const outsideMoveEvent = new MouseEvent('mousemove', {
        clientX: 500, // Fora do container (400px)
        clientY: 400  // Fora do container (300px)
      });

      component['onMouseMove'](outsideMoveEvent);

      // ASSERT: Posição limitada aos bounds
      expect(component.position.x).toBeLessThanOrEqual(340); // 400 - 60 (circle size)
      expect(component.position.y).toBeLessThanOrEqual(240); // 300 - 60 (circle size)
      expect(component.position.x).toBeGreaterThanOrEqual(0);
      expect(component.position.y).toBeGreaterThanOrEqual(0);
    });

    it('should prevent CSS transitions during drag', () => {
      // ARRANGE
      const mockTarget = document.createElement('div');
      const mouseDownEvent = new MouseEvent('mousedown', { button: 0 });
      Object.defineProperty(mouseDownEvent, 'target', {
        value: mockTarget
      });

      // ACT
      component.onMouseDown(mouseDownEvent);

      // ASSERT: CSS transitions foram desabilitadas e drag iniciou
      expect(component.dragState.isDragging).toBe(true);
      expect(mockTarget.style.transition).toBe('none');
    });
  });
});