import type { TaskCompletedHook } from "./types.ts";
import { getRandomPasuk } from "../services/sefaria.ts";
import { printTicket } from "../services/printer.ts";
import { buildTaskCompletedTicket } from "../templates/tickets.ts";

export async function handleTaskCompleted(hook: TaskCompletedHook): Promise<void> {
  const description = hook.task_description ?? hook.task ?? "Tarea completada";

  const pasuk = await getRandomPasuk();
  const ticket = buildTaskCompletedTicket(description, hook.cwd, pasuk);

  await printTicket(ticket);
  console.log(`[task_completed] Printed ticket — "${description.slice(0, 40)}"`);
}
