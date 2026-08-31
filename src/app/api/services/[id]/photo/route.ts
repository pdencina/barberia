import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB

// POST: Upload a reference photo for a service (e.g. an example of "perfilado de
// barba"), shown to clients while they're choosing services in the public booking
// flow — similar to the Setmore-style visual reference.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminSupabase();

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (e: any) {
    return NextResponse.json({ error: `No se pudo leer el archivo enviado: ${e.message}` }, { status: 400 });
  }

  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No se recibio ningun archivo" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: `El archivo debe ser una imagen (recibido: ${file.type || "tipo desconocido"})` }, { status: 400 });
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return NextResponse.json(
      { error: `La imagen pesa ${(file.size / 1024 / 1024).toFixed(1)}MB, el maximo permitido es 5MB.` },
      { status: 400 }
    );
  }

  const { data: bucketInfo, error: bucketError } = await supabase.storage.getBucket("cut-photos");
  if (bucketError || !bucketInfo) {
    return NextResponse.json(
      { error: "El almacenamiento de imagenes (bucket 'cut-photos') no esta disponible. Avisa al soporte tecnico." },
      { status: 500 }
    );
  }

  const fileExt = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const fileName = `service-photos/${params.id}.${fileExt}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from("cut-photos")
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("Service photo upload failed:", uploadError);
    return NextResponse.json({ error: `No se pudo subir la imagen: ${uploadError.message}` }, { status: 500 });
  }

  const { data: urlData } = supabase.storage
    .from("cut-photos")
    .getPublicUrl(fileName);

  const imageUrl = `${urlData.publicUrl}?t=${Date.now()}`; // cache bust

  const { error: updateError } = await supabase
    .from("services")
    .update({ image_url: imageUrl })
    .eq("id", params.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ url: imageUrl });
}

// DELETE: Remove the service's reference photo.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createAdminSupabase();

  const { data: service } = await supabase
    .from("services")
    .select("image_url")
    .eq("id", params.id)
    .single();

  if (service?.image_url) {
    const path = service.image_url.split("/cut-photos/")[1]?.split("?")[0];
    if (path) {
      await supabase.storage.from("cut-photos").remove([path]);
    }
  }

  await supabase.from("services").update({ image_url: null }).eq("id", params.id);

  return NextResponse.json({ success: true });
}
