import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DemoRoadmap } from './demo-roadmap';

describe('DemoRoadmap', () => {
  let component: DemoRoadmap;
  let fixture: ComponentFixture<DemoRoadmap>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DemoRoadmap]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DemoRoadmap);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
