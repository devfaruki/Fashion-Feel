/*
  Centralized PrismaClient wrapper to pass either `adapter` (direct DB) or `accelerateUrl` (Prisma Accelerate)
  to the PrismaClient constructor. This keeps the application code simple and adapts to Prisma v7's client config.
*/
const { PrismaClient } = require('@prisma/client');

const adapterUrl = process.env.DATABASE_URL;
const accelerateUrl = process.env.PRISMA_ACCELERATE_URL;

const clientConfig = {};
if (accelerateUrl) {
  // Use Prisma Accelerate URL when present
  clientConfig.accelerateUrl = accelerateUrl;
} else if (adapterUrl) {
  // Use datasourceUrl for direct connection; this avoids enabling preview features
  clientConfig.datasourceUrl = adapterUrl;
}

// Optional logging config
if (process.env.PRISMA_CLIENT_LOG_LEVEL) {
  clientConfig.log = [{ level: process.env.PRISMA_CLIENT_LOG_LEVEL }];
}

const prisma = new PrismaClient(clientConfig);
module.exports = prisma;
