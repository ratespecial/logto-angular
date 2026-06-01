import { TestBed } from '@angular/core/testing';
import { SignedOutComponent } from './signed-out.component';
import { AuthService } from '../auth.service';

describe('SignedOutComponent', () => {
  let authService: { signIn: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authService = { signIn: vi.fn() };

    TestBed.configureTestingModule({
      imports: [SignedOutComponent],
      providers: [{ provide: AuthService, useValue: authService }],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    const fixture = TestBed.createComponent(SignedOutComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('delegates signIn() to AuthService.signIn', () => {
    const fixture = TestBed.createComponent(SignedOutComponent);

    fixture.componentInstance.signIn();

    expect(authService.signIn).toHaveBeenCalledOnce();
  });
});
