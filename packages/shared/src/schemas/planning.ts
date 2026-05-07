import { z } from 'zod';
import { certaintySchema, plannedEventKindSchema, recurringFrequencySchema } from '../enums.js';
import { decimalString } from './transaction.js';

export const goalStatusSchema = z.enum(['active', 'achieved', 'abandoned']);
export type GoalStatus = z.infer<typeof goalStatusSchema>;

export const goalSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  targetAmount: decimalString,
  currency: z.string().length(3),
  targetDate: z.string().date().nullable(),
  currentAmount: decimalString,
  monthlyContributionTarget: decimalString.nullable(),
  linkedAccountId: z.string().uuid().nullable(),
  priority: z.number().int(),
  status: goalStatusSchema,
  notes: z.string().nullable(),
});
export type Goal = z.infer<typeof goalSchema>;

export const goalEnrichedSchema = goalSchema.extend({
  // Months elapsed since creation, useful for forecast plot.
  // Months until targetDate (null if no targetDate).
  monthsToTarget: z.number().int().nullable(),
  // Required monthly contribution to hit target on time given current
  // balance + zero growth assumption.
  requiredMonthly: decimalString.nullable(),
  // Progress 0-100.
  progressPct: z.number(),
  onTrack: z.boolean(),
});
export type GoalEnriched = z.infer<typeof goalEnrichedSchema>;

export const createGoalInputSchema = z.object({
  name: z.string().min(1).max(200),
  targetAmount: decimalString,
  currency: z.string().length(3).default('EUR'),
  targetDate: z.string().date().nullable().optional(),
  currentAmount: decimalString.default('0'),
  monthlyContributionTarget: decimalString.nullable().optional(),
  linkedAccountId: z.string().uuid().nullable().optional(),
  priority: z.number().int().default(0),
  notes: z.string().max(2000).nullable().optional(),
});
export type CreateGoalInput = z.infer<typeof createGoalInputSchema>;

export const updateGoalInputSchema = createGoalInputSchema
  .extend({ status: goalStatusSchema })
  .partial();
export type UpdateGoalInput = z.infer<typeof updateGoalInputSchema>;

export const plannedEventStatusSchema = z.enum(['planned', 'confirmed', 'executed', 'cancelled']);
export type PlannedEventStatus = z.infer<typeof plannedEventStatusSchema>;

export const plannedEventSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  kind: plannedEventKindSchema,
  amount: decimalString,
  currency: z.string().length(3),
  scheduledAt: z.string().date(),
  recurrenceFrequency: recurringFrequencySchema.nullable(),
  recurrenceUntil: z.string().date().nullable(),
  certainty: certaintySchema,
  categoryId: z.string().uuid().nullable(),
  accountId: z.string().uuid().nullable(),
  goalId: z.string().uuid().nullable(),
  notes: z.string().nullable(),
  status: plannedEventStatusSchema,
});
export type PlannedEvent = z.infer<typeof plannedEventSchema>;

export const createPlannedEventInputSchema = z.object({
  name: z.string().min(1).max(200),
  kind: plannedEventKindSchema,
  amount: decimalString,
  currency: z.string().length(3).default('EUR'),
  scheduledAt: z.string().date(),
  recurrenceFrequency: recurringFrequencySchema.nullable().optional(),
  recurrenceUntil: z.string().date().nullable().optional(),
  certainty: certaintySchema.default('medium'),
  categoryId: z.string().uuid().nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
  goalId: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type CreatePlannedEventInput = z.infer<typeof createPlannedEventInputSchema>;

export const updatePlannedEventInputSchema = createPlannedEventInputSchema
  .extend({ status: plannedEventStatusSchema })
  .partial();
export type UpdatePlannedEventInput = z.infer<typeof updatePlannedEventInputSchema>;
