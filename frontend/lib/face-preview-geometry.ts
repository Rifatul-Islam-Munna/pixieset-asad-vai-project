export type FaceBox = { x: number; y: number; width: number; height: number };

/** CSS-only crop around a detected face, using the actual full image dimensions. */
export function facePreviewGeometry(box: FaceBox | undefined, imageWidth: number, imageHeight: number) {
  if (!box || ![box.x, box.y, box.width, box.height, imageWidth, imageHeight].every(Number.isFinite) ||
      imageWidth <= 0 || imageHeight <= 0 || box.x < 0 || box.y < 0 ||
      box.width <= 0 || box.height <= 0 || box.x + box.width > 100.001 ||
      box.y + box.height > 100.001) return null;

  const faceWidth = box.width / 100 * imageWidth;
  const faceHeight = box.height / 100 * imageHeight;
  const side = Math.max(faceWidth, faceHeight) * 1.18;
  const centerX = (box.x + box.width / 2) / 100 * imageWidth;
  const centerY = (box.y + box.height / 2) / 100 * imageHeight;

  // Center the detected face even near image edges. The surrounding neutral
  // background fills any part of the square outside the original frame.
  return {
    width: imageWidth / side * 100 + "%",
    height: imageHeight / side * 100 + "%",
    left: (0.5 - centerX / side) * 100 + "%",
    top: (0.5 - centerY / side) * 100 + "%",
  };
}
