-- QR image for a Payment account (#298): a reference to a private File, never the image.
ALTER TABLE "PaymentAccount" ADD COLUMN "qrFileId" TEXT;
