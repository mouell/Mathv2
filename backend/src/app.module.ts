import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';

import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { FilesModule } from './files/files.module';
import { AnalysisModule } from './analysis/analysis.module';
import { GcodeModule } from './gcode/gcode.module';
import { SimulationModule } from './simulation/simulation.module';
import { JwtAuthGuard } from './auth/auth.guard';

@Module({
  imports: [
    // ── Configuration (globally available via ConfigService) ──────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '.env.local'],
      cache: true,
    }),

    // ── Database (globally available via PrismaService) ───────────────────
    PrismaModule,

    // ── Feature modules ───────────────────────────────────────────────────
    AuthModule,
    ProjectsModule,
    FilesModule,
    AnalysisModule,
    GcodeModule,
    SimulationModule,
  ],

  providers: [
    // Apply JwtAuthGuard globally; individual public routes use @Public() to opt out
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    Reflector,
  ],
})
export class AppModule {}
