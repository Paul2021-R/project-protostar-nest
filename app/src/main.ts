import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { OriginGuard } from './common/guards/origin.guard';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

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
  });

  const staticWhitelist = ['https://paul2021-r.github.io'];

  app.enableCors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin || staticWhitelist.indexOf(requestOrigin) !== -1) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    methods: 'GET, HEAD, PUT, PATCH, POST, DELETE',
    credentials: true,
  });

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalGuards(new OriginGuard());

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}

bootstrap();
