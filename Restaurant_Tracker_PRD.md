# Product Requirements Document
## "Our Table" — A Shared Restaurant Tracker for Couples

**Status:** Draft v1
**Platform:** Mobile-first responsive web app
**Owners:** [You]
**References:** Notion base (Restaurant List, By Type, By Location, Dusk Ranks views) + Figma mockups (10 screens)

---

## 1. Problem & Goal

Two people who eat out together want one shared place to:
- Remember restaurants they've been to, want to try, or keep coming back to
- Log **individual** visits with **individual** ratings, so both partners' opinions are captured separately but compared side by side
- Discover patterns ("we haven't been to X in over a year", "our top-rated date night spots")

The Notion base is the current source of truth but is spreadsheet-shaped (flat rows with tags). The app needs to model this as **relational data** — restaurants, visits, and ratings are distinct entities, not columns on one table — so the app can support timelines, per-visit ratings from two people, and derived "smart lists."

---

## 2. Users

| Persona | Description |
|---|---|
| **Couple (2 users)** | Shared workspace, both can add/edit restaurants and visits, each logs their own ratings |
| Future: **Household/Group (3+)** | Not in v1, but data model should not hard-code "2 users" |

v1 scope: a **Household** containing exactly 2 members, invited via a shared link/code (like a shared Notion workspace).

---

## 3. Data Model

### 3.1 Entity Overview

```
Household 1───* User
Household 1───* Restaurant 1───* Visit 1───* VisitRating (per User)
                              └──* OrderedItem
                              └──* Photo
Restaurant *───* Tag (via RestaurantTag)     [vibes, food type]
Restaurant 1───* List (via ListItem)          [manual + smart lists]
Restaurant 1───1 Location
```

### 3.2 Core Entities

#### `Household`
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | string | e.g. "Alex & Sam" |
| created_at | datetime | |

#### `User`
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| household_id | FK → Household | |
| display_name | string | |
| avatar_url | string | |
| color | string | for UI (rating comparisons use per-user color, seen in mockups) |

