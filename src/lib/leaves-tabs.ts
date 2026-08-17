export type LeavesTab = "requests" | "balances" | "leaveTypes" | "holidays" | "holidayTypes";

export const LEAVES_TABS: LeavesTab[] = ["requests", "balances", "leaveTypes", "holidays", "holidayTypes"];

export const TAB_LABELS: Record<LeavesTab, string> = {
  requests: "leaveRequests",
  balances: "leaveBalances",
  leaveTypes: "leaveTypesAdmin",
  holidays: "holidaysAdmin",
  holidayTypes: "holidayTypes",
};
