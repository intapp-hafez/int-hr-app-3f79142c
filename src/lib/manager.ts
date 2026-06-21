import { getState, type Employee } from "./store";
import type { Session } from "./auth";

/** Resolve the manager's own employee record from their session. */
export function getManagerEmployee(session: Session | null): Employee | undefined {
  if (!session) return undefined;
  const employees = getState().employees;
  if (session.employeeId) {
    const byId = employees.find((e) => e.id === session.employeeId);
    if (byId) return byId;
  }
  return employees.find((e) => e.name === session.name);
}

/** Team = direct reports of this manager (managerId === me.id), excluding self. */
export function getTeam(employees: Employee[], me: Employee | undefined): Employee[] {
  if (!me) return [];
  return employees.filter((e) => {
    if (e.id === me.id) return false;
    const mid = (e as { managerId?: string }).managerId;
    return mid === me.id;
  });
}