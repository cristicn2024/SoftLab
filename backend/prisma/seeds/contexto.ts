import type { Branch, Tenant } from '@prisma/client';

export interface ContextoSeed {
  tenant: Tenant;
  branch: Branch;
}
