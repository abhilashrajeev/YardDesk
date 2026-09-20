import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

/**
 * Logs any API request that takes 1s or longer (method, path, outcome, duration).
 * Fast requests are not logged, so this stays quiet in normal operation.
 */
@Injectable()
export class TimingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('SlowRequest');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ method: string; originalUrl: string }>();
    const started = Date.now();
    const log = (outcome: string) => {
      const ms = Date.now() - started;
      if (ms >= 1000) this.logger.warn(`${req.method} ${req.originalUrl} ${outcome} ${ms}ms`);
    };
    return next.handle().pipe(
      tap({
        next: () => log('ok'),
        error: (e: { status?: number }) => log(`error ${e?.status ?? ''}`.trim()),
      }),
    );
  }
}
