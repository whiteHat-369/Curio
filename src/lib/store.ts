/**
 * Unified store — re-exports the API-powered store so all components
 * use real backend data instead of mock data.
 */
import { useApiStore, usePaper, useWorkspace } from "./api-store";

// Re-export the API store as the single source of truth
export const useStore = useApiStore;
export { usePaper, useWorkspace };

// Keep type exports for compatibility
export type { PaperWithMeta, Workspace, EvidenceClaim, ChatMessage, PaperSummary, Annotation, ImportDatabase, UploadingPaper } from "./api-store";
export type { ReadingStatus } from "./mock-data";
export type { ConfidenceBreakdown } from "./store-types";

// Re-export breakdownForClaim from a shared location
export { breakdownForClaim } from "./store-types";