import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

// 매번 감싸고 가드 설정하기 애매하므로 클래스로 감싸기
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}

/**
 * @useGuards(JwtAuthGuard)
 * getProfile(@ValidateUser() user: User) {}
 *
 * 이런 식으로 사용 가능
 *
 * 이제는 전역으로 무조건 검사로 변경
 * @Public() 데코레이터를 사용하여 public으로 설정으로 변경
 *  */
