import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { OriginGuard } from './common/guards/origin.guard';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({
      transports: [
        new winston.transports.Console({
          level: 'info',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      ],
    }),
    bodyParser: false,
  });

  const staticWhitelist = [
    'https://paul2021-r.github.io',
    'https://service-protostar.ddns.net',
    'http://localhost:4000',
    'http://127.0.0.1:4000',
    'http://172.18.0.1:4000',
    'http://localhost:5858',
    'http://127.0.0.1:5858',
    'http://172.18.0.1:5858',
  ];

  app.enableCors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin || staticWhitelist.indexOf(requestOrigin) !== -1) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    methods: 'GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS',
    credentials: true,
  });

  // NestJS 절대적인 Lifecycle 이 사이클은 반드시 지켜지는 편이므로 이를 이해한 설계가 중요하다.
  // 가독성과 논리적 흐름에 따라 정렬해둬야 헷갈리지 않음 & 오해가 생기지 않음
  /**
   * 1. 요청 진입
   * 2. MiddleWare - 요청 자체가 이상하면 미리 컷 해야하므로 우선시 됨
   * 3. Guards - 요청 자체가 이상하면 미리 컷 해야하므로 우선시 됨, 검증 안되면 Pipe(검증)할 필요가 없음
   * 4. Interceptors -
   * 5. Pipes - 인증된 사용자만 데이터를 검사한다
   * 6. Controller & Service
   * 7. Interceptors
   * 8. Exception Filters
   * 9. Response
   */

  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  app.enableShutdownHooks(); // Docker 종료 시 연결된 소켓의 안전한 꺼짐(graceful shutdown)

  app.useGlobalGuards(new OriginGuard());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}

bootstrap();
