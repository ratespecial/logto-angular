import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';
import { HistoryService } from '../history.service';
import { LOGTO_AUTH_CONFIG, PRIMARY_RESOURCE } from '../tokens';

const DEFAULT_NO_ACCESS_MESSAGE =
  'Your account has no access to this application. Contact an administrator.';

@Component({
  selector: 'lib-callback',
  templateUrl: './callback.component.html',
  styleUrls: ['./callback.component.scss'],
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CallbackComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private historyService = inject(HistoryService);
  private primaryResource = inject(PRIMARY_RESOURCE);
  private noAccessMessage = inject(LOGTO_AUTH_CONFIG).noAccessMessage ?? DEFAULT_NO_ACCESS_MESSAGE;

  loading = signal(true);
  error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      await this.authService.handleCallback(window.location.href);

      // Gate SPA access on the primary (local API) resource token carrying scopes.
      // Secondary resources are CORS APIs and may legitimately be empty for some users.
      const claims = await this.authService.getAccessTokenClaims(this.primaryResource);
      this.loading.set(false);

      if (!(claims.scope ?? '').trim()) {
        this.error.set(this.noAccessMessage);
        return;
      }

      const destination = this.historyService.consumeLastVisitedRoute() || '/';
      this.router.navigateByUrl(destination);
    } catch (err: unknown) {
      this.loading.set(false);
      this.error.set(err instanceof Error ? err.message : 'Authentication failed.');
    }
  }
}
