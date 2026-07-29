import { z } from "zod";

export const createInviteSchema = z.object({});
export const acceptInviteSchema = z.object({ token: z.string().min(1) });
