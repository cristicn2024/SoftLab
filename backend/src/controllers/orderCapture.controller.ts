import { Request, Response } from 'express';
import { prisma } from '../config/db';

// 1. Búsqueda predictiva de estudios y perfiles por sucursal activa (CA-02, CA-04)
export async function searchConcepts(req: Request, res: Response) {
  try {
    const tenantId = Number(req.headers['x-tenant-id'] || 1);
    const query = String(req.query.q || '').trim();

    if (!query) return res.json([]);

    // Buscar estudios individuales
    const tests = await prisma.testCatalog.findMany({
      where: {
        tenantId,
        OR: [
          { code: { contains: query } },
          { name: { contains: query } }
        ]
      },
      take: 10
    });

    // Buscar perfiles / paquetes
    const profiles = await prisma.profileCatalog.findMany({
      where: {
        tenantId,
        status: true,
        OR: [
          { code: { contains: query } },
          { name: { contains: query } }
        ]
      },
      include: {
        tests: { include: { test: true } }
      },
      take: 5
    });

    const results = [
      ...tests.map(t => ({
        id: t.id,
        type: 'TEST' as const,
        code: t.code,
        name: t.name,
        price: Number(t.price),
        genderRestriction: t.genderRestriction || 'BOTH', // 'MALE', 'FEMALE', 'BOTH'
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
    return res.status(500).json({ error: 'Error en búsqueda predictiva de conceptos' });
  }
}

// 2. Verificar si el paciente tiene órdenes abiertas el mismo día (CA-11)
export async function checkOpenOrderToday(req: Request, res: Response) {
  try {
    const tenantId = Number(req.headers['x-tenant-id'] || 1);
    const patientId = Number(req.query.patientId);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const openOrder = await prisma.order.findFirst({
      where: {
        tenantId,
        patientId,
        createdAt: { gte: startOfDay },
        status: { in: ['pending', 'in_progress'] }
      }
    });

    return res.json({ hasOpenOrder: !!openOrder, orderId: openOrder?.id || null });
  } catch (error) {
    return res.status(500).json({ error: 'Error al consultar órdenes abiertas del día' });
  }
}

// 3. Crear médico express sin salir de la orden (CA-08)
export async function createDoctorExpress(req: Request, res: Response) {
  try {
    const tenantId = Number(req.headers['x-tenant-id'] || 1);
    const { name, cedula, specialty } = req.body;

    const doctor = await prisma.doctor.create({
      data: { tenantId, name, cedula, specialty }
    });

    return res.status(201).json(doctor);
  } catch (error) {
    return res.status(500).json({ error: 'Error al registrar médico solicitante' });
  }
}

// 4. Confirmación y registro de la Orden con Folio Único (CA-01, CA-10)
export async function createOrder(req: Request, res: Response) {
  try {
    const tenantId = Number(req.headers['x-tenant-id'] || 1);
    const { patientId, branchId, doctorId, items, totalAmount } = req.body;

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const countToday = await prisma.order.count({
      where: { tenantId, createdAt: { gte: new Date(now.setHours(0, 0, 0, 0)) } }
    });
    
    // Formato de Folio Único: ORD-YYYYMMDD-XXXX
    const folio = `ORD-${dateStr}-${(countToday + 1).toString().padStart(4, '0')}`;

    const newOrder = await prisma.order.create({
      data: {
        tenantId,
        branchId,
        patientId,
        totalAmount,
        status: 'pending',
        items: {
          create: items.map((item: any) => ({
            testId: item.type === 'TEST' ? item.id : null,
            price: item.price
          }))
        }
      }
    });

    return res.status(201).json({ success: true, folio, orderId: newOrder.id });
  } catch (error) {
    return res.status(500).json({ error: 'Error al confirmar la orden' });
  }
}