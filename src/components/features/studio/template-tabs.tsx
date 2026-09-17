"use client";

import type { ElementType } from "react";
import { BarChart3, CalendarDays, Sparkles, Users2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TEMPLATES } from "@/lib/studio/templates";
import type { TemplateId } from "@/types/studio";

const TEMPLATE_ICONS: Record<TemplateId, ElementType> = {
  "match-day": CalendarDays,
  "ai-prediction": Sparkles,
  "team-analysis": BarChart3,
  lineup: Users2,
};

interface TemplateTabsProps {
  value: TemplateId;
  onChange: (id: TemplateId) => void;
}

export function TemplateTabs({ value, onChange }: TemplateTabsProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onChange(next as TemplateId)}
      className="w-full"
    >
      <TabsList
        variant="line"
        className="h-auto w-full justify-start gap-1 border-b border-border pb-0"
      >
        {TEMPLATES.map((template) => {
          const Icon = TEMPLATE_ICONS[template.id];
          return (
            <TabsTrigger
              key={template.id}
              value={template.id}
              className="group h-auto flex-none gap-2 rounded-none px-4 py-3 text-sm font-medium text-muted-foreground data-active:bg-transparent data-active:text-white data-active:shadow-none hover:text-white/80"
            >
              <Icon className="size-4 text-white/30 group-data-active:text-emerald-400" />
              {template.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
