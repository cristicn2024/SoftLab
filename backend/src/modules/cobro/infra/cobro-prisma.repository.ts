import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { BillingOrderNotFoundError, PaymentNotFoundError } from '../dominio/cobro.errors';
import type { CobroRepository } from '../dominio/cobro.repository';
import type {
  BillingItem,
  BillingLog,
  BillingOrder,
  BillingPayment,
  CancellableOrder,
  CancellablePayment,
  CancellationPlan,
  PayableOrder,
  PaymentsPlan,
} from '../dominio/cobro.types';

@Injectable()
export class CobroPrismaRepository implements CobroRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findBillingOrder(tenantId: number, orderId: number): Promise<BillingOrder | null> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
      include: {
        patient: true,
        branch: true,
        items: { include: { test: true, profile: true }, orderBy: { id: 'asc' } },
        payments: { orderBy: { id: 'asc' } },
        paymentLogs: { orderBy: { id: 'desc' } },
      },
    });
    if (!order) return null;

    const items: BillingItem[] = [];
    for (const item of order.items) {
      let code = '';
      let name = '';
      if (item.test) {
        code = item.test.code;
        name = item.test.name;
      } else if (item.profile) {
        code = item.profile.code;
        name = item.profile.name;
      }
      items.push({ code, name, price: Number(item.price) });
    }

    const payments: BillingPayment[] = [];
    for (const payment of order.payments) {
      payments.push({
        id: payment.id,
        method: payment.method,
        amount: Number(payment.amount),
        reference: payment.reference,
        createdBy: payment.createdBy,
        createdAt: payment.createdAt,
        cancelled: payment.cancelled,
        cancelReason: payment.cancelReason,
      });
    }

    const logs: BillingLog[] = [];
    for (const log of order.paymentLogs) {
      logs.push({ userName: log.userName, action: log.action, detail: log.detail, createdAt: log.createdAt });
    }

    return {
      id: order.id,
      status: order.status,
      patient: {
        id: order.patient.id,
        firstName: order.patient.firstName,
        lastName: order.patient.lastName,
        birthDate: order.patient.birthDate,
        gender: order.patient.gender,
      },
      doctorName: order.doctorName,
      branch: { id: order.branch.id, name: order.branch.name },
      items,
      discountPercent: order.discountPercent,
      discountReason: order.discountReason,
      discountAuthorizedBy: order.discountAuthorizedBy,
      invoiceRfc: order.invoiceRfc,
      invoiceName: order.invoiceName,
      invoiceZip: order.invoiceZip,
      invoiceUse: order.invoiceUse,
      resultsDeliveredAt: order.resultsDeliveredAt,
      payments,
      logs,
    };
  }

  async registerPayments(
    tenantId: number,
    orderId: number,
    decide: (order: PayableOrder) => PaymentsPlan,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} AND tenant_id = ${tenantId} FOR UPDATE`;
      const order = await tx.order.findFirst({
        where: { id: orderId, tenantId },
        include: { items: true, payments: true },
      });
      if (!order) throw new BillingOrderNotFoundError();

      const itemPrices: number[] = [];
      for (const item of order.items) itemPrices.push(Number(item.price));
      const payments: { amount: number; cancelled: boolean }[] = [];
      for (const payment of order.payments) {
        payments.push({ amount: Number(payment.amount), cancelled: payment.cancelled });
      }

      const plan = decide({
        id: order.id,
        branchId: order.branchId,
        discountPercent: order.discountPercent,
        discountReason: order.discountReason,
        discountAuthorizedBy: order.discountAuthorizedBy,
        resultsDeliveredAt: order.resultsDeliveredAt,
        itemPrices,
        payments,
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          discountPercent: plan.order.discountPercent,
          discountReason: plan.order.discountReason,
          discountAuthorizedBy: plan.order.discountAuthorizedBy,
          totalAmount: plan.order.totalAmount,
          paidAmount: plan.order.paidAmount,
          ...(plan.order.invoice
            ? {
                invoiceRfc: plan.order.invoice.rfc,
                invoiceName: plan.order.invoice.name,
                invoiceZip: plan.order.invoice.zip,
                invoiceUse: plan.order.invoice.use,
              }
            : {}),
        },
      });

      for (const payment of plan.payments) {
        await tx.payment.create({
          data: {
            tenantId,
            orderId: order.id,
            branchId: order.branchId,
            method: payment.method,
            amount: payment.amount,
            reference: payment.reference,
            createdBy: payment.createdBy,
          },
        });
      }

      for (const log of plan.logs) {
        await tx.paymentLog.create({
          data: { tenantId, orderId: order.id, userName: plan.userName, action: log.action, detail: log.detail },
        });
      }
    });
  }

  async cancelPayment(
    tenantId: number,
    paymentId: number,
    decide: (payment: CancellablePayment, order: CancellableOrder) => CancellationPlan,
  ): Promise<number> {
    return this.prisma.$transaction(
      async (tx) => {
        const found = await tx.payment.findFirst({ where: { id: paymentId, tenantId } });
        if (!found) throw new PaymentNotFoundError();

        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${found.orderId} AND tenant_id = ${tenantId} FOR UPDATE`;
        const payment = await tx.payment.findFirst({ where: { id: found.id, tenantId } });
        const order = await tx.order.findUniqueOrThrow({ where: { id: found.orderId } });

        const plan = decide(
          {
            id: found.id,
            orderId: found.orderId,
            method: found.method,
            amount: Number(found.amount),
            cancelled: payment === null || payment.cancelled,
          },
          { id: order.id, paidAmount: Number(order.paidAmount), resultsDeliveredAt: order.resultsDeliveredAt },
        );

        await tx.payment.update({
          where: { id: plan.paymentId },
          data: {
            cancelled: true,
            cancelReason: plan.reason,
            cancelledBy: plan.cancelledBy,
            cancelledAt: plan.cancelledAt,
          },
        });
        await tx.order.update({ where: { id: plan.orderId }, data: { paidAmount: plan.newPaidAmount } });
        await tx.paymentLog.create({
          data: {
            tenantId,
            orderId: plan.orderId,
            userName: plan.log.userName,
            action: plan.log.action,
            detail: plan.log.detail,
          },
        });
        return plan.orderId;
      },
      { isolationLevel: 'ReadCommitted' },
    );
  }
}
