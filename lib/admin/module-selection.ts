export type SelectableSystem = {
  id: string;
  name: string;
  /** SeedSystem.iconName, which picks the System's icon tile. */
  iconName?: string | null;
  modules: { id: string; name: string }[];
};

/** Add or remove one Module, leaving the rest of the selection untouched. */
export function toggleModule(selected: readonly string[], moduleId: string): string[] {
  return selected.includes(moduleId)
    ? selected.filter((id) => id !== moduleId)
    : [...selected, moduleId];
}

export function isSystemFullySelected(system: SelectableSystem, selected: readonly string[]): boolean {
  return system.modules.length > 0 && system.modules.every((module) => selected.includes(module.id));
}

/** "Select all" for one System: checks every Module when any is missing, otherwise clears them all. */
export function toggleSystem(
  system: SelectableSystem,
  selected: readonly string[],
): string[] {
  const systemModuleIds = new Set(system.modules.map((module) => module.id));
  const others = selected.filter((id) => !systemModuleIds.has(id));

  return isSystemFullySelected(system, selected)
    ? others
    : [...others, ...system.modules.map((module) => module.id)];
}

/** How many of this System's Modules are selected. */
export function countSelectedModules(system: SelectableSystem, selected: readonly string[]): number {
  return system.modules.filter((module) => selected.includes(module.id)).length;
}

/** "9 modules selected across 3 systems": the selected Modules and the Systems they span. */
export function summarizeSelection(
  systems: readonly SelectableSystem[],
  selected: readonly string[],
): { modules: number; systems: number } {
  const counts = systems.map((system) => countSelectedModules(system, selected));
  return {
    modules: counts.reduce((total, count) => total + count, 0),
    systems: counts.filter((count) => count > 0).length,
  };
}
