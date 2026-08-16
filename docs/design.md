# Our Table — UI design reference

Use this file and the PNGs in [`docs/design/mocks/`](design/mocks/) as the visual source of truth for styling work. Hex values are **estimates from the mockups**, not measured pixels — eyeball-correct in the running app.

**Do not invent** colors, type, or layout that are not grounded in these images. Per-person colors are **member slot 0 / slot 1**, never hardcoded names like Alex/Sam.

---

## Mock inventory

| File | Screen |
|---|---|
| [`00-composite-overview.png`](design/mocks/00-composite-overview.png) | Earlier multi-screen composite (serif display, terracotta raised `+`) |
| [`01-home.png`](design/mocks/01-home.png) | Home dashboard |
| [`02-explore.png`](design/mocks/02-explore.png) | Explore / browse |
| [`03-map.png`](design/mocks/03-map.png) | Map view |
| [`04-lists.png`](design/mocks/04-lists.png) | Lists (Smart Lists) |
| [`05-restaurant-overview.png`](design/mocks/05-restaurant-overview.png) | Restaurant detail — Overview |
| [`06-visits-timeline.png`](design/mocks/06-visits-timeline.png) | Restaurant detail — Visits timeline |
| [`07-visit-detail.png`](design/mocks/07-visit-detail.png) | Visit detail |
| [`08-ordered-items.png`](design/mocks/08-ordered-items.png) | Ordered items |
| [`09-reviews-side-by-side.png`](design/mocks/09-reviews-side-by-side.png) | Reviews comparison (signature) |
| [`10-add-visit-form.png`](design/mocks/10-add-visit-form.png) | Add / new visit form |

When a **per-screen mock** disagrees with the composite, **prefer the per-screen mock**. The composite is useful for overall mood and the raised center nav; screens 01–10 are the layout spec.

---

## Shared chrome

### Bottom navigation (all screens)

Five slots: **Home · Explore · raised circular `+` · Timeline · Profile**.

- Bar: white / cream, no heavy top hairline (soft shadow is enough).
- Inactive icons + labels: medium gray (`#9CA3AF` / `#717171`).
- Active: near-black charcoal (`#111827` / `#1A1A1A`); some screens add a short underline under the label.
- Center `+`: circular, overlapping the bar. In 01–04 the fill is **soft peach/amber** (`#FFEDD5` / `#FFD6AD` / `#FBE9E7`) with a **dark** plus — not a solid terracotta disc. Composite used terracotta fill + white plus; **use peach + dark icon** to match 01–04.
- Map and Lists are **not** bottom-nav destinations in these mocks (reach them from Home / Explore).

### Page canvas vs cards

- Page: warm off-white / cream (`#F6F1E8`–`#FCF9F5` / `#FAF7F2` / `#FDFBF8`).
- Cards and list surfaces: **white** (`#FFFFFF`) with large radius (~16–32px) and a **soft shadow**, not a hard gray border (except a few outlined tiles on Home).
- Content max-width: phone column (~390px) with ~20px side padding.

### Type

Screens 01–10 are a **clean geometric / humanist sans** for everything (greeting, titles, numbers, nav). Composite used a high-contrast **serif** for restaurant names and greetings.

Until we explicitly reconcile: **sans for UI and numbers**; serif only if we later re-adopt the composite’s display face for restaurant names/heroes. Do not default to Inter solely because it is familiar — pick a licensed pairing and stay consistent.

### Color roles (working estimates)

| Role | Hex (est.) | Use |
|---|---|---|
| Cream page | `#F8F5F2` | App background |
| Card / surface | `#FFFFFF` | Cards, nav bar, form sheet |
| Charcoal text | `#1A1A1A` | Titles, names, active nav |
| Muted text | `#6B7280` / `#757575` | Metadata, placeholders |
| Hairline | `#E5E7EB` / `#EEEEEE` | Search border, row dividers, filter chips |
| Forest / success | `#2D7D32` / `#3E7B4C` / `#15803D` | Ratings, confirmed badges, selected form chips, “Open” |
| Success wash | `#DCFCE7` / `#E8F5E9` | Confirmed pill, split badge |
| Terracotta / copper | `#A65D43` / `#BD5924` | Active restaurant tab underline, “Log a new visit” text |
| Peach nav `+` | `#FFEDD5` | Raised center button fill |
| Gold stars | `#FBC02D` / `#E2B13C` | Star rating fill |
| Member 0 | `#2E7D32` | Scores, avatar ring (left / first member) |
| Member 1 | `#7E57C2` | Scores, avatar ring (right / second member) |

Map pins (03) are a **separate** jewel set: red `#E55252`, green `#4F805D`, orange `#EB8D3D`, purple `#6652B0` — status/category, not person slots (person shows as a small avatar on the pin).

### Radius & shadow

- Chips / small thumbs: ~8–12px.
- Cards: ~16–24px; overlapping restaurant sheet ~32px.
- Pills: `rounded-full` (nav `+`, log-visit CTA, some search fields).
- Card shadow: large blur, low opacity (e.g. `0 8px 28px rgba(28,25,23,0.08)`).

### Signature element

