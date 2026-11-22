import {
  controlOf,
  controlRole,
  findControl,
  startControl,
  toggleInControl,
  previewToggle,
} from '../../../model/controls';
import { hitDevice } from '../../../model/devices';
import type { Id } from '../../../model/types';
import { store } from '../../../state/store.svelte';
import type { CanvasPointer, CanvasTool, PressResult } from './tool';

/** Extra screen px around a symbol that still counts as a click on it. */
const HIT_PX = 4;

/** Why a click did not change the Bediening, for the status bar. */
const NOT_ALLOWED = 'Alleen lichtpunten, drukknoppen en schakelaars horen in een bediening.';
const MIXED = 'Een bediening heeft drukknoppen óf schakelaars, niet beide.';

/**
 * Builds Bedieningen: a click on a Lichtpunt, Drukknop or Schakelaar starts a Bediening with it, or
 * adds it to the selected one (or takes it out again). A click on one in another Bediening selects that one.
 */
export class ControlTool implements CanvasTool {
  /** Why the last click was refused, shown instead of the usual help. */
  refusal = $state('');
  readonly snapMark = null;

  get hint(): string {
    if (this.refusal) return this.refusal;
    return this.selectedId()
      ? 'Klik lichtpunten en drukknoppen of schakelaars om ze toe te voegen of weg te halen (ook op een andere verdieping). Esc of klik naast = klaar.'
      : 'Bediening: klik een lichtpunt, drukknop of schakelaar om een bediening te beginnen of te kiezen.';
  }

  pointerDown(p: CanvasPointer): PressResult {
    this.refusal = '';
    const device = hitDevice(store.project.devices, store.floor.id, p.world, HIT_PX * p.cmPerScreenPx);
    if (!device) {
      store.selection = null;
      return 'pan';
    }
    const activeId = this.selectedId();
    const own = controlOf(store.project, device.id);
    if (own && own.id !== activeId) {
      store.selection = { kind: 'control', id: own.id };
    } else if (activeId) {
      const result = previewToggle(store.project, activeId, device.id);
      this.refusal = result === 'notAllowed' ? NOT_ALLOWED : result === 'mixed' ? MIXED : '';
      if (result !== 'added' && result !== 'removed') return null;
      store.mutate((pr) => toggleInControl(pr, activeId, device.id));
      // taking out the last Toestel deletes the Bediening
      if (!findControl(store.project, activeId)) store.selection = null;
    } else if (!controlRole(device)) {
      this.refusal = NOT_ALLOWED;
    } else {
      let id: Id | undefined;
      store.mutate((pr) => (id = startControl(pr, device.id)?.id));
      if (id) store.selection = { kind: 'control', id };
    }
    return null;
  }

  pointerMove() {}

  keyDown(e: KeyboardEvent): boolean {
    if (e.key !== 'Escape' || !this.selectedId()) return false;
    store.selection = null;
    this.refusal = '';
    return true;
  }

  cancel() {
    this.refusal = '';
  }

  private selectedId(): Id | undefined {
    const sel = store.selection;
    return sel?.kind === 'control' && findControl(store.project, sel.id) ? sel.id : undefined;
  }
}
