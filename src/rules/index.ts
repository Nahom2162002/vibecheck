import type { RuleModule } from '../engine/types';
import { idorRule } from './idor';

export const ruleRegistry: RuleModule[] = [idorRule];
