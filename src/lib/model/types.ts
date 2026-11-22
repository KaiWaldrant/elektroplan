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
  rooms: Room[];
}

/** A Ruimte: a named room outlined on its Verdieping's plan. */
export interface Room {
  id: Id;
  name: string;
  /** The outline, corner after corner in world cm (closed: the last corner joins the first). */
  polygon: Point[];
  /** Home Assistant area id in snake_case set by hand; absent means the name in snake_case (see haArea() in rooms.ts). */
  haAreaOverride?: string;
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
  /** The Ruimte chosen by hand while the Toestel is not placed; a placed Toestel takes its Ruimte from its position. */
  roomId?: Id;
};

/** A Toestel that is on a plan. */
export type PlacedDevice = Device & { placement: Placement };

/** How the Toestellen of a Combinatie sit on the wall: side by side, or one above the other. */
export type Orientation = 'horizontal' | 'vertical';

/**
 * A Combinatie: wall-mounted Toestellen at one spot under one shared cover plate. A Toestel in no
 * Combinatie is a Combinatie of one; a Gang of one is only stored when it has its own Afwerking.
 */
export interface Gang {
  id: Id;
  /**
   * The Toestellen in order: along the wall (to the symbols' +x) when horizontal, outward from the
   * wall when vertical. The first one fixes where the Combinatie sits.
   */
  deviceIds: Id[];
  orientation: Orientation;
  /** Afwerking of this Combinatie; absent means the project default. */
  finish?: string;
}

/** Current version of the project data; older projects are migrated on load (see migrate.ts). */
export const PROJECT_VERSION = 6;

export interface Project {
  version: typeof PROJECT_VERSION;
  id: Id;
  name: string;
  floors: Floor[];
  /** All Toestellen of the project, placed or not. */
  devices: Device[];
  /** The Combinaties of more than one Toestel, or with their own Afwerking. */
  gangs: Gang[];
  /** Default Afwerking of the project, as a name (e.g. "Niko Original zwart"); absent while not chosen. */
  finish?: string;
  createdAt: string;
  updatedAt: string;
}

/** What the user has selected on the canvas. */
export type Selection = { kind: 'wall'; id: Id } | { kind: 'device'; id: Id } | { kind: 'room'; id: Id } | null;

/** One end of a wall, referenced by the wall's id. */
export interface WallEnd {
  wallId: Id;
  end: 'a' | 'b';
}
