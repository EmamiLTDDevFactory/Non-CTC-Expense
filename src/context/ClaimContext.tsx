import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../config/api';
import { ClaimKPIs, ClaimStatus, ExpenseClaim, SAPError } from '../types';
import { useAuth } from './AuthContext';

interface ClaimContextType {
  claims: ExpenseClaim[];
  errors: SAPError[];
  historyEntries: any[];
  kpis: ClaimKPIs;
  autoApprovalThreshold: number;
  policyLimit: number;
  // Claim Actions
  addClaim: (claimData: Omit<ExpenseClaim, 'id' | 'status' | 'workflowHistory'>, isDraft: boolean, ignoreDuplicateWarn?: boolean) => Promise<{ success: boolean; warning?: string; claimId?: string }>;
  updateDraft: (id: string, claimData: Partial<ExpenseClaim>, isDraft: boolean) => { success: boolean; warning?: string };
  deleteClaim: (id: string) => void;
  // Manager Actions
  approveClaim: (id: string) => void;
  rejectClaim: (id: string, remarks: string) => { success: boolean; error?: string };
  requestClarification: (id: string, remarks: string) => void;
  // Finance Actions
  validateClaimFinance: (id: string) => void;
  releasePayment: (id: string) => Promise<{ success: boolean; error?: string }>;
  rejectClaimFinance: (id: string, remarks: string) => Promise<{ success: boolean; error?: string }>;
  // Error Management Actions
  retrySAPPosting: (errorId: string) => void;
  // Getters & Filters
  getClaimById: (id: string) => ExpenseClaim | undefined;
  filterClaims: (roleFilter?: 'employee' | 'manager' | 'finance', search?: string, expenseType?: string, status?: string) => ExpenseClaim[];
  fetchClaims: () => Promise<void>;
  fetchHistorySet: () => Promise<void>;
  expenseTypes: any[];
  fetchExpenseTypes: () => Promise<void>;
  // RESUBMIT_FEATURE: Temporary storage for resubmit workflow
  tempClaimForResubmit: any | null;
  setTempClaimForResubmit: (claim: any | null) => void;
}

// Initial mock data removed as per user request to only see real data
const INITIAL_CLAIMS: ExpenseClaim[] = [];

const INITIAL_ERRORS: SAPError[] = [
  {
    id: 'ERR-501',
    claimId: 'CLM-1005',
    errorType: 'SAP Posting Failure',
    errorMessage: 'Account assignment 650090 blocked for direct posting.',
    rootCause: 'Cost Center CC-ENG-GLOBAL is locked for the current fiscal period in FI module.',
    status: 'Failed',
    resolutionHistory: [
      { timestamp: '2026-06-23 09:16', resolvedBy: 'System AI Diagnostic', notes: 'Initial posting attempt failed during background sync.' }
    ]
  },
  {
    id: 'ERR-502',
    claimId: 'CLM-1001',
    errorType: 'RFC Gateway Timeout',
    errorMessage: 'Destination SAP_ERP_FIN unreachable.',
    rootCause: 'Temporary network disruption between SAP Cloud Connector and on-premise gateway.',
    status: 'Resolved',
    resolutionHistory: [
      { timestamp: '2026-06-16 10:21', resolvedBy: 'System AI Diagnostic', notes: 'Timeout detected.' },
      { timestamp: '2026-06-16 11:45', resolvedBy: 'Alex Wong (Admin)', notes: 'Manually re-triggered SAP RFC queue. Posting completed successfully.' }
    ]
  }
];

const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
]);

const ALLOWED_ATTACHMENT_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'xls', 'xlsx', 'csv', 'txt']);

// Reads a picked attachment (blob: or file: uri) into a plain base64 string, so it can travel
// as JSON text instead of a raw binary multipart upload.
const readAttachmentAsBase64 = (uri: string): Promise<string> => {
  return fetch(uri)
    .then(res => res.blob())
    .then(blob => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = (reader.result as string) || '';
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    }));
};

