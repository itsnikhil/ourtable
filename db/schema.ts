import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ---- Enums ----
export const priceRangeEnum = pgEnum("price_range", [
  "LOW",
  "MID",
  "HIGH",
  "LUXE",
]);
export const restaurantStatusEnum = pgEnum("restaurant_status", [
  "WISHLIST",
  "VISITED",
  "PLANNED",
]);
export const opinionTagEnum = pgEnum("opinion_tag", [
  "FAVORITE",
  "LIKE_IT",
  "SOK",
  "HAVENT_TRIED",
  "DISLIKE",
]);
export const tagCategoryEnum = pgEnum("tag_category", [
  "VIBE",
  "FOOD_TYPE",
  "METHOD",
]);
export const mealEnum = pgEnum("meal", ["BREAKFAST", "LUNCH", "DINNER"]);
export const dineTypeEnum = pgEnum("dine_type", [
  "DINE_IN",
  "DELIVERY",
  "TAKEOUT",
]);
export const visitStatusEnum = pgEnum("visit_status", ["PLANNED", "COMPLETED"]);
export const paymentSplitEnum = pgEnum("payment_split", [
  "EQUAL",
  "INDIVIDUAL",
  "ONE_PAID",
]);
export const wouldReturnEnum = pgEnum("would_return", ["YES", "MAYBE", "NO"]);
export const listTypeEnum = pgEnum("list_type", ["MANUAL", "SMART"]);

// ---- App tables (HLD §4) ----
export const households = pgTable("households", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Auth.js adapter expects `name` / `image` / `emailVerified` on the users table.
 * HLD `displayName` / `avatarUrl` map to DB columns `display_name` / `avatar_url`
 * via the JS property names `name` / `image` so the adapter works without a second user table.
 * `householdId` is nullable so invite-accept can run for a household-less session (LLD §10).
 */
export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  householdId: text("household_id").references(() => households.id),
  name: text("display_name").notNull().default(""),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("avatar_url"),
  color: text("color"),
});

export const householdInvites = pgTable("household_invites", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  householdId: text("household_id")
    .notNull()
    .references(() => households.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const restaurants = pgTable(
  "restaurants",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id),
    name: text("name").notNull(),
    priceRange: priceRangeEnum("price_range"),
    website: text("website"),
    phone: text("phone"),
    address: text("address"),
    lat: numeric("lat"),
    lng: numeric("lng"),
    neighborhood: text("neighborhood"),
    area: text("area"),
    supportsDelivery: boolean("supports_delivery").default(false).notNull(),
    supportsDineIn: boolean("supports_dine_in").default(false).notNull(),
    supportsTakeout: boolean("supports_takeout").default(false).notNull(),
    menuUrl: text("menu_url"),
    status: restaurantStatusEnum("status").default("WISHLIST").notNull(),
    notes: text("notes"),
    // LLD §12.1 / §12.2 — not in original HLD snippet
    toRevisit: boolean("to_revisit").default(false).notNull(),
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("restaurants_household_idx").on(t.householdId)],
);

export const restaurantOpinions = pgTable(
  "restaurant_opinions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    tag: opinionTagEnum("tag").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("opinion_restaurant_user_idx").on(t.restaurantId, t.userId),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id),
    name: text("name").notNull(),
    category: tagCategoryEnum("category").notNull(),
  },
  (t) => [
    uniqueIndex("tag_household_name_category_idx").on(
      t.householdId,
      t.name,
      t.category,
    ),
  ],
);

export const restaurantTags = pgTable(
  "restaurant_tags",
  {
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id),
  },
  (t) => [primaryKey({ columns: [t.restaurantId, t.tagId] })],
);

export const visits = pgTable(
  "visits",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    householdId: text("household_id")
      .notNull()
      .references(() => households.id),
    visitDate: timestamp("visit_date").notNull(),
    visitTime: text("visit_time"),
    meal: mealEnum("meal"),
    dineType: dineTypeEnum("dine_type"),
    occasion: text("occasion"),
    partySize: integer("party_size"),
    status: visitStatusEnum("status").default("COMPLETED").notNull(),
    seating: text("seating"),
    subtotal: numeric("subtotal"),
    tip: numeric("tip"),
    totalPaid: numeric("total_paid"),
    paymentSplit: paymentSplitEnum("payment_split"),
    paymentMethod: text("payment_method"),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("visits_household_date_idx").on(t.householdId, t.visitDate),
    index("visits_restaurant_idx").on(t.restaurantId),
  ],
);

export const orderedItems = pgTable("ordered_items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  visitId: text("visit_id")
    .notNull()
    .references(() => visits.id),
  dishName: text("dish_name").notNull(),
  price: numeric("price"),
  shared: boolean("shared").default(true).notNull(),
  orderedById: text("ordered_by_id"),
  wouldOrderAgain: boolean("would_order_again"),
});

