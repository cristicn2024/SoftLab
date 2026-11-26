import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BranchAccessController } from './branch-access.controller';

@Module({ imports: [PrismaModule], controllers: [BranchAccessController] })
export class AdminModule {}
