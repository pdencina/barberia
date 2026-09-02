// Compress/normalize an image in the browser before uploading.
//
// Why: phone cameras produce 15-40MB photos, and sometimes formats the server side
// won't take cleanly (HEIC, or files with an empty MIME type). Rather than rejecting
// them and making the user find a smaller image, we downscale + re-encode to JPEG on
// the client, so the upload is always a reasonably small, standard JPEG regardless of
// what the user picked. This also fixes the "no me deja subir JPG" report: whatever
// comes in, goes out as a clean JPEG under the size cap.
//
// Returns a File ready to upload. If anything goes wrong (e.g. the browser can't
// decode a HEIC), it throws so the caller can show a clear message.
export async function compressImage(
  file: File,
  opts: { maxDimension?: number; maxBytes?: number; mimeType?: string } = {}
): Promise<File> {
  const maxDimension = opts.maxDimension ?? 1600; // plenty for a reference photo / logo
  const maxBytes = opts.maxBytes ?? 5 * 1024 * 1024;
  const mimeType = opts.mimeType ?? "image/jpeg";

  // Small enough and already a browser-friendly type? Leave it alone.
  if (file.size <= maxBytes && /^image\/(jpe?g|png|webp)$/i.test(file.type)) {
    return file;
  }

  const dataUrl = await readAsDataURL(file);
  const img = await loadImage(dataUrl);

  let { width, height } = img;
  if (width > maxDimension || height > maxDimension) {
    if (width >= height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen en este navegador.");
  ctx.drawImage(img, 0, 0, width, height);

  // Step the JPEG quality down until it fits under the size cap.
  let quality = 0.9;
  let blob = await canvasToBlob(canvas, mimeType, quality);
  while (blob && blob.size > maxBytes && quality > 0.4) {
    quality -= 0.15;
    blob = await canvasToBlob(canvas, mimeType, quality);
  }
  if (!blob) throw new Error("No se pudo comprimir la imagen.");

  const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], newName, { type: mimeType });
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("No se pudo abrir la imagen. Si es una foto de iPhone (HEIC), guardala como JPG o PNG antes de subir."));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}
