import type { ThermalTicket } from "../handlers/types.ts";
import { getConfig } from "../config.ts";

export async function printTicket(ticket: ThermalTicket): Promise<void> {
  const { thermalUrl, thermalApiKey } = getConfig();

  const res = await fetch(thermalUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": thermalApiKey,
    },
    body: JSON.stringify(ticket),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "(no body)");
    throw new Error(`Thermal printer error ${res.status}: ${body}`);
  }
}
