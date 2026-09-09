import { describe, it, expect, vi, beforeEach } from "vitest";
import { assertWorkspaceOwner, getWorkspaceWithOwnerCheck } from "./workspace-access.js";
import { prisma } from "./prisma.js";
import { NotFoundError, ForbiddenError } from "./errors.js";

vi.mock("./prisma.js", () => ({
  prisma: {
    workspace: {
      findUnique: vi.fn(),
    },
  },
}));

describe("workspace access authorization checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("assertWorkspaceOwner", () => {
    it("should resolve cleanly when user is the owner of the workspace", async () => {
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
        id: "ws-123",
        ownerId: "user-abc",
      } as any);

      await expect(assertWorkspaceOwner("ws-123", "user-abc")).resolves.toBeUndefined();
    });

    it("should throw NotFoundError (404) when the workspace does not exist", async () => {
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

      await expect(assertWorkspaceOwner("non-existent-id", "user-abc")).rejects.toThrow(NotFoundError);
    });

    it("should throw ForbiddenError (403) when the workspace exists but is owned by another user", async () => {
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
        id: "ws-123",
        ownerId: "other-user-xyz",
      } as any);

      await expect(assertWorkspaceOwner("ws-123", "user-abc")).rejects.toThrow(ForbiddenError);
    });
  });

  describe("getWorkspaceWithOwnerCheck", () => {
    it("should return the workspace object when the user is the owner", async () => {
      const mockWorkspace = {
        id: "ws-123",
        name: "Test Workspace",
        ownerId: "user-abc",
        question: "Research Question",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(mockWorkspace as any);

      const result = await getWorkspaceWithOwnerCheck("ws-123", "user-abc");
      expect(result).toEqual(mockWorkspace);
    });

    it("should throw NotFoundError when workspace does not exist", async () => {
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

      await expect(getWorkspaceWithOwnerCheck("non-existent-id", "user-abc")).rejects.toThrow(NotFoundError);
    });

    it("should throw ForbiddenError when workspace exists but belongs to another user", async () => {
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
        id: "ws-123",
        name: "Private Workspace",
        ownerId: "user-other",
      } as any);

      await expect(getWorkspaceWithOwnerCheck("ws-123", "user-abc")).rejects.toThrow(ForbiddenError);
    });
  });
});
