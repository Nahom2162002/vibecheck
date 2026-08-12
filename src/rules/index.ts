import type { RuleModule } from '../engine/types';

// Feature branches add their rule module to this array. Kept as an empty
// array on the scaffold so the engine/CLI loop runs end-to-end with zero
// findings before any check exists.
export const ruleRegistry: RuleModule[] = [];