export const visitRatings = pgTable(
  "visit_ratings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    visitId: text("visit_id")
      .notNull()
      .references(() => visits.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    overallRating: numeric("overall_rating").notNull(),
    food: integer("food"),
    service: integer("service"),
    atmosphere: integer("atmosphere"),
    value: integer("value"),
    drinks: integer("drinks"),
    presentation: integer("presentation"),
    waitingTime: integer("waiting_time"),
    cleanliness: integer("cleanliness"),
    wouldReturn: wouldReturnEnum("would_return"),
    favoriteDishId: text("favorite_dish_id"),
    reviewText: text("review_text"),
  },
  (t) => [uniqueIndex("rating_visit_user_idx").on(t.visitId, t.userId)],
);

export const photos = pgTable("photos", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  visitId: text("visit_id").references(() => visits.id),
  restaurantId: text("restaurant_id").references(() => restaurants.id),
  url: text("url").notNull(),
  uploadedById: text("uploaded_by_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Web Push subscriptions (LLD §9.2 / HLD §6.3). */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("push_subscriptions_endpoint_idx").on(t.endpoint)],
);

export const lists = pgTable("lists", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  householdId: text("household_id")
    .notNull()
    .references(() => households.id),
  name: text("name").notNull(),
  type: listTypeEnum("type").notNull(),
  smartRule: jsonb("smart_rule"),
  icon: text("icon"),
});

export const listItems = pgTable(
  "list_items",
  {
    listId: text("list_id")
      .notNull()
      .references(() => lists.id),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
  },
  (t) => [primaryKey({ columns: [t.listId, t.restaurantId] })],
);

// ---- Auth.js adapter tables (required by next-auth; not in HLD §4 entity model) ----
export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
  ],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// ---- Relations ----
export const householdsRelations = relations(households, ({ many }) => ({
  users: many(users),
  invites: many(householdInvites),
  restaurants: many(restaurants),
  tags: many(tags),
  visits: many(visits),
  lists: many(lists),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  household: one(households, {
    fields: [users.householdId],
    references: [households.id],
  }),
  accounts: many(accounts),
  sessions: many(sessions),
  opinions: many(restaurantOpinions),
  ratings: many(visitRatings),
  photos: many(photos),
  pushSubscriptions: many(pushSubscriptions),
  createdVisits: many(visits),
}));

export const householdInvitesRelations = relations(
  householdInvites,
  ({ one }) => ({
    household: one(households, {
      fields: [householdInvites.householdId],
      references: [households.id],
    }),
  }),
);

export const restaurantsRelations = relations(restaurants, ({ one, many }) => ({
  household: one(households, {
    fields: [restaurants.householdId],
    references: [households.id],
  }),
  opinions: many(restaurantOpinions),
  restaurantTags: many(restaurantTags),
  visits: many(visits),
  photos: many(photos),
  listItems: many(listItems),
}));

export const restaurantOpinionsRelations = relations(
  restaurantOpinions,
  ({ one }) => ({
    restaurant: one(restaurants, {
      fields: [restaurantOpinions.restaurantId],
      references: [restaurants.id],
    }),
    user: one(users, {
      fields: [restaurantOpinions.userId],
      references: [users.id],
    }),
  }),
);

export const tagsRelations = relations(tags, ({ one, many }) => ({
  household: one(households, {
    fields: [tags.householdId],
    references: [households.id],
  }),
  restaurantTags: many(restaurantTags),
}));

export const restaurantTagsRelations = relations(restaurantTags, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [restaurantTags.restaurantId],
    references: [restaurants.id],
  }),
  tag: one(tags, {
    fields: [restaurantTags.tagId],
    references: [tags.id],
  }),
}));

export const visitsRelations = relations(visits, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [visits.restaurantId],
    references: [restaurants.id],
  }),
  household: one(households, {
    fields: [visits.householdId],
    references: [households.id],
  }),
  createdBy: one(users, {
    fields: [visits.createdById],
    references: [users.id],
  }),
  orderedItems: many(orderedItems),
  ratings: many(visitRatings),
  photos: many(photos),
}));

export const orderedItemsRelations = relations(orderedItems, ({ one }) => ({
  visit: one(visits, {
    fields: [orderedItems.visitId],
    references: [visits.id],
  }),
}));

export const visitRatingsRelations = relations(visitRatings, ({ one }) => ({
  visit: one(visits, {
    fields: [visitRatings.visitId],
    references: [visits.id],
  }),
  user: one(users, {
    fields: [visitRatings.userId],
    references: [users.id],
  }),
}));

export const photosRelations = relations(photos, ({ one }) => ({
  visit: one(visits, {
    fields: [photos.visitId],
    references: [visits.id],
  }),
  restaurant: one(restaurants, {
    fields: [photos.restaurantId],
    references: [restaurants.id],
  }),
  uploadedBy: one(users, {
    fields: [photos.uploadedById],
    references: [users.id],
  }),
}));

export const pushSubscriptionsRelations = relations(
  pushSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [pushSubscriptions.userId],
      references: [users.id],
    }),
  }),
);

export const listsRelations = relations(lists, ({ one, many }) => ({
  household: one(households, {
    fields: [lists.householdId],
    references: [households.id],
  }),
  items: many(listItems),
}));

export const listItemsRelations = relations(listItems, ({ one }) => ({
  list: one(lists, {
    fields: [listItems.listId],
    references: [lists.id],
  }),
  restaurant: one(restaurants, {
    fields: [listItems.restaurantId],
    references: [restaurants.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));
