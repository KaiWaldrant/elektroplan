# Calibration moves everything placed on the Verdieping

Items on a Verdieping are traced from its plan, so they share the plan's scale error. Calibrating therefore scales everything placed on that Verdieping (wall ends now; Toestellen, Ruimtes and later items too) with the same factor and around the same first picked point as the background, in one undo step. Sizes that do not come from the plan, such as wall thickness and symbol size, stay as they are. Other Verdiepingen are not touched. When the Verdieping has walls, the calibration dialog says so ("De muren op deze verdieping schalen mee.").

Rejected: warning and asking each time (walls are traced, not measured, in practice) and only allowing calibration before anything is drawn (re-calibrating a plan must stay possible).
