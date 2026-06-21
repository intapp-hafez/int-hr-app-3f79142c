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

/** Team = direct reports (managerId === me.id) ∪ same-department peers, excluding self. */
export function getTeam(employees: Employee[], me: Employee | undefined): Employee[] {
  if (!me) return [];
  return employees.filter((e) => {
    if (e.id === me.id) return false;
    const mid = (e as any).managerId as string | undefined;
    return mid === me.id || e.dept === me.dept;
  });
}