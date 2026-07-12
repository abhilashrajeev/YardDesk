import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProductionInputDto {
  @IsString()
  @IsNotEmpty()
  materialId!: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;
}

export class CreateProductionDto {
  @IsString()
  @IsNotEmpty()
  materialId!: string; // output material (e.g. GSP)

  @IsNumber()
  @Min(0.001)
  quantity!: number; // quantity of output produced

  // Overrides the auto-computed weighted-average cost per unit, if provided.
  @IsOptional()
  @IsNumber()
  @Min(0)
  costPerUnit?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProductionInputDto)
  inputs!: ProductionInputDto[];

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateProductionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  materialId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.001)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPerUnit?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProductionInputDto)
  inputs?: ProductionInputDto[];

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
