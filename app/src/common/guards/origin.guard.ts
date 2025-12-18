import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

@Injectable()
export class OriginGuard implements CanActivate {
    private readonly staticWhitelist = [
        'http://localhost:3000',
        'https://paul2021-r.github.io',
        'https://service-protostar.ddns.net'
    ]

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const origin = request.headers.origin;

        if (!origin) {
            return true;
        }

        if (this.staticWhitelist.includes(origin)) {
            return true;
        }

        throw new ForbiddenException('Not allowed origin');
    }
}