**Reviews side-by-side** ([`09-reviews-side-by-side.png`](design/mocks/09-reviews-side-by-side.png)) is the distinctive treatment: category rows, two colored score columns (member 0 green / member 1 violet), avatars with names as column headers, couple-average summary with gold stars. Spend boldness here; keep other chrome quiet.

---

## Screen notes

### 01 Home

Greeting **“Good evening, {Member1} & {Member2}”** + two overlapping circular avatars (top right). Search field (rounded ~12px, gray border, magnifying glass). Featured **upcoming reservation** card: square thumb, restaurant name, date/time, mint **“Reservation confirmed”** pill. Quick actions as **four outlined square tiles**: Add Restaurant, Plan a Visit, Log a Visit, Random Pick. **Recently visited** rows: thumb + name + date/meal + green outlined rating box. No serif required on this screen.

### 02 Explore

Large **Explore** title + bell. Pill search. Horizontal **filter chips** (Cuisine, Location, Top Rated, Nearby) + filter icon — white fill, light border, charcoal text. **Browse by cuisine**: photo cards, rounded ~16px, white label + place count over a dark bottom gradient. **Top rated this month**: numbered list, square thumb, name, cuisine • neighborhood, bordered rating box.

### 03 Map

Filter chips over the map: **All** (active: dark green border/text), Wishlist / Visited / Planned (inactive beige). Light gray map, neighborhood labels in caps. Colored teardrop pins; some with member avatars. Recenter control (white circle, crosshair). **Bottom summary card**: thumb, name, cuisine • area, distance • dine type • price, green rating box, chevron + heart. Nav Explore is active.

### 04 Lists

Title **Lists** with a small count badge. Segmented control: **My Lists | Smart Lists** (active tab white-on-beige pill, brown/charcoal label). One white card listing smart lists, each with a **colored icon circle** + title + one-line description + “N places”:

| List | Icon circle (est.) |
|---|---|
| Top Rated | yellow `#F9A825` |
| Most Visited | blue `#5C9BD1` |
| Date Night Spots | red `#E57373` |
| Hidden Gems | green `#81C784` |
| To Revisit | purple `#9575CD` |
| Not Visited in 1+ Year | orange `#FFB74D` |

### 05 Restaurant overview

Full-bleed **dark photo hero**. Back / heart / share (white). Centered white name + cuisine line. Floating **white rating card**: large green couple average, “Average Couple Rating”, gold stars, visit count. Four **ghost** actions on the photo (white stroke): Website, Directions, Call, Share. Light sheet overlapping the hero (~32px top radius). Tabs: Overview (terracotta underline) · Visits · Menu Highlights · Photos · Info. Address, price • services, Open (green) • hours. Mini map with rust pin.

### 06 Visits timeline

Same restaurant tabs; **Visits** active (terracotta underline). Chronological rows: terracotta timeline dots on a gray vertical line; date + meal · occasion; right-aligned **green rating** + spend; row of square photo thumbs. Footer pill **“Log a new visit”** (peach fill, terracotta text, +).

### 07 Visit detail

Date + time; meal • occasion; green **Edit**. Icon strip: Dine-in, party size, Reservation, seating. **Bill**: subtotal / tip / total; green-wash split badge; payment method. **Photos** horizontal thumbs with +N overflow. **Receipt** row (filename + download). Large white card on cream.

### 08 Ordered items

Header + Edit. Rows: dish thumb, name, price, **Shared** (lavender chip) or **Individual** (peach chip), “Would order again” + green thumbs-up. Hairline dividers. Pill **+ Add Item** (cream fill, dark text).

### 09 Reviews (side by side)

Date • meal. Column headers = avatars + member display names. Rows: Overall, Food, Service, Atmosphere, Value, Drinks, Presentation, Waiting Time, Cleanliness. Scores in **member colors**. Footer couple-average panel (beige wash, large green number, gold stars).

### 10 Add visit form

Title **New Visit**; back; green **Save**. Beige filled inputs (~8–10px radius) for restaurant, date, time. **Meal** and **Type** as chip rows: unselected beige+black, **selected forest green + white**. Occasion dropdown. People stepper (`−` / count / `+`). Occasion + People on one row.

---

## Implementation notes for later passes

- Styling only unless a later brief says otherwise — do not change Server Actions, queries, or validation while applying this language.
- Person colors: `personColorForMember({ index, id })` by household membership order; never branch on display name.
- Tag chips: hash of tag name (fallback category) onto a small pastel set (peach / sage / lavender / rose / sand), matching Shared vs Individual on 08.
- Theme lives in `app/globals.css` (Tailwind v4 `@theme inline`), not a v3 `tailwind.config.ts`.
- Scratch gallery: `app/(dev)/design-system/page.tsx`.

## Open tensions (resolve when applying, don’t invent a third look)

1. **Nav `+`**: peach + dark icon (01–04) vs terracotta disc (composite). Prefer peach unless we explicitly keep brand terracotta.
2. **Display type**: all-sans (01–10) vs Playfair on titles (composite).
3. **Selected chips**: forest green (10) vs terracotta “Dine-in” (composite).
4. **Rating boxes**: green numeral in a light/outlined box (01–03, 05) vs dual person-colored numerals (09, composite timeline).
