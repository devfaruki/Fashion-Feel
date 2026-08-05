-- AlterTable
ALTER TABLE `order` ADD COLUMN `stockFinalized` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `stockReserved` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `product` ADD COLUMN `lowStockThreshold` INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN `stockQty` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `stockReserved` INTEGER NOT NULL DEFAULT 0;
