import type { RuleModule } from '../engine/types';
import { clientSideValidationRule } from './client-side-validation';

export const ruleRegistry: RuleModule[] = [clientSideValidationRule];
import { idorRule } from './idor';

export const ruleRegistry: RuleModule[] = [idorRule];
