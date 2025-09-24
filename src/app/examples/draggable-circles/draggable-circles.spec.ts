import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DraggableCircles } from './draggable-circles';
import { CircleEvent, CircleData } from './draggable-circle.component';

describe('DraggableCircles', () => {
  let component: DraggableCircles;
  let fixture: ComponentFixture<DraggableCircles>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DraggableCircles]
    }).compileComponents();

    fixture = TestBed.createComponent(DraggableCircles);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with 3 circles', () => {
    expect(component.circles).toBeDefined();
    expect(component.circles.length).toBe(3);
    expect(component.circles[0].id).toBe('auth');
    expect(component.circles[1].id).toBe('cart');
    expect(component.circles[2].id).toBe('progress');
  });

  it('should track circle by id', () => {
    // Arrange
    const mockCircle = component.circles[0];

    // Act
    const result = component.trackByCircleId(0, mockCircle);

    // Assert
    expect(result).toBe('auth');
  });

  it('should handle circle click event', () => {
    // Arrange
    const mockEvent: CircleEvent = {
      circle: component.circles[0],
      position: { x: 100, y: 100 },
      type: 'click'
    };

    // Act
    component.onCircleEvent(mockEvent);

    // Assert
    expect(component.lastEvent).toEqual(mockEvent);
  });

  it('should handle circle drag events', () => {
    // Arrange
    const mockEvent: CircleEvent = {
      circle: component.circles[0],
      position: { x: 200, y: 250 },
      type: 'dragMove'
    };

    // Act
    component.onCircleEvent(mockEvent);

    // Assert
    expect(component.lastEvent).toEqual(mockEvent);
    expect(component.circles[0].position).toEqual({ x: 200, y: 250 });
  });

  it('should save positions to localStorage on dragEnd', () => {
    // Arrange
    spyOn(localStorage, 'setItem');
    const mockEvent: CircleEvent = {
      circle: component.circles[0],
      position: { x: 300, y: 350 },
      type: 'dragEnd'
    };

    // Act
    component.onCircleEvent(mockEvent);

    // Assert
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'circle-positions',
      jasmine.any(String)
    );
  });

  it('should return safe last event type', () => {
    // Test quando não há evento
    component.lastEvent = null;
    expect(component.getLastEventType()).toBe('Nenhum');

    // Test quando há evento
    component.lastEvent = {
      circle: component.circles[0],
      position: { x: 0, y: 0 },
      type: 'click'
    };
    expect(component.getLastEventType()).toBe('click');
  });

  it('should return safe last event circle id', () => {
    // Test quando não há evento
    component.lastEvent = null;
    expect(component.getLastEventCircleId()).toBe('Nenhum');

    // Test quando há evento
    component.lastEvent = {
      circle: component.circles[0],
      position: { x: 0, y: 0 },
      type: 'click'
    };
    expect(component.getLastEventCircleId()).toBe('auth');
  });
});