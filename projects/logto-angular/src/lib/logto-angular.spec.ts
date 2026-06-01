import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LogtoAngular } from './logto-angular';

describe('LogtoAngular', () => {
  let component: LogtoAngular;
  let fixture: ComponentFixture<LogtoAngular>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LogtoAngular],
    }).compileComponents();

    fixture = TestBed.createComponent(LogtoAngular);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
