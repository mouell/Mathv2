import { Module } from '@nestjs/common';
import { GcodeController } from './gcode.controller';
import { GcodeService } from './gcode.service';

@Module({
  controllers: [GcodeController],
  providers: [GcodeService],
  exports: [GcodeService],
})
export class GcodeModule {}
