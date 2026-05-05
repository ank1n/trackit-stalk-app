export const colors = {
  primary: "#3F76FF",
  primaryLight: "#E8EEFA",
  background: "#FFFFFF",
  surface: "#F5F5F5",
  text: "#171717",
  textSecondary: "#737373",
  textTertiary: "#A3A3A3",
  border: "#E5E5E5",
  error: "#EF4444",
  success: "#22C55E",
  warning: "#F59E0B",
  priorityUrgent: "#EF4444",
  priorityHigh: "#F97316",
  priorityMedium: "#EAB308",
  priorityLow: "#3B82F6",
  priorityNone: "#A3A3A3",
  stateBacklog: "#A3A3A3",
  stateUnstarted: "#3B82F6",
  stateStarted: "#F59E0B",
  stateCompleted: "#22C55E",
  stateCancelled: "#EF4444",
};

export const priorityColors: Record<string, string> = {
  urgent: colors.priorityUrgent,
  high: colors.priorityHigh,
  medium: colors.priorityMedium,
  low: colors.priorityLow,
  none: colors.priorityNone,
};

export const stateGroupColors: Record<string, string> = {
  backlog: colors.stateBacklog,
  unstarted: colors.stateUnstarted,
  started: colors.stateStarted,
  completed: colors.stateCompleted,
  cancelled: colors.stateCancelled,
};
