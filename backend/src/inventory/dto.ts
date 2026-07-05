import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class AdjustStockDto {
  @IsString()
  @IsNotEmpty()
  materialId!: string;

  // Signed delta: positive adds stock, negative removes.
  @IsNumber()
  quantity!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
