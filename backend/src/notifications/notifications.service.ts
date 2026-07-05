import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationType, PartyType, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LedgerService } from '../accounts/ledger.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private ledger: LedgerService,
  ) {}

  listForUser(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  async markRead(id: string, userId: string) {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n || n.userId !== userId) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({ where: { id }, data: { isRead: true } });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  /**
   * Create in-app payment-reminder notifications for every customer that still
   * owes money, addressed to all admins/super-admins. Skips a customer for whom
   * an unread reminder already exists (no duplicate nagging).
   */
  async generatePaymentReminders() {
    const [outstanding, admins] = await Promise.all([
      this.ledger.outstanding(PartyType.CUSTOMER),
      this.prisma.user.findMany({
        where: { isActive: true, role: { in: [Role.SUPER_ADMIN, Role.ADMIN] } },
        select: { id: true },
      }),
    ]);

    let created = 0;
    for (const cust of outstanding) {
      for (const admin of admins) {
        const existing = await this.prisma.notification.findFirst({
          where: {
            userId: admin.id,
            type: NotificationType.PAYMENT_REMINDER,
            refId: cust.id,
            isRead: false,
          },
        });
        if (existing) continue;
        await this.prisma.notification.create({
          data: {
            userId: admin.id,
            type: NotificationType.PAYMENT_REMINDER,
            title: `Payment due: ${cust.name}`,
            body: `${cust.name} has an outstanding balance of ₹${cust.balance.toFixed(2)}.`,
            refType: 'CUSTOMER',
            refId: cust.id,
          },
        });
        created++;
      }
    }
    this.logger.log(`Generated ${created} payment reminder(s) for ${outstanding.length} customer(s)`);
    return { customers: outstanding.length, notificationsCreated: created };
  }

  /** Daily at 09:00 IST. */
  @Cron('0 9 * * *', { timeZone: 'Asia/Kolkata' })
  async dailyReminderJob() {
    this.logger.log('Running daily payment-reminder job');
    await this.generatePaymentReminders();
  }
}
