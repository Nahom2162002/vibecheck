import type { RuleModule } from '../engine/types';
import { corsRule } from './cors';

export const ruleRegistry: RuleModule[] = [corsRule];
