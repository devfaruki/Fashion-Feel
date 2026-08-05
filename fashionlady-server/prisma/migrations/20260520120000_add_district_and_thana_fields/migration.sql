-- AlterTable
ALTER TABLE `customer`
  ADD COLUMN `district` VARCHAR(191) NULL,
  ADD COLUMN `thana` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `order`
  ADD COLUMN `district` VARCHAR(191) NULL,
  ADD COLUMN `thana` VARCHAR(191) NULL;