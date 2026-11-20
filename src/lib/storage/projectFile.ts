/**
 * The project file the user saves: the project plus its plan images as data URLs, so one file is the
 * whole project. Reading and writing it never touches the network (ADR 0002).
 */
import { migrateProject } from '../model/migrate';
import { blobKeys } from '../model/project';
import type { Id, Project } from '../model/types';

/** Version of the file wrapper; it follows the project version. Older files are read and migrated. */
const FILE_VERSION = 2;

interface ProjectFile {
  format: 'elektroplan';
  version: number;
  project: Project;
  blobs: Record<Id, string>;
}

function parseProjectFile(text: string): ProjectFile {
  const data = JSON.parse(text) as Partial<ProjectFile>;
  if (data.format !== 'elektroplan' || typeof data.version !== 'number' || !data.project) {
    throw new Error('Dit is geen geldig Elektroplan-projectbestand.');
  }
  if (data.version > FILE_VERSION) throw new Error('Dit project komt uit een nieuwere versie van Elektroplan.');
  return { format: 'elektroplan', version: FILE_VERSION, project: migrateProject(data.project), blobs: data.blobs ?? {} };
}

/** The project as file text, with every plan image that `getBlob` still has. */
export async function exportProjectFile(
  project: Project,
  getBlob: (key: Id) => Promise<Blob | undefined>,
): Promise<string> {
  const blobs: Record<Id, string> = {};
  for (const key of blobKeys(project)) {
    const blob = await getBlob(key);
    if (blob) blobs[key] = await blobToDataUrl(blob);
  }
  const file: ProjectFile = { format: 'elektroplan', version: FILE_VERSION, project, blobs };
  return JSON.stringify(file);
}

/** Read file text, store its plan images with `putBlob`, and return the project. */
export async function importProjectFile(
  text: string,
  putBlob: (key: Id, blob: Blob) => Promise<void>,
): Promise<Project> {
  const file = parseProjectFile(text);
  for (const [key, dataUrl] of Object.entries(file.blobs)) await putBlob(key, decodeDataUrl(dataUrl));
  return file.project;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  // Build the binary string in chunks: one call per byte is slow on a large plan,
  // and one call for all bytes overflows the argument limit.
  const CHUNK = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
  const bin = parts.join('');
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(bin)}`;
}

/** Decode a data: URL locally; anything else (a link) is refused. */
function decodeDataUrl(dataUrl: string): Blob {
  if (!dataUrl.startsWith('data:')) throw new Error('Alleen ingebedde afbeeldingen zijn toegestaan.');
  const [head, body] = dataUrl.split(',', 2);
  const mime = head.slice(5).split(';')[0] || 'application/octet-stream';
  const bin = head.includes(';base64') ? atob(body) : decodeURIComponent(body);
  return new Blob([Uint8Array.from(bin, (c) => c.charCodeAt(0))], { type: mime });
}
