import { z } from 'zod';
import { accountTypeSchema, institutionTypeSchema } from '../enums.js';

export const institutionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: institutionTypeSchema,
  country: z.string().length(2).default('ES'),
  bic: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  iconKey: z.string().optional().nullable(),
});
export type Institution = z.infer<typeof institutionSchema>;

export const accountSchema = z.object({
  id: z.string().uuid(),
  institutionId: z.string().uuid(),
  name: z.string(),
  type: accountTypeSchema,
  currency: z.string().length(3).default('EUR'),
  ibanLast4: z.string().length(4).optional().nullable(),
  isActive: z.boolean(),
});
export type Account = z.infer<typeof accountSchema>;

export const accountWithInstitutionSchema = accountSchema.extend({
  institution: institutionSchema,
  currentBalance: z.string(),
});
export type AccountWithInstitution = z.infer<typeof accountWithInstitutionSchema>;
