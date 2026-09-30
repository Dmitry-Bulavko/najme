import { Controller, Get, Header, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  type CategoriesResponse,
  type ListCategoriesQuery,
  listCategoriesQuerySchema,
} from '@najme/contracts';
import { Public } from '../auth/public.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { CategoriesService } from './categories.service.js';

@Public()
@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOkResponse({ description: 'Platform category catalogue for the requested locale.' })
  list(
    @Query(new ZodValidationPipe(listCategoriesQuerySchema)) query: ListCategoriesQuery,
  ): Promise<CategoriesResponse> {
    return this.categories.list(query.locale);
  }
}
