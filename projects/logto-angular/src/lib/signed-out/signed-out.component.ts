import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../auth.service';

@Component({
  selector: 'lib-signed-out',
  templateUrl: './signed-out.component.html',
  styleUrl: './signed-out.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignedOutComponent {
  private authService = inject(AuthService);

  /** Restart the Logto sign-in flow (redirects to the hosted UI). */
  signIn(): void {
    this.authService.signIn();
  }
}
