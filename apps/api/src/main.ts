import 'reflect-metadata';
import { ConsoleLogger, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { API_PREFIX, configureApp } from './app.setup.js';
import { loadEnv } from './config/env.schema.js';

async function bootstrap(): Promise<void> {
  const env = loadEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Structured JSON logging (one line per event); no secrets are ever passed as log context.
    logger: new ConsoleLogger({ json: true }),
    bufferLogs: true,
  });
  configureApp(app);

  if (env.NODE_ENV !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Najme API')
        .setVersion(env.GIT_SHA ?? 'dev')
        .build(),
    );
    SwaggerModule.setup(`${API_PREFIX}/docs`, app, document);
  }

  await app.listen(env.PORT);
  Logger.log(`Najme API listening on port ${env.PORT} (${env.NODE_ENV})`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  Logger.error('Failed to start the Najme API', error instanceof Error ? error.stack : error);
  process.exit(1);
});
