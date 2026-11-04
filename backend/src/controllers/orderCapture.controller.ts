import { Request, Response } from 'express';
import { prisma } from '../config/db';

export async function searchConcepts(req: Request, res: Response) {
  try {
    const tenantId = Number(req.headers['x-tenant-id'] || 1);
    const query = String(req.query.q || '').trim();

    if (!query) return res.json([]);

    const tests = await prisma.testCatalog.findMany({
      where: {
        tenantId,
        OR: [{ code: { contains: query } }, { name: { contains: query } }]
      },
      take: 10
    });

    const profiles = await prisma.profileCatalog.findMany({
      where: {
        tenantId,
        status: true,
        OR: [{ code: { contains: query } }, { name: { contains: query } }]
      },
      include: { tests: { include: { test: true } } },
      take: 5
    });

    const results = [
      ...tests.map(t => ({
        id: t.id,
        type: 'TEST' as const,
        code: t.code,
        name: t.name,
        price: Number(t.price),
        genderRestriction: t.genderRestriction || 'BOTH',
        includedTestIds: [t.id]
      })),
      ...profiles.map(p => ({
        id: p.id,
        type: 'PROFILE' as const,
        code: p.code,
        name: p.name,
        price: Number(p.price),
        genderRestriction: 'BOTH',
        includedTestIds: p.tests.map(pt => pt.testId)
      }))
    ];

    return res.json(results);
  } catch (error) {
    console.error('Error en searchConcepts:', error);
    return res.status(500).json({ error: 'Error en búsqueda predictiva de conceptos' });
  }
}

export async function checkOpenOrderToday(req: Request, res: Response) {
  try {
    const tenantId = Number(req.headers['x-tenant-id'] || 1);
    const patientId = Number(req.query.patientId);

    if (!patientId || isNaN(patientId)) {
      return res.json({ hasOpenOrder: false, orderId: null });
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const openOrder = await prisma.order.findFirst({
      where: {
        tenantId,
        patientId,
        createdAt: { gte: startOfDay },
        status: 'pending'
      }
    });

    return res.json({ hasOpenOrder: !!openOrder, orderId: openOrder?.id || null });
  } catch (error) {
    console.error('Error en checkOpenOrderToday:', error);
    return res.status(500).json({ error: 'Error al consultar órdenes abiertas del día' });
  }
}

export async function createDoctorExpress(req: Request, res: Response) {
  try {
    const tenantId = Number(req.headers['x-tenant-id'] || 1);
    const { name, cedula, specialty } = req.body;

    const doctor = await prisma.doctor.create({
      data: { tenantId, name, cedula, specialty }
    });

    return res.status(201).json(doctor);
  } catch (error) {
    console.error('Error en createDoctorExpress:', error);
    return res.status(500).json({ error: 'Error al registrar médico solicitante' });
  }
}

export async function createOrder(req: Request, res: Response) {
  try {
    const tenantId = Number(req.headers['x-tenant-id'] || 1);
    const { patientId, branchId, doctorId, items, totalAmount } = req.body;

    const numPatientId = Number(patientId);
    const numBranchId = Number(branchId);
    const numDoctorId = doctorId ? Number(doctorId) : null;

    if (!numPatientId || isNaN(numPatientId)) {
      return res.status(400).json({ error: 'patientId es requerido' });
    }

    if (!numBranchId || isNaN(numBranchId)) {
      return res.status(400).json({ error: 'branchId es requerido' });
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countToday = await prisma.order.count({
      where: { tenantId, createdAt: { gte: startOfDay } }
    });

    const folio = `ORD-${dateStr}-${(countToday + 1).toString().padStart(4, '0')}`;

    const itemsToCreate = (items && Array.isArray(items) ? items : [])
      .filter((item: any) => item && (item.id || item.type))
      .map((item: any) => {
        const itemData: any = {
          price: Number(item.price || 0)
        };
        if (item.type === 'PROFILE') {
          itemData.profileId = Number(item.id);
        } else {
          itemData.testId = Number(item.id);
        }
        return itemData;
      });

    const newOrder = await prisma.order.create({
      data: {
        tenantId,
        branchId: numBranchId,
        patientId: numPatientId,
        doctorId: numDoctorId,
        totalAmount: totalAmount ? Number(totalAmount) : 0,
        status: 'pending',
        ...(itemsToCreate.length > 0 && {
          items: {
            create: itemsToCreate
          }
        })
      }
    });

    return res.status(201).json({ success: true, folio, orderId: newOrder.id });
  } catch (error) {
    console.error('Error en createOrder:', error);
    return res.status(500).json({ error: 'Error al confirmar la orden' });
  }
}