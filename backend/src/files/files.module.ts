import { Module, forwardRef } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { AnalysisModule } from '../analysis/analysis.module';

@Module({
  imports: [forwardRef(() => AnalysisModule)],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
