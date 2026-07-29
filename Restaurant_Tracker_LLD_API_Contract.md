# Low-Level Design (LLD)
## Backend API Contract — "Our Table"

**Companion to:** Restaurant_Tracker_PRD.md, Restaurant_Tracker_HLD.md
**Scope:** The complete contract for every backend entry point — Server Actions (mutations), Query functions (reads used by Server Components), and Route Handlers (the small set of true HTTP endpoints). Out of scope: UI components, styling, deployment.

---

## 1. Conventions

### 1.1 Two kinds of backend surface
| Surface | Used for | Where it lives |
|---|---|---|
| **Server Actions** | All mutations (create/update/delete) invoked from forms/client components | `lib/actions/*.ts`, `"use server"` |
| **Query functions** | All reads, called directly from Server Components (no client-side fetch) | `lib/queries/*.ts`, plain async functions |
| **Route Handlers** | The few things that must be true HTTP endpoints: Auth.js, push subscription, signed photo upload, internal cron trigger | `app/api/**/route.ts` |

Server Actions and Query functions are **not versioned URLs** — they're TypeScript functions called via Next.js's RPC mechanism, so "the contract" is the function signature (input type → output type), not a REST path. This document specifies each one as if it were an endpoint, because that's the level of stability callers should treat it with.

