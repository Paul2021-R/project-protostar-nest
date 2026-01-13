import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtModule, JwtModuleOptions } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtStrategy } from "src/common/strategy/jwt.strategy";

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService): Promise<JwtModuleOptions> => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          // configService.get<>() 는 형변환이 아닌 단언을 의미함 
          // 따라서 명시적 형변환을 해주는 게 필요
          // 만약 확실하게 하고 싶다면 Joi 라이브러리를 사용하여 환경 변수 검증을 도입하면 문제 없음
          expiresIn: Number(configService.get<string>('JWT_EXPIRATION')),
        },
      }),
    })
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule { }