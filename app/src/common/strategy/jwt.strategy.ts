import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Role, User } from "@prisma/client";
import { ExtractJwt, Strategy } from "passport-jwt";

type JwtPayload = {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    const secretOrKey = configService.get<string>('JWT_SECRET');

    if (!secretOrKey || secretOrKey === '') {
      throw new Error('JWT_SECRET is not defined');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey,
    });
  }

  // stateless 하기 signin 에서 검증 하므로 바로 partial user 반환으로 마무리
  async validate(payload: JwtPayload): Promise<Partial<User>> {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role as Role,
    }
  }
}
