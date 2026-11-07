import { NextRequest } from "next/server";
import { publicAvailability } from "@/lib/public-availability";

export const GET = (req: NextRequest) => publicAvailability(req);
