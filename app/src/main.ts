import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { OriginGuard } from './common/guards/origin.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const staticWhitelist = [
    'https://paul2021-r.github.io',
  ]

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
  })

  app.useGlobalGuards(new OriginGuard());

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}

bootstrap();