#### `Restaurant`
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| household_id | FK | |
| name | string | required |
| cuisine_type | string[] | e.g. Italian, Mexican — maps to "Food Type" in Notion |
| price_range | enum | $ / $$ / $$$ / $$$$ |
| website | url | nullable |
| phone | string | nullable |
| address | string | |
| lat / lng | float | for map view |
| neighborhood | string | e.g. "Ballston" — used for "By Location" grouping |
| area | string | broader region, currently mostly empty in source data |
| supports_delivery | bool | |
| supports_dine_in | bool | |
| supports_takeout | bool | |
| menu_url | string | nullable, "🗓" menu link column in Notion |
| status | enum | `wishlist` \| `visited` \| `planned` — matches map filter chips (All/Wishlist/Visited/Planned) |
| household_dusk_rank | enum | Favorite / Like It / S'ok / Haven't Tried / Dislike — **this is a shared, manually-set household opinion, not a computed rating** (Notion's "Dusk" & "Kjatar Rank" columns are per-person manual tags today — see open question in §3.4) |
| notes | text | |
| created_at | datetime | |

> **Design decision:** Notion has two near-duplicate manual-rank columns ("Dusk" and "Kjatar Rank" — presumably one per partner). In the app this should be replaced by **computed `average_rating`** derived from `VisitRating`, so the "Top rated this month" list and restaurant cards (seen showing "9.6", "9.2" etc.) are always in sync with actual logged visits rather than a manually maintained tag.

#### `Tag`
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| household_id | FK | |
| name | string | e.g. "Date Night", "Casual", "Guilty Pleasure" |
| category | enum | `vibe` \| `food_type` \| `method` (Dine-in/Takeout/Delivery) |

`RestaurantTag` — join table (many-to-many, `restaurant_id`, `tag_id`).

Using tags for "vibes" and "food type" (rather than fixed columns) matches the Notion source, where these are open multi-select fields, and lets the "By Type" and "Browse by cuisine" screens be generated dynamically.

#### `Visit`
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| restaurant_id | FK | |
| household_id | FK | denormalized for query speed |
| visit_date | date | |
| visit_time | time | nullable |
| meal | enum | Breakfast / Lunch / Dinner |
| dine_type | enum | Dine-in / Delivery / Takeout |
| occasion | string | e.g. "Anniversary", "Date Night" |
| party_size | int | |
| status | enum | `planned` \| `completed` — a `planned` visit is a future date on the calendar with no ratings yet; becomes `completed` once the date passes or the user confirms it happened |
| seating | string | e.g. "Indoor" |
| subtotal | decimal | |
| tip | decimal | |
| total_paid | decimal | computed or entered |
| payment_split | enum | Split equally / Individual / One paid |
| payment_method | string | e.g. "Card • Visa 4242" |
| created_by | FK → User | who logged it |
| created_at | datetime | |

> **Note:** No reservation/booking integration in v1 — "planning a visit" simply means creating a `Visit` row dated in the future, which surfaces on the Home upcoming list and a Calendar/Timeline view (see Flow C).

#### `OrderedItem`
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| visit_id | FK | |
| dish_name | string | |
| price | decimal | |
| shared | bool | Shared / Individual tag in mockup |
| ordered_by | FK → User, nullable | relevant if `shared = false` |
| would_order_again | bool \| null | |

#### `VisitRating` — one row **per user per visit** (this is the heart of the "compare" feature)
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| visit_id | FK | |
| user_id | FK | |
| overall_rating | decimal(3,1) | 0.0–10.0, matches "9.0" style scores shown |
| food | int(1-5) | star rating |
| service | int(1-5) | |
| atmosphere | int(1-5) | |
| value | int(1-5) | |
| drinks | int(1-5) | nullable if N/A |
| presentation | int(1-5) | |
| waiting_time | int(1-5) | |
| cleanliness | int(1-5) | |
| would_return | enum | Yes / Maybe / No |
| favorite_dish | FK → OrderedItem, nullable | |
| review_text | text | nullable |

**Unique constraint:** (`visit_id`, `user_id`) — each partner rates a given visit exactly once.

`Restaurant.average_rating` = average of `VisitRating.overall_rating` across all visits/users for that restaurant (drives leaderboard, "9.2 Average Couple Rating" badge, "Top Rated" smart list).

#### `Photo`
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| visit_id | FK, nullable | photos attached to a specific visit |
| restaurant_id | FK, nullable | hero/cover photos not tied to a visit |
| url | string | |
| uploaded_by | FK → User | |
| created_at | datetime | |

#### `List` (Collections)
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| household_id | FK | |
| name | string | |
| type | enum | `manual` \| `smart` |
| smart_rule | json, nullable | e.g. `{"metric":"visit_count","op":">=","value":5}` for "Most Visited" |
| icon | string | |

`ListItem` — join table (`list_id`, `restaurant_id`) — only used for `manual` lists; `smart` lists are computed at query time from the rule.

**Built-in smart lists (from mockups), expressed as rules:**
| List | Rule |
|---|---|
| Top Rated | `average_rating` above household-defined threshold, sorted desc |
| Hidden Gems | `average_rating` high AND `visit_count` low (e.g. ≤2) |
| Most Visited | `visit_count` desc |
| Date Night Spots | has tag "Date Night" (vibe) |
| To Revisit | manually flagged (`Restaurant.to_revisit = true`) or `would_return = maybe/no majority`... simplest: manual boolean flag |
| Not Visited in 1+ Year | `last_visit_date` < today − 365d |

### 3.3 Derived / Computed Fields (not stored, computed at read time)
- `Restaurant.average_rating` — avg of all `VisitRating.overall_rating`
- `Restaurant.visit_count` — count of `Visit`
- `Restaurant.last_visit_date` — max `Visit.visit_date`
- `Restaurant.average_bill` — avg of `Visit.total_paid`
- Per-visit **couple average** shown on visit rows = avg of that visit's `VisitRating.overall_rating` across the 2 users

### 3.4 Open Questions / Decisions Needed
1. Notion's "Dusk" and "Kjatar Rank" columns look like two people's personal quick-tags (Favorite/Like It/S'ok/Haven't Tried/Dislike) applied **without a formal visit**. Do we want to preserve this lightweight "gut-feel tag" separate from the structured `VisitRating`? *Recommendation:* yes — add a lightweight `RestaurantOpinion` (`restaurant_id`, `user_id`, `tag`) so users can tag a place before ever logging a full visit (e.g. "Haven't Tried" for a place they just heard about).
2. Should `average_rating` weight both partners equally, or should missing ratings (one partner didn't rate a visit) be excluded from the average rather than treated as 0?
3. Is "Neighborhood" a free-text field or a controlled list per metro area? Notion data (Annandale, Ballston, Clarendon, etc.) suggests a fixed list scoped to one metro — worth a `Neighborhood` lookup table if the app expands to multiple cities/metros later.

---

## 4. User Stories

### Restaurant & Discovery
- As a user, I want to **add a restaurant** with cuisine, price, location, and tags, so we have one shared record of it.
- As a user, I want to **browse restaurants by cuisine, location, or rating**, so I can decide where to go.
- As a user, I want to **search restaurants by name or dish**, so I can quickly find a place we've talked about.
- As a user, I want to **see restaurants on a map** filtered by wishlist/visited/planned, so I can find something nearby.
- As a user, I want to **mark a restaurant as a quick "gut feel"** (Favorite/Like It/Haven't Tried/etc.) without logging a full visit, so I can capture an opinion cheaply.

### Visits & Ratings
- As a user, I want to **log a visit** with date, meal, occasion, and party size, so we build a history of where we've eaten.
- As a user, I want to **rate a visit across multiple categories** (food, service, atmosphere, value, etc.), so my opinion is captured in detail, not just one number.
- As a user, I want my **rating to stay separate from my partner's**, so neither of us has to compromise on the score, but we can still see both.
- As a user, I want to **see my partner's rating next to mine**, so we can compare and discuss.
- As a user, I want to be **notified when my partner logs a visit I haven't rated yet**, so I don't forget to add my side.
- As a user, I want to **log what we ordered**, including price and whether I'd order it again, so future us knows what's good.
- As a user, I want to **attach photos to a visit**, so we remember the experience.
- As a user, I want to **track the bill and how it was split**, so we have a record of spending on dining out.

### Planning
- As a user, I want to **plan a future visit on a specific date**, so it shows up as something to look forward to.
- As a user, I want to **see a calendar/timeline of upcoming and past visits**, so I can plan our week and reminisce at the same time.
- As a user, I want to **reschedule or cancel a planned visit**, so the calendar stays accurate.
- As a user, I want a **planned visit to convert into a loggable visit** once the date passes, so I don't have to re-enter the restaurant details.

### Lists & Organization
- As a user, I want **smart lists** (Top Rated, Most Visited, Hidden Gems, Date Night Spots, To Revisit, Not Visited in 1+ Year), so I get useful groupings without manual upkeep.
- As a user, I want to **create my own custom lists** (e.g. "Want to Try", "Brunch Spots"), so I can organize restaurants my way.
- As a user, I want to **add/remove a restaurant from a list**, so I can curate it over time.

### Household
- As a user, I want to **invite my partner into a shared household**, so we're both working off the same data.
- As a user, I want **both of us to have equal edit rights**, so neither of us is a "read-only" guest in our own tracker.

---

## 5. Functional Requirements

### FR-1 Restaurant Management
- FR-1.1 Users can create, edit, and delete a `Restaurant` record (name, cuisine tags, price range, address, phone, website, delivery/dine-in/takeout flags, notes).
- FR-1.2 Address entry supports autocomplete and stores `lat/lng` for map placement.
- FR-1.3 Users can apply multiple `Tag`s (vibe and food-type) to a restaurant.
- FR-1.4 Users can set a lightweight personal opinion tag (`RestaurantOpinion`) on a restaurant independent of any visit.
- FR-1.5 System prevents duplicate restaurant creation by fuzzy-matching name + address on entry (warn, don't block).

### FR-2 Visit Logging
- FR-2.1 Users can create a `Visit` linked to an existing restaurant, with date, time, meal, dine type, occasion, and party size.
- FR-2.2 Users can add, edit, and remove `OrderedItem`s on a visit, each with price and shared/individual flag.
- FR-2.3 Users can enter bill subtotal, tip, total, and payment split method on a visit.
- FR-2.4 Users can attach one or more photos to a visit.
- FR-2.5 A visit can be edited or deleted by either household member, not just its creator.

### FR-3 Ratings
- FR-3.1 Each user can submit exactly one `VisitRating` per visit, covering an overall score plus category scores (food, service, atmosphere, value, drinks, presentation, waiting time, cleanliness).
- FR-3.2 A user can edit their own rating after submission; they cannot edit their partner's rating.
- FR-3.3 System computes and displays `Restaurant.average_rating` and per-visit couple-average from all submitted `VisitRating`s.
- FR-3.4 System notifies the partner when a visit exists that they haven't rated yet.
- FR-3.5 Reviews (Side by Side) view shows both users' ratings per category for a given restaurant or visit.

### FR-4 Planning & Calendar
- FR-4.1 Users can create a `Visit` with a future date and `status = planned` without requiring ratings or ordered items.
- FR-4.2 Calendar/Timeline view displays all visits (planned and completed) chronologically or in a month grid.
- FR-4.3 Users can reschedule (change date/time) or cancel (delete) a planned visit.
- FR-4.4 Once a planned visit's date passes, the system prompts confirmation and transitions `status` to `completed`, unlocking the ordered-items and rating flows; auto-transitions after 24 hours if unconfirmed.
- FR-4.5 Home dashboard surfaces the next upcoming planned visit.

### FR-5 Lists
- FR-5.1 System provides built-in smart lists (Top Rated, Most Visited, Hidden Gems, Date Night Spots, To Revisit, Not Visited in 1+ Year) computed from restaurant/visit/rating data.
- FR-5.2 Users can create, rename, and delete custom manual lists, and add/remove restaurants to/from them.
- FR-5.3 Lists are visible to and editable by both household members.

### FR-6 Household & Access
- FR-6.1 A new user can create a household and generate an invite link/code.
- FR-6.2 A second user can join a household via the invite link/code.
- FR-6.3 All restaurants, visits, ratings, and lists are scoped to a household and visible only to its members.
- FR-6.4 Both household members have equal read/write permissions; no admin/owner distinction in v1.

### FR-7 Discovery & Browsing
- FR-7.1 Explore screen supports filtering by cuisine, location/neighborhood, and sorting by rating or recency.
- FR-7.2 Search returns matching restaurants by name, cuisine, or dish name (from `OrderedItem`).
- FR-7.3 Map view plots restaurants with status-based filter chips (Wishlist/Visited/Planned) and shows a summary card on pin tap.

---

## 6. User Flows

### Flow A — Log a Visit (primary loop)
1. **Home** → tap "Log a Visit" quick action *(or from Restaurant Detail → "+ Log a visit")*
2. **Add a Visit form**: pick/search restaurant → date, time, meal, dine type, occasion, party size → Save
3. → **What did you order?**: add dish name + price + shared/individual + "would order again" toggle per item → running total
4. → **Your Review**: overall star rating + category ratings (food, service, atmosphere, value, drinks, presentation, waiting time, cleanliness) + "Would you return?" + favorite dish → Save
   - Creates one `VisitRating` row for the logging user.
   - Partner gets a prompt (in-app notification / badge) to add **their own** rating for the same visit — creates a second `VisitRating` row.
5. Visit now appears in Restaurant Detail → **Visits** timeline, and in **Reviews (Side by Side)** once both partners have rated.

### Flow B — Discover / Add a New Restaurant
1. **Explore** tab → browse by cuisine, location, top rated, or nearby (search bar for direct lookup)
2. If not found → **Add Restaurant** quick action → name, cuisine, address (autocomplete via maps API), price range, delivery/dine-in/takeout flags, tags/vibes
3. New restaurant defaults to `status = wishlist`
4. Optionally add to a manual **List** (e.g. "Want to Try")

### Flow C — Plan a Visit (Calendar / Timeline)
1. **Home** → "Plan a Visit" quick action, or **Calendar** tab → tap a date
2. Pick restaurant → date/time → optional occasion/party size → Save → creates a `Visit` with `status = planned` and no ratings yet
3. **Calendar/Timeline view**: month-grid or scrollable timeline showing all `planned` and `completed` visits by date; tapping a day with a planned visit opens Visit Detail; empty future days can be tapped to plan directly
4. Planned visit also appears under **Home → Upcoming Plans** and as a distinct pin style on the **Map** (status filter chip "Planned")
5. Once the date passes, the app prompts the creator (and partner) to confirm it happened → `status` flips to `completed` and the normal rate/log-items flow (Flow A, steps 3–4) becomes available; if skipped, the visit auto-flips to `completed` after 24 hours so it doesn't block the timeline, and ratings can still be added later
6. A planned visit can be edited (reschedule) or cancelled (deleted) any time before it's marked `completed`

### Flow D — Browse & Filter (Explore / Lists / Map)
1. **Explore**: filter chips (Cuisine / Location / Top Rated / Nearby) → grid or list of `Restaurant` filtered/sorted by the derived fields in §3.3
2. **Lists**: toggle "My Lists" (manual) vs "Smart Lists" (rule-based, §3.2) → tapping a list shows filtered `Restaurant` results
3. **Map**: same restaurant set, plotted by `lat/lng`, filter chips for status (All/Wishlist/Visited/Planned); tapping a pin surfaces a bottom card (name, rating, distance, price) → tap through to Restaurant Detail

### Flow E — Restaurant Detail → Compare Ratings
1. From any list/map/search result → **Restaurant Detail (Overview)**: hero image, name, cuisine tags, average couple rating + visit count, action buttons (Website/Directions/Call/Share/Save), "At a glance" panel (cuisine, price, best-for tags, features)
2. Tabs: **Overview / Visits / Menu Highlights / Photos / Reviews / Info**
3. **Visits** tab = reverse-chronological `Visit` list, each row showing date, occasion, thumbnail photos, both partners' `overall_rating`, and bill total
4. **Reviews** tab = side-by-side comparison: per-category bars for User A vs User B (averaged across all their `VisitRating`s for this restaurant, or filterable to a single visit), plus free-text review snippets

### Flow F — Household Setup (not in mockups, needed for data model to function)
1. First user signs up → creates `Household`
2. Invites partner via shareable link/code → partner joins, becomes second `User` in the same `Household`
3. All subsequent data (`Restaurant`, `Visit`, `List`) scoped to `household_id`; both partners have equal read/write access (no owner/editor distinction in v1)

---

## 7. Screen → Data Mapping (from provided mockups + new calendar screen)

| Screen | Primary entities read | Primary entities written |
|---|---|---|
| Home Dashboard | Visit (upcoming), Visit (recent) | — |
| Explore/Browse | Restaurant, Tag, computed avg_rating | — |
| Map View | Restaurant (lat/lng, status) | — |
| **Calendar/Timeline (new)** | Visit (planned + completed, by date) | Visit (create/reschedule from calendar) |
| Lists (My/Smart) | List, ListItem, Restaurant | List, ListItem (manual only) |
| Restaurant Detail (Overview) | Restaurant, computed fields, Tag | — |
| Visits Timeline | Visit, VisitRating (couple avg), Photo | — |
| Visit Detail | Visit, Photo | Visit (edit) |
| Ordered Items | OrderedItem | OrderedItem |
| Reviews (Side by Side) | VisitRating (per user) | — |
| Add a Visit (form) | Restaurant (lookup) | Visit |

---

## 8. Non-Functional Requirements

| # | Category | Requirement |
|---|---|---|
| NFR-1 | Performance | Explore, Map, and List views return results in <1s for a household with up to ~1,000 restaurants and ~5,000 visits. |
| NFR-2 | Offline / Reliability | Visit logging (Flow A) supports local draft save while offline (e.g. mid-meal, poor signal) and syncs automatically on reconnect without data loss or duplication. |
| NFR-3 | Mobile-first UX | All core flows (log visit, rate, browse, plan) must be fully usable one-handed on a phone screen ≥360px wide; desktop is a responsive scale-up, not a separate design. |
| NFR-4 | Data integrity | A `VisitRating` is enforced unique per (`visit_id`, `user_id`) at the database level, preventing duplicate/overwritten ratings. |
| NFR-5 | Media storage | Photos stored in object storage (S3-compatible); originals plus generated thumbnails (for timeline/grid views) to keep list views fast. |
| NFR-6 | Privacy & access | Household data is isolated per household (row-level scoping by `household_id`); no cross-household data leakage; no public-facing profile in v1. |
| NFR-7 | Notifications | Partner-rating-pending notifications delivered within a few minutes of the triggering visit being logged (push or in-app badge). |
| NFR-8 | Availability | Core read paths (Home, Explore, Restaurant Detail) target 99.5% uptime; write paths (logging a visit) should degrade gracefully to offline-draft rather than fail outright. |
| NFR-9 | Extensibility | Data model must not hard-code "2 users" (`Household` supports N members) even though v1 UI is designed around a couple. |
| NFR-10 | Accessibility | Star/number ratings and color-coded tags (e.g. Favorite/Dislike) must also convey meaning via text/labels, not color alone. |
| NFR-11 | Auditability | `created_by`/`uploaded_by` retained on visits and photos so either partner can see who logged what, without restricting the other's edit rights. |

---

## 9. Out of Scope (v1)
- Public sharing / social feed of restaurants
- Restaurant recommendations from an external database (Yelp/Google) beyond address autocomplete
- Reservation booking integrations (OpenTable, Resy, etc.) — planning a visit is just a dated `Visit` record on the calendar, not a live table booking
- Group households of 3+ members
- Real-time "both viewing at once" presence indicators (nice-to-have, deferred)
