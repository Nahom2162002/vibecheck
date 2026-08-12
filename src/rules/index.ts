import type { RuleModule } from '../engine/types';
import { rateLimitingRule } from './rate-limiting';

export const ruleRegistry: RuleModule[] = [rateLimitingRule];
