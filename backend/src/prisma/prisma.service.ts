import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/** Queries slower than this are logged (SQL text only — never parameter values). */
const SLOW_QUERY_MS = 500;

@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, 'query'>
  implements OnModuleInit
{
  private readonly logger = new Logger('SlowQuery');

  constructor() {
    super({ log: [{ emit: 'event', level: 'query' }] });
  }

  async onModuleInit() {
    // Shows up in the Render logs, so a slow entry can be traced to the exact statement
    // (or to a slow connection) instead of guessing.
    this.$on('query', (e) => {
      if (e.duration >= SLOW_QUERY_MS) {
        this.logger.warn(`${e.duration}ms ${e.query.replace(/\s+/g, ' ').slice(0, 200)}`);
      }
    });
    await this.$connect();
  }
}
