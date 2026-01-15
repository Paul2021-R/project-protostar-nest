import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class OriginGuard implements CanActivate {
  private readonly staticWhitelist = [
    'https://paul2021-r.github.io',
    'https://service-protostar.ddns.net',
    'http://localhost:4000',
    'http://127.0.0.1:4000',
    'http://172.18.0.1:4000',
    'http://172.18.0.1:5858',
    'http://localhost:5858',
    'http://127.0.0.1:5858',
  ];
  //TODO : Redis 기반 가변 Guard 로 개선 예정

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const origin = request.headers.origin;

    if (!origin) {
      return true;
    }

    if (this.staticWhitelist.includes(origin)) {
      return true;
    }

    console.warn(`[OriginGuard] Blocked origin: ${origin}`);
    throw new ForbiddenException('Not allowed origin');
  }
}
