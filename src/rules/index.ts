import type { RuleModule } from '../engine/types';
import { sqlInjectionRule } from './sql-injection';

export const ruleRegistry: RuleModule[] = [sqlInjectionRule];
