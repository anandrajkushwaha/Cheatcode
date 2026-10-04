/**
 * A photograph, made small enough to live inside a document row.
 *
 * The whole design is stored as one jsonb value, so an untouched 6MB phone
 * photograph would be 8MB of base64 in a single database row and would be
 * sent again on every autosave. It is resized to fit inside 1400px and then
 * re-encoded at falling quality until it is under 200KB — which is about
 * right for a picture that prints at 40mm across.
 *
 * The aspect ratio is kept rather than cropped square: the frame crops to a
 * circle on its own, and a crop applied here could not be undone.
 *
 * This lives apart from both editors because both of them need it and the
 * limit has to be the same number in both — the route rejects anything over
 * 220KB, so a second copy of this that drifted to 240 would fail the save
 * silently rather than visibly.
 */
export async function compressPhoto(file: File, limit = 200 * 1024): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("That file could not be read."));
    r.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("That does not look like an image."));
    i.src = dataUrl;
  });

  const long = Math.max(img.width, img.height);
  const k = long > 1400 ? 1400 / long : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * k));
  canvas.height = Math.max(1, Math.round(img.height * k));
  canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);

  for (let q = 0.88; q >= 0.4; q -= 0.08) {
    const out = canvas.toDataURL("image/jpeg", q);
    if (out.length * 0.75 <= limit) return out;
  }
  return canvas.toDataURL("image/jpeg", 0.4);
}