const parseCostCenter = (ccStr?: string) => {
  if (!ccStr) return { costCenter: '', ltext: '' };
  const match = ccStr.match(/^([^\(]+)(?:\((.*)\))?$/);
  if (match) {
    const costCenter = (match[1] || '').trim();
    const ltext = (match[2] || '').trim();
    return { costCenter, ltext };
  }
  return { costCenter: ccStr.trim(), ltext: '' };
};

const ClaimContext = createContext<ClaimContextType | undefined>(undefined);

export const ClaimProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [claims, setClaims] = useState<ExpenseClaim[]>(INITIAL_CLAIMS);
  const [errors, setErrors] = useState<SAPError[]>(INITIAL_ERRORS);
  const [historyEntries, setHistoryEntries] = useState<any[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<any[]>([]);
  // RESUBMIT_FEATURE: State to hold claim data for resubmit workflow
  const [tempClaimForResubmit, setTempClaimForResubmit] = useState<any | null>(null);
  const { currentUser } = useAuth();

  const autoApprovalThreshold = 100.00;
  const policyLimit = 1000.00;

  // RESUBMIT_FEATURE: Handler to set/clear temporary claim data
  const handleSetTempClaimForResubmit = (claim: any | null) => {
    setTempClaimForResubmit(claim);
  };

  const fetchExpenseTypes = async () => {
    try {
      const loginIdForSAP = currentUser?.employeeId?.replace(/\D/g, '').padStart(8, '0') || '';
      const url = `${API_BASE_URL}/api/get-expense-types${loginIdForSAP ? `?loginId=${loginIdForSAP}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) return;
      
      const data = await response.json();
      const sapTypes = data.d?.results || data.value || [];
      
      if (sapTypes.length > 0) {
        // Map the SAP expense types to objects containing the ID, Name, and Saknr
        const mappedTypes = sapTypes.map((item: any) => ({
           id: item.ZslNo || item.ExpenseType || '00001',
           name: item.ZglName || item.Description || item.Exptype || 'Unknown Type',
           saknr: item.Saknr || ''
        }));
        setExpenseTypes(mappedTypes);
      }
    } catch (err) {
      console.error("Failed to fetch SAP expense types:", err);
    }
  };

  const fetchClaims = async () => {
    try {
      // Don't fetch until the user is actually loaded from AuthContext
      if (!currentUser?.employeeId) return;

      // Extract numeric PERNR from currentUser
      const loginIdForSAP = currentUser.employeeId.replace(/\D/g, '').padStart(8, '0');
      
      const response = await fetch(`${API_BASE_URL}/api/get-data?loginId=${loginIdForSAP}&expand=CLAIMNAV`);
      if (!response.ok) return;
      
      const data = await response.json();
      
      let sapClaims = [];
      if (data.d && data.d.results) {
          sapClaims = data.d.results; // GET_ENTITYSET format
      } else if (data.d) {
          sapClaims = [data.d]; // GET_ENTITY format
      } else if (data.value) {
          sapClaims = data.value; // OData V4 format
      } else if (data.EmpId) {
          sapClaims = [data]; // Flat object fallback
      } else if (Array.isArray(data)) {
          sapClaims = data; // Direct array fallback
      }
      
      const mappedClaims: ExpenseClaim[] = sapClaims.map((sap: any) => {
          let status: ClaimStatus = 'Submitted';
          if (sap.Status === 'D') status = 'Draft';
          if (sap.Status === 'A') status = 'Approved';
          if (sap.Status === 'R') status = 'Rejected';
          if (sap.Status === 'P' || sap.Status === 's' || sap.Status === 'S') status = 'Paid';
          
          let expenseType = '';
          let justification = '';
          let expenseDate = '';
          let itemNo = '';
          expenseType = sap.ZglName || sap.ExpenseType || '';
          if (sap.CLAIMNAV && sap.CLAIMNAV.results && sap.CLAIMNAV.results.length > 0) {
              const firstLine = sap.CLAIMNAV.results[0];
              expenseType = expenseType || firstLine.ZglName || firstLine.ExpenseType || '';
              if (!firstLine.ZglName && firstLine.ExpenseType) {
                const matchedType = expenseTypes.find(et => et.id === firstLine.ExpenseType || et.name === firstLine.ExpenseType);
                if (matchedType) {
                  expenseType = matchedType.name;
                }
              }
              justification = firstLine.Description || '';
              expenseDate = firstLine.ExpenseDate || '';
              itemNo = firstLine.ItemNo || '';
          } else if (sap.CLAIMNAV && sap.CLAIMNAV.length > 0) {
              const firstLine = sap.CLAIMNAV[0];
              expenseType = expenseType || firstLine.ZglName || firstLine.ExpenseType || '';
              if (!firstLine.ZglName && firstLine.ExpenseType) {
                const matchedType = expenseTypes.find(et => et.id === firstLine.ExpenseType || et.name === firstLine.ExpenseType);
                if (matchedType) {
                  expenseType = matchedType.name;
                }
              }
              justification = firstLine.Description || '';
              expenseDate = firstLine.ExpenseDate || '';
              itemNo = firstLine.ItemNo || '';
          }

          // Handle ClaimDate (use CreatedOn as fallback if ClaimDate is null)
          let claimDateStr = '';
          const dateToParse = sap.ClaimDate || sap.CreatedOn;
          if (dateToParse) {
              if (dateToParse.includes('Date(')) {
                  const ts = parseInt(dateToParse.replace(/\D/g, ''), 10);
                  claimDateStr = new Date(ts).toISOString().split('T')[0];
              } else {
                  claimDateStr = dateToParse.split('T')[0];
              }
          }

          // Map attachments if Base64 data is present in the line items
          const attachments = [];
          if (sap.CLAIMNAV && sap.CLAIMNAV.results) {
              sap.CLAIMNAV.results.forEach((item: any) => {
                  if (item.Filename && item.Value) {
                      attachments.push({
                          name: item.Filename,
                          type: item.Mimetype || 'application/pdf',
                          uri: `data:${item.Mimetype || 'application/pdf'};base64,${item.Value}`
                      });
                  }
              });
          }

          return {
            id: sap.ClaimId,
            employeeId: sap.EmpId,
            employeeName: sap.EmpName,
            department: sap.Department,
            designation: sap.Designation,
            claimDate: claimDateStr || new Date().toISOString().split('T')[0],
            createdOn: sap.CreatedOn || sap.ClaimDate || '',
            createdTime: sap.CreatedTime || '',
            expenseDate,
            expenseType,
            itemNo,
            amount: parseFloat(sap.TotalAmount) || 0,
            costCenter: sap.CostCenter,
            justification,
            attachments,
            currentApprover: sap.CurrentApprover || sap.currentApprover || '',
            status,
            rawStatus: sap.Status || '',
            workflowHistory: []
          };
      });
      // Replace the existing claims with the latest fetched set (clear when SAP returns empty)
      setClaims(mappedClaims);
    } catch (err) {
      console.error("Failed to fetch SAP claims:", err);
    }
  };

  const fetchHistorySet = useCallback(async () => {
    try {
      if (!currentUser?.employeeId) return;

      const loginIdForSAP = currentUser.employeeId.replace(/\D/g, '').padStart(8, '0');
      const response = await fetch(`${API_BASE_URL}/api/history-set?loginId=${loginIdForSAP}`);
      if (!response.ok) return;

      const data = await response.json();
      const history = data.d?.results || data.value || data.d || [];
      setHistoryEntries(Array.isArray(history) ? history : history ? [history] : []);
    } catch (err) {
      console.error('Failed to fetch SAP history set:', err);
    }
  }, [currentUser?.employeeId]);

  // BR-001: Calculate KPIs dynamically
  const kpis = useMemo<ClaimKPIs>(() => {
    let total = 0;
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let paid = 0;
    let last3MonthsTotal = 0;

    const normalizeId = (id?: string) => (id || '').toString().replace(/\D/g, '').padStart(8, '0');
    const userNumeric = normalizeId(currentUser?.employeeId);

    claims.forEach(c => {
      // Always filter KPI calculations to the logged-in user's claims by comparing LoginID == EmpId
      if (currentUser && normalizeId(c.employeeId) !== userNumeric) return;

      if (c.status !== 'Draft') total++;
      if (c.status === 'Submitted') pending++;
      if (c.status === 'Approved' || c.status === 'Pending Release') approved++;
      if (c.status === 'Rejected') rejected++;
      if (c.status === 'Paid') paid++;
    });

    // Compute Last 3 Months Paid Total (defensive parsing)
    try {
      const now = new Date();
      const cutoff = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      last3MonthsTotal = claims.reduce((sum, c) => {
        if (!c || c.status !== 'Paid') return sum;
        // Ensure claim belongs to current user
        if (currentUser && normalizeId(c.employeeId) !== userNumeric) return sum;
        const d = c.claimDate ? new Date(c.claimDate) : null;
        if (!d || Number.isNaN(d.getTime())) return sum;
        if (d >= cutoff) return sum + (typeof c.amount === 'number' ? c.amount : parseFloat(String(c.amount) || '0'));
        return sum;
      }, 0);
    } catch (e) {
      console.warn('Failed to compute last3MonthsTotal', e);
      last3MonthsTotal = 0;
    }

    return { total, pending, approved, rejected, paid, last3MonthsTotal };
  }, [claims]);

  const getCurrentTimestamp = () => {
    const now = new Date();
    return now.toISOString().replace('T', ' ').substring(0, 16);
  };

  // BR-002, BR-003, BR-004, BR-005, BR-006: Create Claim Logic
  const addClaim = async (claimData: Omit<ExpenseClaim, 'id' | 'status' | 'workflowHistory'>, isDraft: boolean, ignoreDuplicateWarn = false, existingClaimId: string = '') => {
    // 1. Local Validation
    if (!isDraft) {
      if (!claimData.claimDate || !claimData.expenseType || claimData.expenseType === 'Select Expense Type' || !claimData.amount || !claimData.costCenter) {
        return { success: false, warning: 'Please fill in all mandatory fields before submitting.' };
      }
      // BR-003: Mandatory attachment check
      if (!claimData.attachments || claimData.attachments.length === 0) {
        return { success: false, warning: 'Supporting documents (at least 1 attachment) are mandatory for submitting a claim.' };
      }

      const invalidAttachment = claimData.attachments.find(att => {
        const extension = (att.name?.split('.').pop() || '').toLowerCase();
        const type = (att.type || '').toLowerCase();
        return !ALLOWED_ATTACHMENT_EXTENSIONS.has(extension) || !ALLOWED_ATTACHMENT_MIME_TYPES.has(type);
      });

      if (invalidAttachment) {
        return { success: false, warning: 'Unsupported attachment type. Allowed file types: PDF, PNG, JPG, JPEG, XLS, XLSX, CSV, TXT.' };
      }

      // BR-005: Duplicate claim check (Local Optimistic Check)
      if (!ignoreDuplicateWarn) {
        const isDuplicate = claims.some(c => 
          c.employeeId === claimData.employeeId && 
          c.claimDate === claimData.claimDate && 
          c.amount === claimData.amount &&
          c.status !== 'Draft' &&
          c.status !== 'Rejected'
        );
        if (isDuplicate) {
          return { success: false, warning: 'DUPLICATE_DETECTED: A claim with the exact same Employee ID, Claim Date, and Amount already exists. Do you wish to continue?' };
        }
      }
    }

    // Find the selected SAP expense type object
    const selectedSapType = expenseTypes.find(et => et.name === claimData.expenseType);

    // 2. Build the exact Deep Entity payload SAP expects
    const empIdNumeric = claimData.employeeId.replace(/\D/g, '').padStart(8, '0');
    
    const numAttachments = claimData.attachments && claimData.attachments.length > 0 
      ? claimData.attachments.length 
      : 1;

    const claimNavItems = [];
    for (let i = 0; i < numAttachments; i++) {
      claimNavItems.push({
        ClaimId: existingClaimId ? existingClaimId : '',
        ItemNo: i === 0 ? (claimData.itemNo || '000001') : (i + 1).toString().padStart(6, '0'),
        ExpenseType: selectedSapType ? selectedSapType.id : claimData.expenseType,
        ZglName: selectedSapType ? selectedSapType.name : claimData.expenseType,
        Saknr: selectedSapType ? selectedSapType.saknr : '',
        ExpenseDate: claimData.expenseDate || null,
        Amount: i === 0 ? claimData.amount.toFixed(3) : '0.000',
        Currency: 'INR',
        Description: claimData.justification || 'Expense',
        VendorName: 'External Vendor'
      });
    }

    const { costCenter: ccCode, ltext: ccLtext } = parseCostCenter(claimData.costCenter);

    const sapPayload = {
        ClaimId: existingClaimId ? existingClaimId : '', // Create-time empty, resubmit uses existing claim ID
        EmpId: empIdNumeric,
        EmpName: claimData.employeeName || 'Unknown',
        Department: claimData.department || 'IT',
        Designation: claimData.designation || 'Staff',
        TotalAmount: claimData.amount.toFixed(3),
        Currency: 'INR',
        CostCenter: ccCode || claimData.costCenter,
        Ltext: ccLtext,
        Status: isDraft ? 'D' : 'N',
        CLAIMNAV: claimNavItems
    };

    // 3. Send request to Node.js Backend
    // Attachments travel as base64 inside the JSON body rather than a raw multipart upload —
    // binary multipart data was getting corrupted in transit through the Lambda Function URL.
    try {
        const attachmentsPayload = [];
        if (claimData.attachments && claimData.attachments.length > 0) {
            for (let i = 0; i < claimData.attachments.length; i++) {
                const att = claimData.attachments[i];
                const base64 = await readAttachmentAsBase64(att.uri);
                attachmentsPayload.push({
                    fieldName: `receipt_${i}`,
                    name: att.name,
                    type: att.type || 'application/octet-stream',
                    base64,
                });
            }
        }

        const response = await fetch(`${API_BASE_URL}/api/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                claimData: sapPayload,
                attachments: attachmentsPayload,
            }),
        });

        let responseData: any = null;
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            responseData = await response.json();
        } else {
            const text = await response.text();
            responseData = { error: text || 'Server returned an unexpected response.' };
        }

        console.log('[SUBMIT] Response Status:', response.status);
        console.log('[SUBMIT] Response Data:', responseData);

        // 5. Handle SAP Errors
        if (!response.ok) {
            const isHtml = typeof responseData.error === 'string' && responseData.error.trim().startsWith('<');
            let sapErrorMessage = 'Unknown SAP Error';
            if (response.status === 413) {
                sapErrorMessage = 'Uploaded file is too large. Please attach a smaller file.';
            } else if (isHtml) {
                sapErrorMessage = 'Server error. Please try again or upload a smaller file.';
            } else {
                sapErrorMessage = responseData?.error?.message?.value || responseData?.error || 'Unknown SAP Error';
            }
            console.error('[SUBMIT] Error:', sapErrorMessage);
            return { success: false, warning: sapErrorMessage };
        }

        // 6. Success! Update local UI state
        const newId = responseData?.d?.ClaimId || responseData?.ClaimId || `CLM-${Math.floor(1000 + Math.random() * 9000)}`;
        console.log('[SUBMIT] Success! Claim ID:', newId);
        
        let status: ClaimStatus = isDraft ? 'Draft' : 'Submitted';
        let outcome = isDraft ? 'Draft' : 'Submitted';
        let remarks = isDraft ? 'Saved as draft.' : 'Submitted for approval.';

        // Auto-approval logic removed as requested. Always set to Submitted.

        const newClaim: ExpenseClaim = {
          ...claimData,
          id: newId,
          status,
          workflowHistory: [
            {
              step: isDraft ? 'Draft Created' : 'Submission',
              actor: `${currentUser?.employeeName || 'Unknown'} (${currentUser?.role || 'Unknown'})`,
              timestamp: getCurrentTimestamp(),
              outcome,
              remarks,
            }
          ]
        };

        // FIX: Replace old claim if resubmitting (existingClaimId set), otherwise add new
        if (existingClaimId) {
          // Resubmit case: replace old version with new version
          setClaims(prev => prev.map(c => c.id === existingClaimId ? newClaim : c));
        } else {
          // New claim case: add to beginning
          setClaims(prev => [newClaim, ...prev]);
        }
        console.log('[SUBMIT] Returning success');
        return { success: true, claimId: newId };

      } catch (err: any) {
          console.error('[SUBMIT] Catch Error:', err);
          const message = err?.message || 'Failed to reach the backend server.';
          const cleanMessage = message.includes('Unexpected token <')
            ? 'Server returned an invalid response. Please try again.'
            : message;
        return { success: false, warning: `Failed to reach the backend server. ${cleanMessage}` };
      }
    };
  // Update draft claim
  const updateDraft = (id: string, claimData: Partial<ExpenseClaim>, isDraft: boolean) => {
    const existing = claims.find(c => c.id === id);
    if (!existing) return { success: false, warning: 'Claim not found.' };

    if (!isDraft) {
      const merged = { ...existing, ...claimData };
      if (!merged.claimDate || !merged.expenseType || !merged.amount || !merged.costCenter) {
        return { success: false, warning: 'Please fill in all mandatory fields before submitting.' };
      }
      if (!merged.attachments || merged.attachments.length === 0) {
        return { success: false, warning: 'Supporting documents (at least 1 attachment) are mandatory for submitting a claim.' };
      }
    }

    let status: ClaimStatus = isDraft ? 'Draft' : 'Submitted';
    let outcome = isDraft ? 'Draft Updated' : 'Submitted';
    let remarks = isDraft ? 'Updated draft details.' : 'Submitted from draft.';

    // Auto-approval logic removed as requested. Always set to Submitted.

    setClaims(prev => prev.map(c => {
      if (c.id === id) {
        return {
          ...c,
          ...claimData,
          status,
          workflowHistory: [
            ...c.workflowHistory,
            {
              step: isDraft ? 'Draft Updated' : 'Submission',
              actor: `${currentUser.employeeName} (${currentUser.role})`,
              timestamp: getCurrentTimestamp(),
              outcome,
              remarks
            }
          ]
        };
      }
      return c;
    }));

    return { success: true };
  };

  const deleteClaim = (id: string) => {
    setClaims(prev => prev.filter(c => c.id !== id));
  };

  // BR-009, BR-011: Manager Approve
  const approveClaim = async (id: string) => {
    const claim = claims.find(c => c.id === id);
    if (!claim) return { success: false, error: 'Claim not found' };

    try {
      const selectedSapType = expenseTypes.find(et => et.name === claim.expenseType);
      const empIdNumeric = claim.employeeId.replace(/\D/g, '').padStart(8, '0');
      
      const loginIdNumeric = currentUser?.employeeId?.replace(/\D/g, '').padStart(8, '0') || '';
      const putData = {
          ClaimId: claim.id, // Must be the actual Claim ID from SAP
          EmpId: empIdNumeric,
          LoginId: loginIdNumeric, // The manager/finance user approving the claim
          EmpName: claim.employeeName || 'Unknown',
          Department: claim.department || 'IT',
          Designation: claim.designation || 'Staff',
          TotalAmount: claim.amount.toFixed(3),
          Currency: 'INR',
          CostCenter: claim.costCenter,
          Status: 'A', // Sending Approved status
          ApprovalRequired: 'A' // Action: Approve
      };

      const response = await fetch(`${API_BASE_URL}/api/approve-claim/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ putData })
      });

      if (!response.ok) {
        let errMsg = 'SAP Backend rejected the approval';
        try {
          const errData = await response.json();
          if (errData.error) errMsg = errData.error;
        } catch (e) {}
        throw new Error(errMsg);
      }

      setClaims(prev => prev.map(c => {
        if (c.id === id) {
          return {
            ...c,
            status: 'Approved',
            rawStatus: c.rawStatus === 'N' ? 'A' : 'H',
            currentApprover: '',
            workflowHistory: [
              ...c.workflowHistory,
              {
                step: 'Manager Review',
                actor: `${currentUser?.employeeName} (Manager)`,
                timestamp: getCurrentTimestamp(),
                outcome: 'Approved',
                remarks: 'Approved by department manager.'
              }
            ]
          };
        }
        return c;
      }));

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // BR-010, BR-011: Manager Reject with mandatory remarks
  const rejectClaim = async (id: string, remarks: string) => {
    if (!remarks || remarks.trim() === '') {
      return { success: false, error: 'Rejection remarks are mandatory.' };
    }

    const claim = claims.find(c => c.id === id);
    if (!claim) return { success: false, error: 'Claim not found' };

    try {
      const selectedSapType = expenseTypes.find(et => et.name === claim.expenseType);
      const empIdNumeric = claim.employeeId.replace(/\D/g, '').padStart(8, '0');
      
      const loginIdNumeric = currentUser?.employeeId?.replace(/\D/g, '').padStart(8, '0') || '';
      const putData = {
          ClaimId: claim.id, // Must be the actual Claim ID from SAP
          EmpId: empIdNumeric,
          LoginId: loginIdNumeric, // The manager/finance user rejecting the claim
          EmpName: claim.employeeName || 'Unknown',
          Department: claim.department || 'IT',
          Designation: claim.designation || 'Staff',
          TotalAmount: claim.amount.toFixed(3),
          Currency: 'INR',
          CostCenter: claim.costCenter,
          Status: 'R', // Sending Rejected status
          ApprovalRequired: 'R', // Action: Reject
          RejReason: remarks    // Rejection reason text
      };

      const response = await fetch(`${API_BASE_URL}/api/approve-claim/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ putData })
      });

      if (!response.ok) {
        let errMsg = 'SAP Backend rejected the rejection';
        try {
          const errData = await response.json();
          if (errData.error) errMsg = errData.error;
        } catch (e) {}
        throw new Error(errMsg);
      }

      setClaims(prev => prev.map(c => {
        if (c.id === id) {
          return {
            ...c,
            status: 'Rejected',
            rawStatus: 'R',
            currentApprover: '',
            workflowHistory: [
              ...c.workflowHistory,
              {
                step: 'Manager Review',
                actor: `${currentUser?.employeeName} (Manager)`,
                timestamp: getCurrentTimestamp(),
                outcome: 'Rejected',
                remarks
              }
            ]
          };
        }
        return c;
      }));

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // Clarification request placeholder
  const requestClarification = (id: string, remarks: string) => {
    setClaims(prev => prev.map(c => {
      if (c.id === id) {
        return {
          ...c,
          workflowHistory: [
            ...c.workflowHistory,
            {
              step: 'Clarification Requested',
              actor: `${currentUser.employeeName} (${currentUser.role})`,
              timestamp: getCurrentTimestamp(),
              outcome: 'Clarification Requested',
              remarks: remarks || 'Please provide additional details regarding this claim.'
            }
          ]
        };
      }
      return c;
    }));
  };

  // BR-012, BR-014: Finance Validate Claim
  const validateClaimFinance = (id: string) => {
    setClaims(prev => prev.map(c => {
      if (c.id === id) {
        return {
          ...c,
          status: 'Pending Release',
          workflowHistory: [
            ...c.workflowHistory,
            {
              step: 'Finance Review',
              actor: `${currentUser.employeeName} (Finance)`,
              timestamp: getCurrentTimestamp(),
              outcome: 'Validated',
              remarks: 'Simulated SAP validation successful. Financial checks passed and posting readiness verified.'
            }
          ]
        };
      }
      return c;
    }));
  };

  // BR-013, BR-014: Finance Release Payment
  const releasePayment = async (id: string) => {
    const claim = claims.find(c => c.id === id);
    if (!claim) {
      return { success: false, error: 'Claim not found' };
    }

    const empIdNumeric = (claim.employeeId || '').toString().replace(/\D/g, '').padStart(8, '0');
    const loginIdNumeric = currentUser?.employeeId?.replace(/\D/g, '').padStart(8, '0') || '';

    const putData = {
      ClaimId: claim.id || id,
      EmpId: empIdNumeric,
      LoginId: loginIdNumeric,
      EmpName: claim.employeeName || currentUser?.employeeName || 'Unknown',
      Department: claim.department || currentUser?.department || 'Finance',
      Designation: claim.designation || currentUser?.designation || 'Finance',
      TotalAmount: (claim.amount ?? 0).toFixed(3),
      Currency: 'INR',
      CostCenter: claim.costCenter || '',
      Status: 'P',
      ApprovalRequired: 'A'
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/approve-claim/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ putData })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        const errMsg = errData?.error || 'SAP rejected the payment release';
        return { success: false, error: errMsg };
      }

      setClaims(prev => prev.map(c => {
        if (c.id === id) {
          return {
            ...c,
            status: 'Paid',
            rawStatus: 'P',
            currentApprover: '',
            workflowHistory: [
              ...c.workflowHistory,
              {
                step: 'Payment Processing',
                actor: `${currentUser?.employeeName} (Finance)`,
                timestamp: getCurrentTimestamp(),
                outcome: 'Paid',
                remarks: 'Payment released successfully. Accounting document posted.'
              }
            ]
          };
        }
        return c;
      }));

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error while releasing payment' };
    }
  };

  const rejectClaimFinance = async (id: string, remarks: string) => {
    if (!remarks || remarks.trim() === '') {
      return { success: false, error: 'Please provide rejection remarks.' };
    }

    try {
      // Ensure we use the claim's owner identity (EmpId/EmpName) and the approver's LoginId
      const claim = claims.find(c => c.id === id);
      if (!claim) return { success: false, error: 'Claim not found' };

      const empIdNumeric = (claim.employeeId || '').toString().replace(/\D/g, '').padStart(8, '0');
      const loginIdNumeric = currentUser?.employeeId?.replace(/\D/g, '').padStart(8, '0') || '';

      const putData = {
        ClaimId: claim.id || id,
        EmpId: empIdNumeric,
        LoginId: loginIdNumeric,
        EmpName: claim.employeeName || currentUser?.employeeName || 'Unknown',
        Department: claim.department || currentUser?.department || 'Finance',
        Designation: claim.designation || currentUser?.designation || 'Finance',
        TotalAmount: (claim.amount ?? 0).toFixed(3),
        Currency: 'INR',
        CostCenter: claim.costCenter || '',
        Status: 'R',
        ApprovalRequired: 'R',
        RejReason: remarks
      };

      const response = await fetch(`${API_BASE_URL}/api/approve-claim/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ putData })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        const errMsg = errData?.error || 'SAP rejected the finance rejection';
        return { success: false, error: errMsg };
      }

      setClaims(prev => prev.map(c => {
        if (c.id === id) {
          return {
            ...c,
            status: 'Rejected',
            rawStatus: 'R',
            currentApprover: '',
            workflowHistory: [
              ...c.workflowHistory,
              {
                step: 'Finance Rejection',
                actor: `${currentUser?.employeeName} (Finance)`,
                timestamp: getCurrentTimestamp(),
                outcome: 'Rejected',
                remarks
              }
            ]
          };
        }
        return c;
      }));

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error while rejecting claim' };
    }
  };

  // BR-018, BR-019: Retry SAP Posting
  const retrySAPPosting = (errorId: string) => {
    setErrors(prev => prev.map(err => {
      if (err.id === errorId) {
        return {
          ...err,
          status: 'Resolved',
          resolutionHistory: [
            ...err.resolutionHistory,
            {
              timestamp: getCurrentTimestamp(),
              resolvedBy: `${currentUser.employeeName} (${currentUser.role})`,
              notes: 'Successfully re-triggered SAP posting queue. Integration error resolved.'
            }
          ]
        };
      }
      return err;
    }));
  };

  const getClaimById = (id: string) => {
    return claims.find(c => c.id === id);
  };

  // BR-007, BR-008: Filtering & Searching
  const filterClaims = (roleFilter?: 'employee' | 'manager' | 'finance', search?: string, expenseType?: string, status?: string) => {
    return claims.filter(c => {
      // Role filtering logic (Segregation by EmpId and LoginId)
      if (roleFilter === 'employee') {
        // My Claims tab: Only show claims where EmpId matches the logged-in user's LoginId
        if (currentUser && c.employeeId !== currentUser.employeeId) {
          return false;
        }
      } else if (roleFilter === 'manager') {
        const userNumeric = currentUser?.employeeId?.replace(/\D/g, '').padStart(8, '0') || '';
        const approverNumeric = (c.currentApprover || '').toString().replace(/\D/g, '').padStart(8, '0');

        if (currentUser) {
          if (approverNumeric !== userNumeric) {
            return false;
          }
        }

        // Manager should only see claims assigned to them with SAP status N or A
        if (c.rawStatus !== 'N' && c.rawStatus !== 'A') return false;
      } else if (roleFilter === 'finance') {
        const userNumericF = currentUser?.employeeId?.replace(/\D/g, '').padStart(8, '0') || '';
        const employeeNumeric = c.employeeId?.replace(/\D/g, '').padStart(8, '0') || '';

        if (currentUser) {
          // Finance should see claims that are not their own employee claims.
          if (employeeNumeric === userNumericF) return false;
        }

        const financeStatuses = currentUser?.role === 'B' ? ['H', 'P'] : ['H'];
        if (!financeStatuses.includes(c.rawStatus || '')) return false;
      }

      // Search by employee name or claim ID or cost center
      if (search && search.trim() !== '') {
        const q = search.toLowerCase();
        const match = c.employeeName.toLowerCase().includes(q) || 
                      c.id.toLowerCase().includes(q) ||
                      c.costCenter.toLowerCase().includes(q) ||
                      c.expenseType.toLowerCase().includes(q);
        if (!match) return false;
      }

      // Filter by expense type
      if (expenseType && expenseType !== 'All') {
        if (c.expenseType !== expenseType) return false;
      }

      // Filter by status
      if (status && status !== 'All') {
        if (c.status !== status) return false;
      }

      return true;
    });
  };

  // Automatically load expense types and re-fetch claims whenever the logged-in user changes
  useEffect(() => {
    // Clear any previous user's claims and history immediately to prevent cache leakage/flickering
    setClaims([]);
    setHistoryEntries([]);

    if (!currentUser?.employeeId) {
      return;
    }

    const loadUserData = async () => {
      await fetchExpenseTypes();
      await fetchClaims();
    };

    loadUserData();
  }, [currentUser]);

  return (
    <ClaimContext.Provider value={{
      claims,
      errors,
      historyEntries,
      kpis,
      autoApprovalThreshold,
      policyLimit,
      addClaim,
      updateDraft,
      deleteClaim,
      approveClaim,
      rejectClaim,
      requestClarification,
      validateClaimFinance,
      releasePayment,
      rejectClaimFinance,
      retrySAPPosting,
      getClaimById,
      filterClaims,
      fetchClaims,
      fetchHistorySet,
      expenseTypes,
      fetchExpenseTypes,
      // RESUBMIT_FEATURE: Add temp claim for resubmit
      tempClaimForResubmit,
      setTempClaimForResubmit: handleSetTempClaimForResubmit,
    }}>
      {children}
    </ClaimContext.Provider>
  );
};

export const useClaim = () => {
  const context = useContext(ClaimContext);
  if (!context) {
    throw new Error('useClaim must be used within a ClaimProvider');
  }
  return context;
};
