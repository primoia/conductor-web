import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { PersonaEditModalComponent } from './persona-edit-modal.component';
import { PersonaEditService, ValidationState, SaveState } from '../../services/persona-edit.service';
import { of, throwError } from 'rxjs';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';

describe('PersonaEditModalComponent', () => {
  let component: PersonaEditModalComponent;
  let fixture: ComponentFixture<PersonaEditModalComponent>;
  let compiled: DebugElement;
  let mockPersonaEditService: jasmine.SpyObj<PersonaEditService>;

  beforeEach(async () => {
    const serviceSpy = jasmine.createSpyObj('PersonaEditService', [
      'saveOriginalPersona',
      'getOriginalPersona',
      'loadPersona',
      'savePersonaWithHistory',
      'savePersonaToBackend',
      'validatePersonaAdvanced'
    ]);

    await TestBed.configureTestingModule({
      imports: [PersonaEditModalComponent],
      providers: [
        { provide: PersonaEditService, useValue: serviceSpy }
      ]
    }).compileComponents();

    mockPersonaEditService = TestBed.inject(PersonaEditService) as jasmine.SpyObj<PersonaEditService>;
    fixture = TestBed.createComponent(PersonaEditModalComponent);
    component = fixture.componentInstance;
    compiled = fixture.debugElement;

    // Default mocks
    mockPersonaEditService.validatePersonaAdvanced.and.returnValue({
      isValid: true,
      errors: [],
      warnings: []
    });
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Visibility', () => {
    it('should not render modal when isVisible is false', () => {
      component.isVisible = false;
      fixture.detectChanges();

      const backdrop = compiled.query(By.css('.modal-backdrop'));
      expect(backdrop).toBeNull();
    });

    it('should render modal when isVisible is true', () => {
      component.isVisible = true;
      fixture.detectChanges();

      const backdrop = compiled.query(By.css('.modal-backdrop'));
      expect(backdrop).toBeTruthy();
    });
  });

  describe('Footer Actions', () => {
    it('should return correct footer actions', () => {
      component.validationState.isValid = true;
      const actions = component.getFooterActions();

      expect(actions.length).toBe(2);
      expect(actions[0].action).toBe('cancel');
      expect(actions[1].action).toBe('save');
    });

    it('should handle footer action clicks', () => {
      spyOn(component, 'save');
      spyOn(component, 'close');

      component.onFooterAction('save');
      expect(component.save).toHaveBeenCalled();

      component.onFooterAction('cancel');
      expect(component.close).toHaveBeenCalled();
    });
  });
});
