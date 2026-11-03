import { prisma } from '../config/db';

export function getFeatureData() {
  return prisma.tenant.findFirst({
    where: { name: 'Laboratorio Santa Lucía' },
    include: {
      branches: { where: { name: 'Clínica Central' } },
      patients: { where: { firstName: 'María' }, take: 1 },
      tests: {
        include: {
          instructions: true,
          parameters: { include: { ranges: true }, orderBy: { sortOrder: 'asc' } },
        },
      },
      orders: {
        where: { folio: 'SL-261020-0057' },
        include: {
          patient: true,
          branch: true,
          physician: true,
          items: {
            include: {
              test: {
                include: {
                  instructions: true,
                  parameters: { include: { ranges: true }, orderBy: { sortOrder: 'asc' } },
                },
              },
              testResults: { include: { parameter: true, criticalNotifications: true } },
            },
          },
          samples: true,
          instructionConfirmation: true,
        },
      },
      practitioners: true,
    },
  });
}
