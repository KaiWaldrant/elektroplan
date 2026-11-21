import type { Device } from '../../model/types';

/** Drag-and-drop data type for a Toestel dragged from the palette onto the plan; the data is its type. */
export const DEVICE_DRAG_TYPE = 'application/x-elektroplan-device';

export const isDeviceType = (t: string): t is Device['type'] => t === 'lightPoint';
