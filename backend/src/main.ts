import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  ValidationPipe,
  ClassSerializerInterceptor,
  Logger,
} from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['log', 'warn', 'error', 'debug'],
  });

  const configService = app.get(ConfigService);

  // ── Ensure upload directory exists ────────────────────────────────────────
  const uploadDir = configService.get<string>('upload.destination') ?? './uploads';
  fs.mkdirSync(uploadDir, { recursive: true });

  // ── CORS ──────────────────────────────────────────────────────────────────
  const allowedOrigins = configService.get<string[]>('cors.origins') ?? [
    'http://localhost:3001',
    'http://localhost:5173',
  ];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    exposedHeaders: ['Content-Disposition'],
  });

  // ── Global prefix ─────────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1', {
    exclude: ['/', '/health'],
  });

  // ── Validation pipe ───────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,             // strip unknown props
      forbidNonWhitelisted: false, // don't throw on unknown, just strip
      transform: true,             // auto-transform types (string->number etc.)
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ── Serialization interceptor ─────────────────────────────────────────────
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // ── Static file serving for uploads ───────────────────────────────────────
  app.useStaticAssets(path.resolve(uploadDir), {
    prefix: '/uploads',
  });

  // ── Swagger / OpenAPI docs ────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('MathV2 CAD/CAM API')
    .setDescription(
      '## MathV2 — AI-Assisted CAD/CAM SaaS Platform\n\n' +
      'Upload engineering drawings (PDF, DXF, DWG, images), auto-detect machining ' +
      'features using AI, generate production-ready CNC G-Code, and run toolpath ' +
      'simulations — all through this REST API.\n\n' +
      '### Authentication\n' +
      'All endpoints (except `/auth/register` and `/auth/login`) require a **Bearer JWT** ' +
      'in the `Authorization` header. Obtain a token via `POST /api/v1/auth/login`.',
    )
    .setVersion('1.0.0')
    .setContact('MathV2 Team', 'https://mathv2.io', 'support@mathv2.io')
    .setLicense('Proprietary', '')
    .addServer(`http://localhost:${configService.get('port') ?? 3000}`, 'Local Development')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token (without "Bearer " prefix)',
      },
      'access-token',
    )
    .addTag('auth', 'Registration, login, profile')
    .addTag('projects', 'Project lifecycle management')
    .addTag('files', 'CAD plan upload and management')
    .addTag('analysis', 'AI-driven drawing analysis & feature detection')
    .addTag('gcode', 'CNC G-Code generation (FANUC, Siemens, Heidenhain, etc.)')
    .addTag('simulation', 'Toolpath simulation & collision detection')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'method',
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
    customSiteTitle: 'MathV2 API Docs',
  });

  // ── Start ─────────────────────────────────────────────────────────────────
  const port = configService.get<number>('port') ?? 3000;
  await app.listen(port, '0.0.0.0');

  const baseUrl = `http://localhost:${port}`;
  logger.log(`Application:   ${baseUrl}`);
  logger.log(`API base:      ${baseUrl}/api/v1`);
  logger.log(`API Docs:      ${baseUrl}/docs`);
  logger.log(`Environment:   ${configService.get('environment')}`);
  logger.log(`Upload dir:    ${path.resolve(uploadDir)}`);
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
