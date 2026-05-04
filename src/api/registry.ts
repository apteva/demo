// Component registry — maps (appSlug, componentName) → React
// component. Today this is a static, build-time registry (everything
// is bundled into the demo). Tomorrow when the demo gets its own
// backend (Ship B in the proposal) this becomes a fetch from the
// integrations bundle's registry.json plus dynamic import().

import type { ComponentType } from "react";

import DealCard       from "@apteva/integrations/ui/hubspot/DealCard";
import CompanyCard    from "@apteva/integrations/ui/hubspot/CompanyCard";
import ContactCard    from "@apteva/integrations/ui/hubspot/ContactCard";
import TicketCard     from "@apteva/integrations/ui/hubspot/TicketCard";
import EmailCard      from "@apteva/integrations/ui/hubspot/EmailCard";
import PipelineStrip  from "@apteva/integrations/ui/hubspot/PipelineStrip";
import ActivityFeed   from "@apteva/integrations/ui/hubspot/ActivityFeed";
import DealList       from "@apteva/integrations/ui/hubspot/DealList";
import TicketList     from "@apteva/integrations/ui/hubspot/TicketList";
import ContactList    from "@apteva/integrations/ui/hubspot/ContactList";
import InboxStrip     from "@apteva/integrations/ui/hubspot/InboxStrip";

export interface RegistryEntry {
  component: ComponentType<any>;
  /** Slots this component fits into. Used by the (future) editor. */
  slots: string[];
}

const REGISTRY: Record<string, Record<string, RegistryEntry>> = {
  hubspot: {
    "deal-card":      { component: DealCard,      slots: ["chat.message_attachment", "dashboard.tile"] },
    "company-card":   { component: CompanyCard,   slots: ["chat.message_attachment", "dashboard.tile"] },
    "contact-card":   { component: ContactCard,   slots: ["chat.message_attachment"] },
    "ticket-card":    { component: TicketCard,    slots: ["chat.message_attachment", "dashboard.tile"] },
    "email-card":     { component: EmailCard,     slots: ["chat.message_attachment"] },
    "pipeline-strip": { component: PipelineStrip, slots: ["dashboard.tile"] },
    "activity-feed":  { component: ActivityFeed,  slots: ["dashboard.tile", "chat.message_attachment"] },
    "deal-list":      { component: DealList,      slots: ["chat.message_attachment", "dashboard.tile"] },
    "ticket-list":    { component: TicketList,    slots: ["chat.message_attachment", "dashboard.tile"] },
    "contact-list":   { component: ContactList,   slots: ["chat.message_attachment"] },
    "inbox-strip":    { component: InboxStrip,    slots: ["chat.message_attachment", "dashboard.tile"] },
  },
};

export function resolveComponent(appSlug: string, name: string): ComponentType<any> | null {
  const app = REGISTRY[appSlug];
  if (!app) return null;
  return app[name]?.component ?? null;
}

export function listComponents(appSlug: string): Array<{ name: string; slots: string[] }> {
  const app = REGISTRY[appSlug];
  if (!app) return [];
  return Object.entries(app).map(([name, e]) => ({ name, slots: e.slots }));
}
