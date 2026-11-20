import { PROJECT_VERSION, type Project } from './types';

/**
 * Bring a stored project (from IndexedDB or a project file) up to the current version.
 * Each step upgrades one version, so old projects keep opening.
 */
export function migrateProject(raw: unknown): Project {
  const p = raw as { version?: unknown; floors?: unknown } | null;
  if (!p || typeof p.version !== 'number' || !Array.isArray(p.floors)) {
    throw new Error('Dit is geen geldig Elektroplan-project.');
  }
  if (p.version > PROJECT_VERSION) {
    throw new Error('Dit project komt uit een nieuwere versie van Elektroplan.');
  }
  const project = { ...p } as Record<string, unknown>;
  // 1 → 2: Toestellen (#10)
  if (project.version === 1) Object.assign(project, { version: 2, devices: [] });
  return project as unknown as Project;
}