### 1.2 Auth context (implicit on every call)
Every Server Action and Query function begins by resolving:
```ts
type AuthContext = {
  userId: string;       // the calling user's id
  householdId: string;  // resolved from session, NEVER accepted as a function argument
};
```
via `requireAuthContext()` (throws `UNAUTHORIZED` if no session). **No action or query accepts `householdId` as an input parameter** — this is the core rule that prevents cross-household data access (see HLD §6.1). Any `restaurantId`/`visitId` etc. passed in is validated to belong to `householdId` before use (`NOT_FOUND` returned otherwise — not `FORBIDDEN`, to avoid leaking existence of other households' data).

### 1.3 Standard result envelope (Server Actions)
```ts
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: ActionError };

type ActionError = {
  code: ErrorCode;
  message: string;             // safe to show the user
  fieldErrors?: Record<string, string[]>; // present when code = "VALIDATION_ERROR"
};

type ErrorCode =
  | "UNAUTHORIZED"       // no session
  | "NOT_FOUND"          // record doesn't exist or isn't in caller's household
  | "VALIDATION_ERROR"   // zod parse failure
  | "CONFLICT"           // e.g. duplicate rating, duplicate invite accept
  | "RATE_LIMITED"
  | "INTERNAL";
```
Every Server Action returns `ActionResult<T>` — it never throws to the client for expected failure modes (validation, not-found, conflict). Unexpected exceptions are caught at the action boundary, logged server-side, and surfaced as `{ success: false, error: { code: "INTERNAL", message: "Something went wrong." } }`.

### 1.4 IDs, timestamps, decimals
- All primary keys: `cuid2` strings (e.g. `"tz4a98xxat96iws9zmbrgj3a"`).
- All timestamps in/out: ISO 8601 strings (`2026-07-29T18:30:00.000Z`) at the contract boundary, even though Drizzle stores `timestamp`.
- Money and lat/lng: transported as `string` (matching Postgres `numeric`) to avoid float rounding; parsed to `number` only for display.

### 1.5 Pagination (query functions returning lists)
Cursor-based, consistent shape:
```ts
type Page<T> = {
  items: T[];
  nextCursor: string | null; // pass back in as `cursor` to get the next page; null = no more
};
type PageParams = { cursor?: string; limit?: number /* default 20, max 100 */ };
```

### 1.6 Zod as the single source of truth
Every mutation input has a Zod schema in `lib/validations/*.ts`. The same schema is used:
1. Client-side, via `react-hook-form` resolver (fast feedback)
2. Server-side, as the first line of the Server Action (source of truth — client validation is a UX nicety, never trusted alone)

---

## 2. Restaurant Contract

### 2.1 Schema
```ts
// lib/validations/restaurant.ts
export const priceRangeSchema = z.enum(["LOW", "MID", "HIGH", "LUXE"]);
export const restaurantStatusSchema = z.enum(["WISHLIST", "VISITED", "PLANNED"]);
export const opinionTagSchema = z.enum(["FAVORITE", "LIKE_IT", "SOK", "HAVENT_TRIED", "DISLIKE"]);
export const tagCategorySchema = z.enum(["VIBE", "FOOD_TYPE", "METHOD"]);

export const createRestaurantSchema = z.object({
  name: z.string().min(1).max(200),
  priceRange: priceRangeSchema.optional(),
  website: z.string().url().optional(),
  phone: z.string().max(30).optional(),
  address: z.string().max(300).optional(),
  lat: z.string().optional(),          // stringified decimal, from Nominatim lookup
  lng: z.string().optional(),
  neighborhood: z.string().max(100).optional(),
  area: z.string().max(100).optional(),
  supportsDelivery: z.boolean().default(false),
  supportsDineIn: z.boolean().default(false),
  supportsTakeout: z.boolean().default(false),
  menuUrl: z.string().url().optional(),
  notes: z.string().max(2000).optional(),
  tagIds: z.array(z.string()).max(30).default([]),   // existing tags to attach on create
  newTagNames: z.array(z.object({ name: z.string().min(1).max(50), category: tagCategorySchema })).max(10).default([]),
});

export const updateRestaurantSchema = createRestaurantSchema.partial().extend({
  id: z.string(),
  status: restaurantStatusSchema.optional(),
});

export const setRestaurantOpinionSchema = z.object({
  restaurantId: z.string(),
  tag: opinionTagSchema,
});
```

### 2.2 Server Actions
```ts
// lib/actions/restaurant-actions.ts
async function createRestaurant(input: z.infer<typeof createRestaurantSchema>)
  : Promise<ActionResult<{ id: string }>>;
// Side effects: fuzzy-duplicate check (pg_trgm similarity on name+address, threshold 0.6) —
//   on match, returns success:false, error.code = "CONFLICT",
//   error.message includes the matched restaurant id so the UI can offer "use existing instead".
//   Caller can force-create by resubmitting with { ...input, forceCreate: true }.

async function updateRestaurant(input: z.infer<typeof updateRestaurantSchema>)
  : Promise<ActionResult<{ id: string }>>;
// NOT_FOUND if id not in caller's household.

async function deleteRestaurant(input: { id: string })
  : Promise<ActionResult<{ id: string }>>;
// CONFLICT if the restaurant has any visits — restaurants with visit history are archived
// (status stays, but excluded from Explore/Map via a soft `archivedAt` — see open question §7.1),
// never hard-deleted while visits reference it (FK integrity).

async function setRestaurantOpinion(input: z.infer<typeof setRestaurantOpinionSchema>)
  : Promise<ActionResult<{ restaurantId: string; tag: OpinionTag }>>;
// Upsert on (restaurantId, userId=caller). Idempotent — resubmitting the same tag is a no-op success.

async function attachRestaurantTags(input: { restaurantId: string; tagIds: string[] })
  : Promise<ActionResult<{ restaurantId: string }>>;
async function removeRestaurantTag(input: { restaurantId: string; tagId: string })
  : Promise<ActionResult<{ restaurantId: string }>>;
```

### 2.3 Query functions
```ts
// lib/queries/restaurant-queries.ts
type RestaurantSummary = {
  id: string; name: string; priceRange: PriceRange | null;
  neighborhood: string | null; status: RestaurantStatus;
  primaryPhotoUrl: string | null;
  averageRating: number | null;    // computed, see §6
  visitCount: number;              // computed
  tags: { id: string; name: string; category: TagCategory }[];
};

async function listRestaurants(filters: {
  cuisine?: string;          // matches a FOOD_TYPE tag name
  neighborhood?: string;
  status?: RestaurantStatus;
  sort?: "rating_desc" | "recent" | "name_asc";
} & PageParams): Promise<Page<RestaurantSummary>>;

async function searchRestaurants(query: string, limit = 10): Promise<RestaurantSummary[]>;
// matches name, cuisine tag, or ordered-item dish name (ILIKE + trigram similarity)

async function getRestaurantDetail(id: string): Promise<RestaurantDetail | null>;
type RestaurantDetail = RestaurantSummary & {
  website: string | null; phone: string | null; address: string | null;
  lat: string | null; lng: string | null; menuUrl: string | null; notes: string | null;
  supportsDelivery: boolean; supportsDineIn: boolean; supportsTakeout: boolean;
  averageBill: string | null;      // computed
  lastVisitDate: string | null;    // computed
  opinions: { userId: string; tag: OpinionTag }[];
};

async function listRestaurantsForMap(bounds?: { north: number; south: number; east: number; west: number })
  : Promise<Array<Pick<RestaurantSummary,"id"|"name"|"status"|"averageRating"> & { lat: string; lng: string }>>;
```

---

## 3. Visit Contract

### 3.1 Schema
```ts
// lib/validations/visit.ts
export const mealSchema = z.enum(["BREAKFAST", "LUNCH", "DINNER"]);
export const dineTypeSchema = z.enum(["DINE_IN", "DELIVERY", "TAKEOUT"]);
export const visitStatusSchema = z.enum(["PLANNED", "COMPLETED"]);
export const paymentSplitSchema = z.enum(["EQUAL", "INDIVIDUAL", "ONE_PAID"]);

export const createVisitSchema = z.object({
  restaurantId: z.string(),
  visitDate: z.string().datetime(),        // ISO date; time-of-day may be midnight if visitTime is separate
  visitTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  meal: mealSchema.optional(),
  dineType: dineTypeSchema.optional(),
  occasion: z.string().max(100).optional(),
  partySize: z.number().int().min(1).max(50).optional(),
  seating: z.string().max(50).optional(),
  status: visitStatusSchema,               // caller decides: "log a visit that happened" vs "plan a future one"
})
.refine(v => v.status !== "PLANNED" || new Date(v.visitDate) >= new Date(),
  { message: "Planned visits must be dated today or later", path: ["visitDate"] });

export const updateVisitSchema = createVisitSchema.partial().extend({ id: z.string() });

export const billSchema = z.object({
  visitId: z.string(),
  subtotal: z.string().optional(),
  tip: z.string().optional(),
  totalPaid: z.string().optional(),
  paymentSplit: paymentSplitSchema.optional(),
  paymentMethod: z.string().max(100).optional(),
});

export const rescheduleVisitSchema = z.object({
  id: z.string(),
  visitDate: z.string().datetime(),
  visitTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});
```

### 3.2 Server Actions
```ts
// lib/actions/visit-actions.ts
async function createVisit(input: z.infer<typeof createVisitSchema>)
  : Promise<ActionResult<{ id: string; status: VisitStatus }>>;
// Also sets restaurant.status = "VISITED" if status="COMPLETED" and it was "WISHLIST",
// or "PLANNED" if status="PLANNED" and restaurant was "WISHLIST" (does not downgrade an already-VISITED restaurant).

async function updateVisit(input: z.infer<typeof updateVisitSchema>)
  : Promise<ActionResult<{ id: string }>>;

async function rescheduleVisit(input: z.infer<typeof rescheduleVisitSchema>)
  : Promise<ActionResult<{ id: string; visitDate: string }>>;
// NOT_FOUND if visit isn't status="PLANNED" (rescheduling a completed visit is just updateVisit).

async function cancelVisit(input: { id: string })
  : Promise<ActionResult<{ id: string }>>;
// Hard-deletes if status="PLANNED" (nothing else references a planned visit yet).
// CONFLICT if status="COMPLETED" — completed visits are never deleted via this action (see FR-2.5 — edit, not delete a logged visit's core facts; deletion of a completed visit, if ever needed, is a separate admin-only path, out of v1 scope).

async function completeVisit(input: { id: string; confirmed: boolean })
  : Promise<ActionResult<{ id: string; status: "COMPLETED" }>>;
// Transitions status PLANNED -> COMPLETED. `confirmed: false` is used by the auto-transition
// path (§5.4) to distinguish "system auto-completed" from "user tapped confirm" in audit logs;
// contract/behavior is otherwise identical.

async function setBill(input: z.infer<typeof billSchema>)
  : Promise<ActionResult<{ visitId: string; totalPaid: string | null }>>;
```

### 3.3 Query functions
```ts
// lib/queries/visit-queries.ts
type VisitListItem = {
  id: string; restaurantId: string; restaurantName: string;
  visitDate: string; meal: Meal | null; occasion: string | null;
  status: VisitStatus; coupleAverageRating: number | null; // avg of all VisitRatings on this visit
  photoThumbnails: string[]; totalPaid: string | null;
};

async function listVisitsForRestaurant(restaurantId: string, params: PageParams)
  : Promise<Page<VisitListItem>>;

async function getVisitDetail(id: string): Promise<VisitDetail | null>;
type VisitDetail = VisitListItem & {
  visitTime: string | null; dineType: DineType | null; partySize: number | null;
  seating: string | null; subtotal: string | null; tip: string | null;
  paymentSplit: PaymentSplit | null; paymentMethod: string | null;
  createdById: string; orderedItems: OrderedItemDto[]; photos: PhotoDto[];
  ratings: VisitRatingDto[];    // 0, 1, or 2 entries
};

async function listUpcomingVisits(limit = 5): Promise<VisitListItem[]>;
// status = "PLANNED", visitDate >= now, sorted asc — powers Home dashboard.

async function listVisitsInRange(start: string, end: string)
  : Promise<VisitListItem[]>;
// powers Calendar/Timeline view (§ HLD 6.5); both PLANNED and COMPLETED included.

async function listVisitsMissingMyRating(limit = 10): Promise<VisitListItem[]>;
// status="COMPLETED" AND no VisitRating row for caller's userId — powers the Home badge (NFR-7 fallback).
```

---

## 4. Ordered Item Contract

```ts
// lib/validations/ordered-item.ts
export const orderedItemSchema = z.object({
  visitId: z.string(),
  dishName: z.string().min(1).max(150),
  price: z.string().optional(),
  shared: z.boolean().default(true),
  orderedById: z.string().optional(),      // required if shared=false; validated server-side
  wouldOrderAgain: z.boolean().optional(),
}).refine(v => v.shared || !!v.orderedById,
  { message: "orderedById is required when shared=false", path: ["orderedById"] });

export const updateOrderedItemSchema = orderedItemSchema.partial().extend({ id: z.string() });
```

```ts
// lib/actions/ordered-item-actions.ts
async function addOrderedItem(input: z.infer<typeof orderedItemSchema>)
  : Promise<ActionResult<{ id: string }>>;
async function updateOrderedItem(input: z.infer<typeof updateOrderedItemSchema>)
  : Promise<ActionResult<{ id: string }>>;
async function removeOrderedItem(input: { id: string })
  : Promise<ActionResult<{ id: string }>>;
```
Query: ordered items are returned inline as part of `getVisitDetail` (§3.3) — no standalone list query, since they're never browsed independent of a visit.

---

## 5. Rating Contract

### 5.1 Schema
```ts
// lib/validations/rating.ts
export const wouldReturnSchema = z.enum(["YES", "MAYBE", "NO"]);
const starScore = z.number().int().min(1).max(5).optional();

export const submitRatingSchema = z.object({
  visitId: z.string(),
  overallRating: z.number().min(0).max(10).multipleOf(0.5),
  food: starScore, service: starScore, atmosphere: starScore, value: starScore,
  drinks: starScore, presentation: starScore, waitingTime: starScore, cleanliness: starScore,
  wouldReturn: wouldReturnSchema.optional(),
  favoriteDishId: z.string().optional(),
  reviewText: z.string().max(2000).optional(),
});
```

### 5.2 Server Actions
```ts
// lib/actions/rating-actions.ts
async function submitVisitRating(input: z.infer<typeof submitRatingSchema>)
  : Promise<ActionResult<{ id: string }>>;
// Upsert on (visitId, userId=caller) — matches PRD unique constraint, so this action doubles as
// both "submit" and "edit" (FR-3.1/3.2); the caller doesn't need to know which case they're in.
// NOT_FOUND if the visit's status != "COMPLETED" (can't rate a visit that hasn't happened —
// planned visits reject with VALIDATION_ERROR: "Visit must be marked completed before rating").
// Side effect: on first insert (not update) for this visit, enqueues a partner notification
// if the other household user has no VisitRating on this visit yet (NFR-7 / FR-3.4).

async function updateVisitRating(input: z.infer<typeof submitRatingSchema>)
  : Promise<ActionResult<{ id: string }>>;
// Alias of submitVisitRating for callers where "edit" is the clearer intent; identical behavior,
// kept as two names for readability at call sites, not two implementations.
```

### 5.3 Query functions
```ts
// lib/queries/rating-queries.ts
type VisitRatingDto = {
  id: string; userId: string; overallRating: number;
  food: number | null; service: number | null; atmosphere: number | null; value: number | null;
  drinks: number | null; presentation: number | null; waitingTime: number | null; cleanliness: number | null;
  wouldReturn: WouldReturn | null; favoriteDishId: string | null; reviewText: string | null;
};

async function getRestaurantRatingComparison(restaurantId: string)
  : Promise<{
      perUserAverages: Array<{ userId: string; displayName: string; avgOverall: number;
        avgByCategory: Record<"food"|"service"|"atmosphere"|"value"|"drinks"|"presentation"|"waitingTime"|"cleanliness", number | null> }>;
      recentReviews: Array<{ userId: string; visitId: string; visitDate: string; reviewText: string | null }>;
    }>;
// Powers the "Reviews (Side by Side)" screen. Averages computed across ALL of that restaurant's
// visits, not filterable to a single visit in v1 — filtering to one visit reads getVisitDetail().ratings instead.
```

---

## 6. Computed / Derived Value Contract

These aren't stored fields — documenting the exact computation so read-query implementations stay consistent:

| Field | Definition |
|---|---|
| `Restaurant.averageRating` | `AVG(VisitRating.overallRating)` across all `VisitRating` rows joined through `Visit` for that restaurant. `null` if zero ratings exist. |
| `Restaurant.visitCount` | `COUNT(Visit)` where `status = 'COMPLETED'` for that restaurant. Planned visits excluded. |
| `Restaurant.lastVisitDate` | `MAX(Visit.visitDate)` where `status = 'COMPLETED'`. |
| `Restaurant.averageBill` | `AVG(Visit.totalPaid)` where `totalPaid IS NOT NULL`. |
| `Visit.coupleAverageRating` | `AVG(VisitRating.overallRating)` for that single visit's rating rows (0, 1, or 2 of them). `null` if none yet. |
| Smart list: **Top Rated** | `Restaurant.averageRating >= 8.0` (threshold confirmed, was open question in HLD §8.4 — **resolved: 8.0/10**), sorted desc. |
| Smart list: **Hidden Gems** | `averageRating >= 8.0 AND visitCount <= 2`. |
| Smart list: **Most Visited** | sorted by `visitCount` desc, top N. |
| Smart list: **Date Night Spots** | has a `RestaurantTag` joined to a `Tag` where `name = 'Date Night'` and `category = 'VIBE'`. |
| Smart list: **To Revisit** | `Restaurant.notes` unused for this — uses an explicit boolean, see §7.2 open item (not yet in schema). |
| Smart list: **Not Visited in 1+ Year** | `lastVisitDate IS NOT NULL AND lastVisitDate < NOW() - INTERVAL '365 days'`. |

---

## 7. List (Collections) Contract

```ts
// lib/validations/list.ts
export const listTypeSchema = z.enum(["MANUAL", "SMART"]);
export const createListSchema = z.object({
  name: z.string().min(1).max(80),
  icon: z.string().max(10).optional(),
});
export const renameListSchema = z.object({ id: z.string(), name: z.string().min(1).max(80) });
export const toggleListItemSchema = z.object({ listId: z.string(), restaurantId: z.string(), add: z.boolean() });
```

```ts
// lib/actions/list-actions.ts
async function createList(input: z.infer<typeof createListSchema>)
  : Promise<ActionResult<{ id: string }>>;
// Always creates type="MANUAL" — the six built-in SMART lists are seeded once per household
// (household-actions.seedDefaultLists, called from acceptHouseholdInvite / household creation),
// not creatable/deletable by users in v1.

async function renameList(input: z.infer<typeof renameListSchema>): Promise<ActionResult<{ id: string }>>;
// NOT_FOUND / CONFLICT("Cannot rename a smart list") if type="SMART".

async function deleteList(input: { id: string }): Promise<ActionResult<{ id: string }>>;
// Same SMART-list guard as renameList.

async function toggleListItem(input: z.infer<typeof toggleListItemSchema>)
  : Promise<ActionResult<{ listId: string; restaurantId: string; isMember: boolean }>>;
```

```ts
// lib/queries/list-queries.ts
async function listLists(): Promise<Array<{ id: string; name: string; type: ListType; icon: string | null; restaurantCount: number }>>;
async function getListResults(listId: string, params: PageParams): Promise<Page<RestaurantSummary>>;
// For type="SMART", dispatches to the matching function in lib/smart-lists.ts (§6 table) rather than reading ListItem.
```

---

## 8. Photo Contract

```ts
// lib/validations/photo.ts
export const requestUploadSchema = z.object({
  fileName: z.string().max(200),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic"]),
  fileSizeBytes: z.number().max(15 * 1024 * 1024), // 15MB cap
});
export const attachPhotoSchema = z.object({
  objectUrl: z.string().url(),
  visitId: z.string().optional(),
  restaurantId: z.string().optional(),
}).refine(v => !!v.visitId !== !!v.restaurantId,
  { message: "Exactly one of visitId or restaurantId is required" });
```

```ts
// lib/actions/photo-actions.ts
async function attachPhoto(input: z.infer<typeof attachPhotoSchema>)
  : Promise<ActionResult<{ id: string; url: string }>>;
// Called AFTER the client has already uploaded bytes directly to R2 via the signed URL
// from the Route Handler in §9.3 — this action just records the resulting object as a Photo row.

async function removePhoto(input: { id: string }): Promise<ActionResult<{ id: string }>>;
// Deletes the DB row; the R2 object itself is garbage-collected async (a periodic job in the
// `worker` container removes R2 objects with no matching Photo row older than 24h) rather than
// deleted synchronously in this action — keeps the action fast and tolerant of R2 hiccups.
```

---

## 9. Route Handlers (true HTTP endpoints)

These are the only parts of the backend with a conventional REST-style contract, because they're called from outside a Server Component/Action context (browser fetch, service worker, or an internal scheduler).

### 9.1 `POST/GET /api/auth/[...nextauth]`
Delegated entirely to Auth.js — not hand-specified here. Session cookie is the auth mechanism for every other endpoint below.

### 9.2 `POST /api/push/subscribe`
| | |
|---|---|
| Auth | Session cookie required |
| Body | `{ endpoint: string; keys: { p256dh: string; auth: string } }` (standard Web Push `PushSubscription.toJSON()` shape) |
| 200 | `{ id: string }` |
| 401 | no session |
| 400 | malformed subscription object |

### `DELETE /api/push/subscribe`
| | |
|---|---|
| Auth | Session cookie required |
| Body | `{ endpoint: string }` |
| 204 | no body |

### 9.3 `POST /api/uploads/photo`
Requests a signed R2 upload URL (client then `PUT`s the file bytes directly to R2, bypassing the Next.js server).
| | |
|---|---|
| Auth | Session cookie required |
| Body | `requestUploadSchema` (§8) |
| 200 | `{ uploadUrl: string; objectUrl: string; expiresInSeconds: 300 }` |
| 400 | validation error (bad content type / too large) |
| 401 | no session |

`objectUrl` is what the client later passes to the `attachPhoto` Server Action (§8) once the `PUT` to `uploadUrl` succeeds.

### 9.4 `POST /api/cron/complete-planned-visits`
Internal-only; called by the `worker` container's `node-cron` scheduler (HLD §7), never by the browser.
| | |
|---|---|
| Auth | Shared secret header: `X-Internal-Token: <value from env, matches worker's env>` — **not** session-based, since there's no user session in the scheduler container |
| Body | none |
| Behavior | Finds all `Visit` where `status='PLANNED' AND visitDate < NOW() - INTERVAL '24 hours'`, calls `completeVisit({ id, confirmed: false })` for each |
| 200 | `{ transitioned: number }` |
| 401 | missing/incorrect `X-Internal-Token` |

---

## 10. Household & Invite Contract

```ts
// lib/validations/household.ts
export const createInviteSchema = z.object({}); // no input — caller's household is implicit
export const acceptInviteSchema = z.object({ token: z.string() });
```

```ts
// lib/actions/household-actions.ts
async function createHouseholdInvite(): Promise<ActionResult<{ token: string; expiresAt: string }>>;
// CONFLICT if household already has 2 members (v1 cap — see PRD §2). Token is a random 32-char
// string (not a cuid, to keep it out of the same ID-space as internal records), expires in 7 days.

async function acceptHouseholdInvite(input: z.infer<typeof acceptInviteSchema>)
  : Promise<ActionResult<{ householdId: string }>>;
// Requires an authenticated (but currently household-less) session. NOT_FOUND if token invalid/expired.
// CONFLICT if the household is already at 2 members, or if the calling user already belongs to a household.
// Side effect: seeds the 6 default smart lists (§7) for the household on the FIRST accept (household creation
// implicitly happens on first user sign-up, not via this action — this action only ever adds member #2).
```

Query: `getHouseholdMembers(): Promise<Array<{ id: string; displayName: string; avatarUrl: string | null; color: string | null }>>` — powers avatar display and rating-comparison labeling (§5.3).

---

## 11. Error Semantics Quick Reference

| Situation | Server Action result | Route Handler status |
|---|---|---|
| No session | `{success:false, error:{code:"UNAUTHORIZED"}}` | `401` |
| Record exists but belongs to another household | `{success:false, error:{code:"NOT_FOUND"}}` (never `FORBIDDEN` — don't confirm existence) | `404` |
| Zod validation failure | `{success:false, error:{code:"VALIDATION_ERROR", fieldErrors}}` | `400` |
| Business-rule conflict (duplicate, wrong state) | `{success:false, error:{code:"CONFLICT"}}` | `409` |
| Unhandled exception | `{success:false, error:{code:"INTERNAL"}}` (logged server-side with full detail; client message stays generic) | `500` |

---

## 12. Open Items for This Contract
1. **`to_revisit` flag missing from schema.** The "To Revisit" smart list (§6) needs a boolean somewhere — either add `Restaurant.toRevisit` (simplest) or derive it from `wouldReturn` majority across ratings (more implicit, more surprising). Recommend the explicit boolean; needs a schema migration + a small `toggleToRevisit` action added to §2.2 before that smart list can ship.
2. **Restaurant delete vs archive.** §2.2 currently blocks delete when visits exist and hand-waves an `archivedAt` field that isn't in the HLD schema yet — needs to be added to `restaurants` if we want "remove from active lists without losing visit history" as a real feature, otherwise `deleteRestaurant` should simply always reject once any visit exists and archiving is deferred.
3. **Rate limiting** (`RATE_LIMITED` error code is defined but nothing currently triggers it) — likely only needed on `createHouseholdInvite` and `searchRestaurants` (to protect Nominatim usage indirectly via debounce) once real usage patterns are known; not implemented in v1.
