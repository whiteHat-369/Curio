import type { EvidenceClaim } from "./api-store";

export interface ConfidenceBreakdown {
  sourceCount: number; // 0..1
  recency: number;
  methodStrength: number;
  consistency: number;
}

// deterministic per-id sub-scores that average to the claim confidence
function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function breakdownForClaim(claim: EvidenceClaim): ConfidenceBreakdown {
  const h = hashCode(claim.id);
  const target = claim.confidence;
  // create 4 offsets that sum to ~0 within [-0.15, 0.15]
  const o1 = ((h % 30) - 15) / 100;
  const o2 = (((h >> 3) % 30) - 15) / 100;
  const o3 = (((h >> 6) % 30) - 15) / 100;
  const o4 = -(o1 + o2 + o3);
  const clamp = (n: number) => Math.max(0.2, Math.min(0.99, n));
  return {
    sourceCount: clamp(target + o1),
    recency: clamp(target + o2),
    methodStrength: clamp(target + o3),
    consistency: clamp(target + o4),
  };
}