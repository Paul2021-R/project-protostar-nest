import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const ValidateUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user; // validate 가 리턴 값 수신
  },
);
