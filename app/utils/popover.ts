export type ComposerPopoverPlacement = "top" | "bottom";

const POPOVER_GAP = 10;
const VIEWPORT_MARGIN = 10;
const COMFORTABLE_POPOVER_HEIGHT = 240;

export function getComposerPopoverPlacement(options: {
  triggerTop: number;
  triggerBottom: number;
  viewportHeight: number;
  preferredPlacement: ComposerPopoverPlacement;
}) {
  const space = {
    top: Math.max(
      0,
      Math.floor(options.triggerTop - POPOVER_GAP - VIEWPORT_MARGIN),
    ),
    bottom: Math.max(
      0,
      Math.floor(
        options.viewportHeight -
          options.triggerBottom -
          POPOVER_GAP -
          VIEWPORT_MARGIN,
      ),
    ),
  };
  const alternativePlacement =
    options.preferredPlacement === "bottom" ? "top" : "bottom";
  const preferredSpace = space[options.preferredPlacement];
  const alternativeSpace = space[alternativePlacement];
  const placement =
    preferredSpace >= COMFORTABLE_POPOVER_HEIGHT ||
    preferredSpace >= alternativeSpace
      ? options.preferredPlacement
      : alternativePlacement;

  return { placement, maxHeight: space[placement] };
}
