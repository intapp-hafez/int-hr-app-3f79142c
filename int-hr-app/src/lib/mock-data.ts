export type AttendanceStatus = "present" | "late" | "absent" | "leave" | "holiday" | "weekend";

export const todayStats = {
  totalEmployees: 248,
  present: 192,
  late: 14,
  absent: 22,
  onLeave: 20,
  attendanceRate: 83,
};

export const liveActivity = [
  { id: 1, name: "Hafez Rahim", action: "checked in", time: "08:42", branch: "Cairo HQ", status: "present" as const },
  { id: 2, name: "Omar Khalid", action: "checked in", time: "08:51", branch: "Alexandria Office", status: "late" as const },
  { id: 3, name: "Layla Hassan", action: "leave approved", time: "08:30", branch: "Cairo HQ", status: "leave" as const },
  { id: 4, name: "Yousef Saleh", action: "checked in", time: "09:05", branch: "Giza Branch", status: "late" as const },
  { id: 5, name: "Mariam Noor", action: "checked out", time: "17:32", branch: "Cairo HQ", status: "present" as const },
];

export const employees = [
  { id: "INT-001", name: "Hafez Rahim", email: "hafez@int.app", phone: "+20 100 123 4567", dept: "Engineering", role: "Senior Developer", status: "Active", branch: "Cairo HQ", salary: 22000, allowance: 2500, target: 20, targetDuration: "Monthly", password: "hafez@2026", managerId: "" },
  { id: "INT-002", name: "Omar Khalid", email: "omar@int.app", phone: "+20 101 234 5678", dept: "Sales", role: "Account Manager", status: "Active", branch: "Alexandria Office", salary: 18000, allowance: 2000, target: 22, targetDuration: "Monthly", password: "omar@2026", managerId: "INT-001" },
  { id: "INT-003", name: "Layla Hassan", email: "layla@int.app", phone: "+20 102 345 6789", dept: "Engineering", role: "HR Specialist", status: "Active", branch: "Cairo HQ", salary: 15000, allowance: 1500, target: 20, targetDuration: "Monthly", password: "layla@2026", managerId: "INT-001" },
  { id: "INT-004", name: "Yousef Saleh", email: "yousef@int.app", phone: "+20 106 456 7890", dept: "Operations", role: "Ops Lead", status: "Active", branch: "Giza Branch", salary: 17000, allowance: 1800, target: 21, targetDuration: "Monthly", password: "yousef@2026", managerId: "INT-001" },
  { id: "INT-005", name: "Mariam Noor", email: "mariam@int.app", phone: "+20 109 567 8901", dept: "Engineering", role: "Product Designer", status: "Active", branch: "Cairo HQ", salary: 16500, allowance: 1500, target: 20, targetDuration: "Monthly", password: "mariam@2026", managerId: "INT-001" },
  { id: "INT-006", name: "Khaled Ibrahim", email: "khaled@int.app", phone: "+20 111 678 9012", dept: "Finance", role: "Accountant", status: "Inactive", branch: "Cairo HQ", salary: 14000, allowance: 1200, target: 20, targetDuration: "Monthly", password: "khaled@2026", managerId: "" },
  { id: "INT-007", name: "Sara Al-Qahtani", email: "sara@int.app", phone: "+20 112 789 0123", dept: "Marketing", role: "Marketing Lead", status: "Active", branch: "Alexandria Office", salary: 19000, allowance: 2200, target: 22, targetDuration: "Monthly", password: "sara@2026", managerId: "" },
];

export const locations = [
  { id: 1, name: "Cairo HQ", lat: 30.0444, lng: 31.2357, radius: 120, active: true },
  { id: 2, name: "Alexandria Office", lat: 31.2001, lng: 29.9187, radius: 80, active: true },
  { id: 3, name: "Giza Branch", lat: 30.0131, lng: 31.2089, radius: 60, active: true },
];

