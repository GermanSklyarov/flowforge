import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';
import { getConfig } from './config';

const config = getConfig();
const app = await NestFactory.create(AppModule);

app.enableCors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['content-type']
});

await app.listen(config.port, config.host);
console.log(`FlowForge API listening on http://${config.host}:${config.port}`);

