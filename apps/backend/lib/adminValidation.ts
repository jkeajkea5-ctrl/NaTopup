import { z } from "zod";

const id = z.string().regex(/^[a-f\d]{24}$/i);
const text = z.string().trim().min(1).max(200);
const image = z.string().trim().max(2000).refine((value) => /^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value), "Use an HTTPS URL or a local /image path");
const sort = z.number().int().min(0).max(100000);

export const adminMutation = z.discriminatedUnion("entity", [
  z.object({ entity: z.literal("game"), id, data: z.object({
    name: text, category: text, logoUrl: image, bannerUrl: image.or(z.literal("")).optional(),
    sortOrder: sort, isActive: z.boolean(), isPopular: z.boolean(),
  }).strict() }).strict(),
  z.object({ entity: z.literal("package"), id, data: z.object({
    iconUrl: image.or(z.literal("")).optional(),
    name: text, amount: text, sortOrder: sort, isActive: z.boolean(), isPopular: z.boolean(), isFeatured: z.boolean(),
    sellingPrice: z.number().finite().positive().max(100000), discount: z.number().finite().min(0).max(100000),
  }).strict().refine((data) => data.discount < data.sellingPrice, "Discount must be less than the price") }).strict(),
  z.object({ entity: z.literal("slide"), id: id.optional(), data: z.object({
    title: text, bannerUrl: image, targetUrl: z.string().max(2000).refine((value) => !value || /^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value), "Invalid target URL"),
    sortOrder: sort, isActive: z.boolean(),
  }).strict() }).strict(),
  z.object({ entity: z.literal("supplier"), id, data: z.object({ isEnabled: z.boolean(), priority: z.number().int().min(1).max(100) }).strict() }).strict(),
]);