export const wifiNetworks = [
  { id: 1, label: "INT-Cairo-Secure", ssid: "INT-Cairo-Secure", branch: "Cairo HQ", ip: "156.205.10.10", active: true },
  { id: 2, label: "INT-Alexandria", ssid: "INT-Alexandria", branch: "Alexandria Office", ip: "156.205.22.22", active: true },
  { id: 3, label: "INT-Giza", ssid: "INT-Giza", branch: "Giza Branch", ip: "156.205.34.34", active: false },
];

export const leaveRequests = [
  { id: 1, name: "Omar Khalid", type: "Annual Leave", start: "2026-05-20", end: "2026-05-24", status: "Pending" },
  { id: 2, name: "Layla Hassan", type: "Sick Leave", start: "2026-05-18", end: "2026-05-18", status: "Approved" },
  { id: 3, name: "Yousef Saleh", type: "Emergency", start: "2026-05-22", end: "2026-05-22", status: "Pending" },
  { id: 4, name: "Mariam Noor", type: "Hajj/Umrah", start: "2026-06-10", end: "2026-06-20", status: "Approved" },
  { id: 5, name: "Sara Al-Qahtani", type: "Unpaid", start: "2026-05-30", end: "2026-06-02", status: "Rejected" },
];

export const holidays = [
  { id: 1, name: "Eid Al-Fitr", date: "2026-05-21", type: "Religious" },
  { id: 2, name: "Revolution Day (25 Jan)", date: "2027-01-25", type: "National" },
  { id: 3, name: "Sinai Liberation Day", date: "2027-04-25", type: "National" },
  { id: 4, name: "Eid Al-Adha", date: "2026-07-28", type: "Religious" },
  { id: 5, name: "23 July Revolution Day", date: "2026-07-23", type: "National" },
  { id: 6, name: "Coptic Christmas", date: "2027-01-07", type: "Religious" },
];

export const myAttendance = [
  { date: "2026-05-15", in: "08:32", out: "17:18", hours: "8h 46m", status: "present" as AttendanceStatus },
  { date: "2026-05-14", in: "09:07", out: "17:35", hours: "8h 28m", status: "late" as AttendanceStatus },
  { date: "2026-05-13", in: "08:28", out: "17:10", hours: "8h 42m", status: "present" as AttendanceStatus },
  { date: "2026-05-12", in: "—", out: "—", hours: "—", status: "leave" as AttendanceStatus },
  { date: "2026-05-11", in: "08:45", out: "17:22", hours: "8h 37m", status: "present" as AttendanceStatus },
  { date: "2026-05-10", in: "—", out: "—", hours: "—", status: "weekend" as AttendanceStatus },
  { date: "2026-05-09", in: "—", out: "—", hours: "—", status: "weekend" as AttendanceStatus },
];

export const myNotifications = [
  { id: 1, title: "Check-in successful", body: "Recorded at Cairo HQ • 08:32", time: "2h ago", tone: "success" as const },
  { id: 2, title: "Leave approved", body: "Your annual leave for May 20–24 was approved.", time: "1d ago", tone: "info" as const },
  { id: 3, title: "Upcoming holiday", body: "Eid Al-Fitr on May 21. Office closed.", time: "2d ago", tone: "warning" as const },
  { id: 4, title: "Unauthorized network blocked", body: "Check-in attempt from public Wi-Fi was blocked.", time: "3d ago", tone: "danger" as const },
];

export const myMessages = [
  { id: 1, from: "Layla Hassan", role: "HR Specialist", preview: "Hi Hafez, can you confirm your leave dates for next month?", time: "10m", unread: true },
  { id: 2, from: "Yousef Saleh", role: "Ops Lead", preview: "Standup moved to 9:30 tomorrow. Please join from Cairo HQ.", time: "1h", unread: true },
  { id: 3, from: "Mariam Noor", role: "Product Designer", preview: "Sent you the new dashboard mockups — let me know your thoughts.", time: "3h", unread: false },
  { id: 4, from: "Omar Khalid", role: "Account Manager", preview: "Client call Friday at 2pm. Adding you to the invite.", time: "Yesterday", unread: false },
  { id: 5, from: "HR Team", role: "Announcement", preview: "Reminder: payslips for May are now available.", time: "2d", unread: false },
];
