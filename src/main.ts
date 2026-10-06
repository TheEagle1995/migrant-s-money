import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: true });
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  new Logger('bootstrap').log(`http://localhost:${port}`);
}

void bootstrap();
