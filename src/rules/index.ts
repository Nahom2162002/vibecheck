import type { RuleModule } from '../engine/types';
import { clientSideValidationRule } from './client-side-validation';

export const ruleRegistry: RuleModule[] = [clientSideValidationRule];
