import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { DuplicateFolioError } from '../dominio/ordenes.errors';
import type { OrdenesRepository } from '../dominio/ordenes.repository';
import type {
  CatalogProfile,
  CatalogTest,
  Doctor,
  NewDoctorData,
  NewOrderData,
} from '../dominio/ordenes.types';

function isDuplicateFolio(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const known = error as { code?: string; meta?: { target?: unknown } };
  if (known.code !== 'P2002') return false;
  const target = known.meta?.target;
  if (Array.isArray(target)) return target.some((field) => String(field).includes('folio'));
  return String(target).includes('folio');
}

@Injectable()
export class OrdenesPrismaRepository implements OrdenesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findTests(tenantId: number, query: string, limit: number): Promise<CatalogTest[]> {
    const tests = await this.prisma.testCatalog.findMany({
      where: {
        tenantId,
        OR: [{ code: { contains: query } }, { name: { contains: query } }],
      },
      take: limit,
    });

    const result: CatalogTest[] = [];
    for (const test of tests) {
      result.push({
        id: test.id,
        code: test.code,
        name: test.name,
        price: Number(test.price),
        genderRestriction: test.genderRestriction,
      });
    }
    return result;
  }

  async findActiveProfiles(tenantId: number, query: string, limit: number): Promise<CatalogProfile[]> {
    const profiles = await this.prisma.profileCatalog.findMany({
      where: {
        tenantId,
        status: true,
        OR: [{ code: { contains: query } }, { name: { contains: query } }],
      },
      include: { tests: { include: { test: true } } },
      take: limit,
    });

    const result: CatalogProfile[] = [];
    for (const profile of profiles) {
      const includedTestIds: number[] = [];
      for (const profileTest of profile.tests) includedTestIds.push(profileTest.testId);
      result.push({
        id: profile.id,
        code: profile.code,
        name: profile.name,
        price: Number(profile.price),
        includedTestIds,
      });
    }
    return result;
  }

  findPendingOrderSince(tenantId: number, patientId: number, since: Date): Promise<{ id: number } | null> {
    return this.prisma.order.findFirst({
      where: { tenantId, patientId, createdAt: { gte: since }, status: 'pending' },
      select: { id: true },
    });
  }

  createDoctor(data: NewDoctorData): Promise<Doctor> {
    return this.prisma.doctor.create({
      data: {
        tenantId: data.tenantId,
        name: data.name,
        cedula: data.cedula,
        specialty: data.specialty,
      },
    });
  }

  countOrdersSince(tenantId: number, since: Date): Promise<number> {
    return this.prisma.order.count({ where: { tenantId, createdAt: { gte: since } } });
  }

  countFoliosWithPrefix(prefix: string): Promise<number> {
    return this.prisma.order.count({ where: { folio: { startsWith: prefix } } });
  }

  async createOrder(data: NewOrderData): Promise<{ id: number }> {
    const orderData: Prisma.OrderUncheckedCreateInput = {
      tenantId: data.tenantId,
      branchId: data.branchId,
      patientId: data.patientId,
      doctorId: data.doctorId,
      totalAmount: data.totalAmount,
      folio: data.folio,
      status: 'pending',
    };
    if (data.items.length > 0) {
      orderData.items = { create: data.items };
    }

    try {
      const order = await this.prisma.order.create({ data: orderData });
      return { id: order.id };
    } catch (error) {
      if (isDuplicateFolio(error)) throw new DuplicateFolioError();
      throw error;
    }
  }
}
