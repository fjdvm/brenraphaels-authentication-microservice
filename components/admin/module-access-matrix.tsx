"use client";

import {
  isSystemFullySelected,
  toggleModule,
  toggleSystem,
  type SelectableSystem,
} from "@/lib/admin/module-selection";

type ModuleAccessMatrixProps = {
  systems: SelectableSystem[];
  selected: string[];
  setSelected: (next: (current: string[]) => string[]) => void;
};

/** Module checkboxes grouped by System, each with a Select all. Posts as `moduleIds`. */
export function ModuleAccessMatrix({ systems, selected, setSelected }: ModuleAccessMatrixProps) {
  return (
    <div className="mt-4 grid gap-4 md:grid-cols-2">
      {systems.map((system) => (
        <fieldset className="rounded-md border border-border p-4" key={system.id}>
          <legend className="px-1 text-sm font-semibold text-primary">{system.name}</legend>
          <label className="flex items-center gap-2 pb-2 text-sm font-medium">
            <input
              checked={isSystemFullySelected(system, selected)}
              className="size-4 accent-primary"
              onChange={() => setSelected((current) => toggleSystem(system, current))}
              type="checkbox"
            />
            Select all
          </label>
          <div className="flex flex-col gap-2 border-t border-border pt-2">
            {system.modules.map((module) => (
              <label className="flex items-center gap-2 text-sm" key={module.id}>
                <input
                  checked={selected.includes(module.id)}
                  className="size-4 accent-primary"
                  name="moduleIds"
                  onChange={() => setSelected((current) => toggleModule(current, module.id))}
                  type="checkbox"
                  value={module.id}
                />
                {module.name}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
