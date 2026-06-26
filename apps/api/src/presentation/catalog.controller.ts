import { Controller, Get } from '@nestjs/common';
import { nodeCatalog } from '../domain/nodeCatalog';

@Controller('catalog')
export class CatalogController {
  @Get('nodes')
  listNodes(): Record<string, unknown> {
    return {
      nodes: nodeCatalog
    };
  }
}

