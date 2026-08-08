export type UserRole = 'employee' | 'manager' | 'finance' | 'B';

export type ClaimStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Pending Release' | 'Paid';

export interface Attachment {
  id: string;
  name: string;
  uri: string;
  size?: number;
  type?: string;
}

export interface WorkflowEvent {
  step: string;
  actor: string;
  timestamp: string;
  outcome: string;
  remarks?: string;
}

export interface ExpenseClaim {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  designation: string;
  claimDate: string;
  createdOn?: string;
  createdTime?: string;
  expenseDate?: string;
  expenseType: string;
  itemNo?: string;
  amount: number;
  costCenter: string;
  justification: string;
  attachments: Attachment[];
  status: ClaimStatus;
  workflowHistory: WorkflowEvent[];
  currentApprover?: string;
  rawStatus?: string;
}

export interface SAPError {
  id: string;
  claimId: string;
  errorType: string;
  errorMessage: string;
  rootCause: string;
  status: 'Failed' | 'Resolved';
  resolutionHistory: {
    timestamp: string;
    resolvedBy: string;
    notes: string;
  }[];
}

export interface ClaimKPIs {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  paid: number;
  last3MonthsTotal: number;
}

export interface EmployeeProfile {
  employeeId: string;
  employeeName: string;
  name?: string;
  department: string;
  designation: string;
  role: UserRole;
}
