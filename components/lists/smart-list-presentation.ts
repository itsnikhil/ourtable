import type { LucideIcon } from "lucide-react";
import {
  Bookmark,
  Heart,
  ShoppingBag,
  Shield,
  Star,
  Trophy,
} from "lucide-react";
import type { SmartListKey } from "@/lib/smart-lists";

export const SMART_LIST_PRESENTATION: Record<
  SmartListKey,
  { circle: string; Icon: LucideIcon; description: string }
> = {
  TOP_RATED: {
    circle: "#F9A825",
    Icon: Star,
    description: "Based on your average rating",
  },
  MOST_VISITED: {
    circle: "#5C9BD1",
    Icon: Trophy,
    description: "You love coming back",
  },
  DATE_NIGHT: {
    circle: "#E57373",
    Icon: Heart,
    description: "Perfect for special occasions",
  },
  HIDDEN_GEMS: {
    circle: "#81C784",
    Icon: Shield,
    description: "High rated, few visits",
  },
  TO_REVISIT: {
    circle: "#9575CD",
    Icon: Bookmark,
    description: "Places you want to go back to",
  },
  NOT_VISITED_1Y: {
    circle: "#FFB74D",
    Icon: ShoppingBag,
    description: "It's been a while",
  },
};
