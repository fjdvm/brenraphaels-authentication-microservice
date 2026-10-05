export type SelectableSystem = {
  id: string;
  name: string;
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
