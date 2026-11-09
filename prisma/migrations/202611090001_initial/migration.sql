CREATE TABLE "Account" ("id" TEXT NOT NULL PRIMARY KEY DEFAULT 'owner', "hash" TEXT NOT NULL);
CREATE TABLE "Session" ("id" TEXT NOT NULL PRIMARY KEY, "expires" BIGINT NOT NULL);
CREATE INDEX "Session_expires_idx" ON "Session"("expires");
CREATE TABLE "Record" ("id" TEXT NOT NULL PRIMARY KEY, "rev" INTEGER NOT NULL DEFAULT 1, "payload" TEXT NOT NULL, "updated" BIGINT NOT NULL);
CREATE INDEX "Record_updated_idx" ON "Record"("updated");
