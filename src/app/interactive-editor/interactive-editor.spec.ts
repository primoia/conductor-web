import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InteractiveEditor } from './interactive-editor';

describe('InteractiveEditor', () => {
  let component: InteractiveEditor;
  let fixture: ComponentFixture<InteractiveEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InteractiveEditor]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InteractiveEditor);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
