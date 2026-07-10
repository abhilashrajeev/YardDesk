import { ArgumentsHost, Catch, ConflictException, ExceptionFilter, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Safety net for Prisma errors that slip past explicit service-level checks —
 * without this, a duplicate unique field or a dangling foreign key crashes
 * with a raw 500 instead of a clean 4xx.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const mapped = this.map(exception);
    const response = host.switchToHttp().getResponse();
    response.status(mapped.getStatus()).json(mapped.getResponse());
  }

  private map(exception: Prisma.PrismaClientKnownRequestError) {
    switch (exception.code) {
      case 'P2002': {
        const target = (exception.meta?.target as string[] | undefined)?.join(', ');
        return new ConflictException(
          target ? `A record with this ${target} already exists.` : 'A record with these details already exists.',
        );
      }
      case 'P2003':
        return new BadRequestException('This references a record that no longer exists.');
      case 'P2025':
        return new NotFoundException('Record not found.');
      default:
        return new BadRequestException('The request could not be completed.');
    }
  }
}
