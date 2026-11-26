import { Global, Module } from '@nestjs/common';
import { BranchAccessService } from '../auth/branch-access.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, BranchAccessService],
  exports: [PrismaService, BranchAccessService],
})
export class PrismaModule {}
