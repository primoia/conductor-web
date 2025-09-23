import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExecutionTrigger } from './execution-trigger';

describe('ExecutionTrigger', () => {
  let component: ExecutionTrigger;
  let fixture: ComponentFixture<ExecutionTrigger>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExecutionTrigger]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExecutionTrigger);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
