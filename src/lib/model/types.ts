/** World coordinates are in centimetres, x to the right, y downwards (like the paper plan). */
export type Id = string;

export interface Point {
  x: number;
  y: number;
}

/** Size of an image in pixels. */
export interface SizePx {
  widthPx: number;
  heightPx: number;
}

/** A floor plan image (rendered PDF page or photo) under the drawing. */
export interface Background extends SizePx {
  /** Key of the image blob in IndexedDB. */
  blobKey: Id;
  name: string;
  /** Real-world centimetres per image pixel. */
  cmPerPx: number;
  /** World position of the image's top-left corner. */
  offset: Point;
  opacity: number;
  calibrated: boolean;
}

export interface Wall {
  id: Id;
  a: Point;
  b: Point;
  /** Thickness in cm. */
  thickness: number;
}

export interface Floor {
  id: Id;
  name: string;
  /** Floor level above ground floor in cm (used later for vertical cable runs). */
  level: number;
  background?: Background;
  walls: Wall[];
}

/** Where a Toestel sits on a Verdieping's plan. */
export interface Placement {
  floorId: Id;
  /** Centre of the symbol, in world cm. */
  at: Point;
  /**
   * Clockwise turn of the symbol in degrees. At 0 the symbol's wall side points down (+y);
   * a Toestel snapped to a wall is turned so that side faces the wall.
   */
  rotation: number;
}

export type SwitchVariant = 'singlePole' | 'twoWay' | 'intermediate' | 'dimmer';

/** Where a Toestel that can go either way is mounted; only wall-mounted ones snap to walls. */
export type Mount = 'wall' | 'ceiling';

/** The Gebruikstoestel a dedicated Contactdoos is for; its AREI symbol is drawn in front of the Contactdoos. */
export type Appliance = 'washingMachine' | 'dryer' | 'dishwasher' | 'oven' | 'hob';

/** What kind of Toestel it is: the glossary term plus its variant. */
export type DeviceKind =
  | { type: 'lightPoint'; mount: Mount }
  | { type: 'pushButton' }
  | { type: 'switch'; variant: SwitchVariant }
  /** Always with earth and child protection; `appliance` makes it a dedicated Contactdoos. */
  | { type: 'socket'; appliance?: Appliance }
  | { type: 'dataOutlet' }
  | { type: 'fan'; mount: Mount };

/** A Toestel. */
export type Device = DeviceKind & {
  id: Id;
  /** Absent when the Toestel is not on any plan (yet). */
  placement?: Placement;
};

/** A Toestel that is on a plan. */
export type PlacedDevice = Device & { placement: Placement };

/** Current version of the project data; older projects are migrated on load (see migrate.ts). */
export const PROJECT_VERSION = 4;

export interface Project {
  version: typeof PROJECT_VERSION;
  id: Id;
  name: string;
  floors: Floor[];
  /** All Toestellen of the project, placed or not. */
  devices: Device[];
  createdAt: string;
  updatedAt: string;
}

/** What the user has selected on the canvas. */
export type Selection = { kind: 'wall'; id: Id } | { kind: 'device'; id: Id } | null;

/** One end of a wall, referenced by the wall's id. */
export interface WallEnd {
  wallId: Id;
  end: 'a' | 'b';
}
