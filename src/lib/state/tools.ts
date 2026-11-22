/** The editor's tools, in toolbar order. The single place a tool's name and shortcut are defined. */
export const TOOLS = [
  { id: 'select', label: 'Selecteren', key: 'V' },
  { id: 'wall', label: 'Muur', key: 'W' },
  { id: 'room', label: 'Ruimte', key: 'U' },
  { id: 'measure', label: 'Meten', key: 'M' },
  { id: 'calibrate', label: 'Kalibreren', key: 'C' },
] as const;

export type Tool = (typeof TOOLS)[number]['id'];

/** The tool whose shortcut is `key` (any case), if any. */
export function toolForKey(key: string): Tool | undefined {
  return TOOLS.find((t) => t.key === key.toUpperCase())?.id;
}
