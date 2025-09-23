import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProposalBlock } from './proposal-block';

describe('ProposalBlock', () => {
  let component: ProposalBlock;
  let fixture: ComponentFixture<ProposalBlock>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProposalBlock]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProposalBlock);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
