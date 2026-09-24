export type LeavesTab = "requests" | "permissions" | "balances" | "leaveTypes" | "holidays" | "holidayTypes";

export const LEAVES_TABS: LeavesTab[] = ["requests", "permissions", "balances", "leaveTypes", "holidays", "holidayTypes"];

export const TAB_LABELS: Record<LeavesTab, string> = {
  requests: "leaveRequests",
  permissions: "permissionsAdmin",
  balances: "leaveBalances",
  leaveTypes: "leaveTypesAdmin",
  holidays: "holidaysAdmin",
  holidayTypes: "holidayTypes",
};
