import { prisma } from "./prisma.js";
import { NotFoundError, ForbiddenError } from "./errors.js";
import type { Workspace } from "@prisma/client";

/**
 * Asserts that a workspace exists and is owned by the specified user.
 * Throws 404 NotFoundError if the workspace does not exist.
 * Throws 403 ForbiddenError if the workspace exists but belongs to another user.
 */
export async function assertWorkspaceOwner(workspaceId: string, userId: string): Promise<void> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, ownerId: true },
  });

  if (!workspace) {
    throw new NotFoundError("Workspace not found");
  }

  if (workspace.ownerId !== userId) {
    throw new ForbiddenError("You do not have access to this workspace");
  }
}

/**
 * Retrieves a workspace and verifies that the specified user is the owner.
 * Throws 404 NotFoundError if nonexistent, 403 ForbiddenError if not owner.
 */
export async function getWorkspaceWithOwnerCheck(workspaceId: string, userId: string): Promise<Workspace> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  if (!workspace) {
    throw new NotFoundError("Workspace not found");
  }

  if (workspace.ownerId !== userId) {
    throw new ForbiddenError("You do not have access to this workspace");
  }

  return workspace;
}