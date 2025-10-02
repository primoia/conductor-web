import { TestBed } from '@angular/core/testing';
import { EventStoreService } from './event-store.service';
import { createEvent } from './screenplay-events';

describe('EventStoreService', () => {
  let service: EventStoreService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EventStoreService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with zero events', () => {
    expect(service.getAllEvents().length).toBe(0);
  });

  it('should append an event correctly', () => {
    const event = createEvent('TEST_EVENT', { data: 'test' });
    service.append(event);
    const allEvents = service.getAllEvents();
    expect(allEvents.length).toBe(1);
    expect(allEvents[0].type).toBe('TEST_EVENT');
    expect(allEvents[0].payload.data).toBe('test');
  });

  it('should notify subscribers when a new event is appended', (done) => {
    const event = createEvent('NOTIFICATION_TEST', { value: 42 });

    service.getNewEventStream().subscribe(emittedEvent => {
      expect(emittedEvent).toEqual(event);
      done(); // Finaliza o teste assíncrono com sucesso
    });

    service.append(event);
  });
});
