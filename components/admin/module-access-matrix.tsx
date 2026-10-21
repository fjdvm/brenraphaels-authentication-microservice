"use client";

import { systemStyle } from "@/components/admin/system-style";
import { Checkbox } from "@/components/ui/checkbox";
import {
  countSelectedModules,
  isSystemFullySelected,
  toggleModule,
  toggleSystem,
  type SelectableSystem,
} from "@/lib/admin/module-selection";
import { cn } from "@/lib/utils/cn";

type ModuleAccessMatrixProps = {
  systems: SelectableSystem[];
  selected: string[];
  setSelected: (next: (current: string[]) => string[]) => void;
  /** Figma lays Modules out 200px wide on Add new user and 150px wide in the Edit access dialog. */
  density?: "page" | "dialog";
};

/**
 * Figma "modules/<System>" cards: Module checkboxes grouped by System, each with a
 * count and a Select all that shows a dash when only some are ticked. Posts as `moduleIds`.
 */
export function ModuleAccessMatrix({ systems, selected, setSelected, density = "page" }: ModuleAccessMatrixProps) {
  const isDialog = density === "dialog";

  return (
    <div className={cn("grid md:grid-cols-2", isDialog ? "gap-3" : "gap-4")}>
      {systems.map((system) => {
        const style = systemStyle(system.iconName);
        const Icon = style.icon;
        const count = countSelectedModules(system, selected);
        const isFull = isSystemFullySelected(system, selected);

        return (
          <fieldset className="min-w-0 overflow-hidden rounded-[10px] border border-panel-border bg-surface leading-[normal]" key={system.id}>
            <legend className="sr-only">{system.name}</legend>
            <div className="flex items-center gap-2.5 border-b border-table-divider bg-dialog-footer px-3.5 py-3">
              <span className={cn("flex size-7.5 shrink-0 items-center justify-center rounded-lg", style.tile)}>
                <Icon aria-hidden="true" className={cn("size-4", style.accent)} />
              </span>
              <span aria-hidden="true" className="min-w-0 flex-1 text-[15px] font-semibold text-foreground">
                {system.name}
              </span>
              <span className="text-xs font-medium whitespace-nowrap text-on-surface-variant">
                {count} of {system.modules.length}
              </span>
              <label className="flex items-center gap-2 text-[13px] font-medium whitespace-nowrap text-nav-foreground">
                <Checkbox
                  checked={isFull}
                  indeterminate={count > 0 && !isFull}
                  onChange={() => setSelected((current) => toggleSystem(system, current))}
                />
                Select all
              </label>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-2.5 px-3.5 pt-3 pb-3.5">
              {system.modules.map((module) => (
                <label
                  className={cn(
                    "flex items-start gap-2.5 text-sm leading-[normal] text-nav-foreground has-checked:text-foreground",
                    isDialog ? "w-37.5" : "w-50",
                  )}
                  key={module.id}
                >
                  <Checkbox
                    checked={selected.includes(module.id)}
                    name="moduleIds"
                    onChange={() => setSelected((current) => toggleModule(current, module.id))}
                    value={module.id}
                  />
                  {module.name}
                </label>
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
