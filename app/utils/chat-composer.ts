export type ClipboardFileItem = Pick<
  DataTransferItem,
  "kind" | "type" | "getAsFile"
>;

export function getPastedImageFiles(items: Iterable<ClipboardFileItem>) {
  const images: File[] = [];

  for (const item of items) {
    if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (file) images.push(file);
  }

  return images;
}

export function mergeAttachmentUrls(
  current: string[],
  incoming: string[],
  limit = 3,
) {
  return [...current, ...incoming].slice(0, limit);
}

export function shouldDisableComposerSend(
  uploading: boolean,
  sendDisabled = false,
) {
  return uploading || sendDisabled;
}
