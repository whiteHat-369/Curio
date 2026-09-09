-- Repair databases created before the ApiKey composite index was applied.
CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_userId_scope_key"
ON "ApiKey"("userId", "scope");