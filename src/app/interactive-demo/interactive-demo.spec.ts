import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InteractiveDemo } from './interactive-demo';

describe('InteractiveDemo', () => {
  let component: InteractiveDemo;
  let fixture: ComponentFixture<InteractiveDemo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InteractiveDemo]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InteractiveDemo);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
