import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useClaim } from '../../../src/context/ClaimContext';
import { ExpenseClaim } from '../../../src/types';
import { formatClaimDisplayDate, getClaimCreatedTimestamp } from '../../../src/utils/claim-date';

const STATUSES = ['All', 'Draft', 'Submitted', 'Approved', 'Pending Release', 'Paid', 'Rejected'];

const getStatusParamValue = (statusParam: string | string[] | undefined) => {
  const status = Array.isArray(statusParam) ? statusParam[0] : statusParam;
  return status && STATUSES.includes(status) ? status : 'All';
};

const escapeExcelCell = (value: unknown) => {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

const formatAttachmentNames = (claim: ExpenseClaim) => {
  return claim.attachments?.map(attachment => attachment.name).filter(Boolean).join(', ') || '';
};

const getLastWorkflowAction = (claim: ExpenseClaim) => {
  const lastEvent = claim.workflowHistory?.[claim.workflowHistory.length - 1];
  if (!lastEvent) return '';
  return [lastEvent.step, lastEvent.outcome, lastEvent.timestamp].filter(Boolean).join(' - ');
};

const buildClaimsExcelHtml = (claims: ExpenseClaim[]) => {
  const headers = [
    'Claim ID',
    'Employee ID',
    'Employee Name',
    'Department',
    'Designation',
    'Claim Date',
    'Expense Date',
    'Expense Type',
    'Amount',
    'Currency',
    'Cost Center',
    'Business Justification',
    'Status',
    'SAP Raw Status',
    'Current Approver',
    'Attachment Count',
    'Attachment Names',
    'Last Workflow Action',
  ];

  const rows = claims.map(claim => [
    claim.id,
    claim.employeeId,
    claim.employeeName,
    claim.department,
    claim.designation,
    claim.claimDate,
    claim.expenseDate || '',
    claim.expenseType,
    claim.amount.toFixed(2),
    'INR',
    claim.costCenter,
    claim.justification,
    claim.status,
    claim.rawStatus || '',
    claim.currentApprover || '',
    claim.attachments?.length || 0,
    formatAttachmentNames(claim),
    getLastWorkflowAction(claim),
  ]);

  const headerHtml = headers.map(header => `<th>${escapeExcelCell(header)}</th>`).join('');
  const rowsHtml = rows
    .map(row => `<tr>${row.map(cell => `<td>${escapeExcelCell(cell)}</td>`).join('')}</tr>`)
    .join('');

  return `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; }
          th { background: #005A9E; color: #FFFFFF; font-weight: 700; }
          th, td { border: 1px solid #CBD5E1; padding: 8px; mso-number-format: "\\@"; }
        </style>
      </head>
      <body>
        <table>
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body>
    </html>
  `;
};

export default function MyClaimsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string; period?: string }>();
  const { filterClaims, expenseTypes, fetchExpenseTypes } = useClaim();
  const expenseTypeOptions = React.useMemo(() => {
    const sapExpenseTypes = expenseTypes
      .map(expenseType => expenseType.name)
      .filter((name, index, names): name is string => !!name && names.indexOf(name) === index);

    return ['All', ...sapExpenseTypes];
  }, [expenseTypes]);

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilterSearch, setTypeFilterSearch] = useState('');
  const [selectedExpenseType, setSelectedExpenseType] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState(() => getStatusParamValue(params.status));
  
  // Modal states for filters on mobile
  const [typeFilterModal, setTypeFilterModal] = useState(false);
  const [statusFilterModal, setStatusFilterModal] = useState(false);

  React.useEffect(() => {
    fetchExpenseTypes();
  }, []);

  React.useEffect(() => {
    if (!expenseTypeOptions.includes(selectedExpenseType)) {
      setSelectedExpenseType('All');
    }
  }, [expenseTypeOptions, selectedExpenseType]);

  React.useEffect(() => {
    setSelectedStatus(getStatusParamValue(params.status));
  }, [params.status]);

  const period = Array.isArray(params.period) ? params.period[0] : params.period || '';

  const filteredExpenseTypeOptions = React.useMemo(
    () =>
      expenseTypeOptions.filter(type =>
        type.toLowerCase().includes(typeFilterSearch.trim().toLowerCase())
      ),
    [expenseTypeOptions, typeFilterSearch]
  );

  const filteredClaims = filterClaims('employee', searchQuery, selectedExpenseType, selectedStatus);

  const displayedClaims = React.useMemo(() => {
    let nextClaims = filteredClaims;

    if (period === 'last3months') {
      try {
        const now = new Date();
        const cutoff = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        nextClaims = filteredClaims.filter(c => {
          if (!c || c.status !== 'Paid') return false;
          const createdTimestamp = getClaimCreatedTimestamp(c);
          if (!createdTimestamp) return false;
          return createdTimestamp >= cutoff.getTime();
        });
      } catch (e) {
        console.warn('Failed to apply last3months filter', e);
        nextClaims = filteredClaims;
      }
    }

    return [...nextClaims].sort((left, right) => getClaimCreatedTimestamp(right) - getClaimCreatedTimestamp(left));
  }, [filteredClaims, period]);

  const getStatusBadge = (status: ExpenseClaim['status']) => {
    switch (status) {
      case 'Approved':
      case 'Paid':
        return { bg: '#D1FAE5', text: '#065F46' };
      case 'Pending Release':
        return { bg: '#FEF3C7', text: '#92400E' };
      case 'Submitted':
        return { bg: '#DBEAFE', text: '#1E40AF' };
      case 'Rejected':
        return { bg: '#FEE2E2', text: '#991B1B' };
      default:
        return { bg: '#F1F5F9', text: '#475569' };
    }
  };

  const accentColors: Record<string, string> = {
    Approved: '#059669',
    Paid: '#047857',
    'Pending Release': '#B45309',
    Submitted: '#1E3A8A',
    Rejected: '#B91C1C',
    default: '#3B82F6',
  };

  const tintColors: Record<string, string> = {
    Approved: '#D1FAE5',
    Paid: '#D1FAE0',
    'Pending Release': '#FEF3C7',
    Submitted: '#DBEAFE',
    Rejected: '#FEE2E2',
    default: '#EEF2FF',
  };

  const handleExportExcel = () => {
    if (displayedClaims.length === 0) {
      Alert.alert('Export Excel', 'There are no claims to export for the current filters.');
      return;
    }

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      Alert.alert('Export Excel', 'Excel export is available in the web app.');
      return;
    }

    const html = buildClaimsExcelHtml(displayedClaims);
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().split('T')[0];

    link.href = url;
    link.download = `my-claims-${dateStamp}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };


  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <Text style={styles.pageTitle}>My Submitted Claims</Text>
        
        {/* Search Bar (BR-007) */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#64748B" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by Claim ID, Cost Center, or Type..."
            placeholderTextColor="#94A3B8"
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter & Action Bar (BR-008) */}
        <View style={styles.filterActionsBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {/* Expense Type Filter */}
            <TouchableOpacity
              style={styles.filterPill}
              onPress={() => {
                setTypeFilterSearch('');
                setTypeFilterModal(true);
              }}
            >
              <Text style={styles.filterPillLabel}>Type: {selectedExpenseType}</Text>
              <Ionicons name="chevron-down" size={14} color="#005A9E" />
            </TouchableOpacity>

            {/* Status Filter */}
            <TouchableOpacity style={styles.filterPill} onPress={() => setStatusFilterModal(true)}>
              <Text style={styles.filterPillLabel}>Status: {selectedStatus}</Text>
              <Ionicons name="chevron-down" size={14} color="#005A9E" />
            </TouchableOpacity>


            {/* Export to Excel Placeholder */}
            <TouchableOpacity style={styles.actionPillExcel} onPress={handleExportExcel}>
              <Ionicons name="download-outline" size={14} color="#059669" />
              <Text style={styles.actionPillExcelLabel}>Export Excel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      {/* Claims List */}
      <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
        {displayedClaims.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Claims Found</Text>
            <Text style={styles.emptySub}>No expense claims match your active search or filter criteria.</Text>
          </View>
        ) : (
          displayedClaims.map(claim => {
            const badge = getStatusBadge(claim.status);
            return (
              <TouchableOpacity
                key={claim.id}
                style={[styles.claimCard, { backgroundColor: tintColors[claim.status] || tintColors.default, borderLeftColor: accentColors[claim.status] || accentColors.default }]}
                onPress={() => router.push(`/zexpense/claim/${claim.id}`)}
              >
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.claimId}>{claim.id}</Text>
                    <Text style={styles.claimType}>{claim.expenseType}</Text>
                  </View>
                  <View style={styles.amountBadgeCol}>
                    <Text style={styles.amount}>₹{claim.amount.toFixed(2)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.statusText, { color: badge.text }]}>{claim.status}</Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.justification} numberOfLines={2}>{claim.justification}</Text>

                <View style={styles.cardFooter}>
                  <Text style={styles.metaText}>Cost Center: {claim.costCenter}</Text>
                  <Text style={styles.metaText}>Submitted: {formatClaimDisplayDate(claim)}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Expense Type Filter Modal */}
      <Modal visible={typeFilterModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalOverlayBackground} onPress={() => setTypeFilterModal(false)} />
          <View style={styles.modalBox}>
            <Text style={styles.modalBoxTitle}>Filter by Expense Type</Text>
            <TextInput
              style={styles.modalSearchInput}
              value={typeFilterSearch}
              onChangeText={setTypeFilterSearch}
              placeholder="Search expense types"
              placeholderTextColor="#94A3B8"
            />
            <ScrollView style={styles.modalOptionList} nestedScrollEnabled>
              {filteredExpenseTypeOptions.length === 0 ? (
                <View style={styles.modalOption}>
                  <Text style={styles.modalOptionText}>No matching expense types</Text>
                </View>
              ) : (
                filteredExpenseTypeOptions.map(item => (
                  <TouchableOpacity
                    key={item}
                    style={styles.modalOption}
                    onPress={() => {
                      setSelectedExpenseType(item);
                      setTypeFilterModal(false);
                    }}
                  >
                    <Text style={styles.modalOptionText}>{item}</Text>
                    {selectedExpenseType === item && <Ionicons name="checkmark" size={20} color="#005A9E" />}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Status Filter Modal */}
      <Modal visible={statusFilterModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setStatusFilterModal(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalBoxTitle}>Filter by Status</Text>
            {STATUSES.map(item => (
              <TouchableOpacity
                key={item}
                style={styles.modalOption}
                onPress={() => {
                  setSelectedStatus(item);
                  setStatusFilterModal(false);
                }}
              >
                <Text style={styles.modalOptionText}>{item}</Text>
                {selectedStatus === item && <Ionicons name="checkmark" size={20} color="#005A9E" />}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topSection: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  clearBtn: {
    padding: 4,
  },
  filterActionsBar: {
    flexDirection: 'row',
  },
  filterScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterPillLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#005A9E',
    marginRight: 4,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  actionPillLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginLeft: 4,
  },
  actionPillExcel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  actionPillExcelLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
    marginLeft: 4,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#475569',
    marginTop: 12,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 260,
  },
  claimCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 6,
    borderLeftColor: '#60A5FA',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  claimId: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  claimType: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  amountBadgeCol: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  justification: {
    fontSize: 13,
    color: '#334155',
    marginBottom: 14,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  metaText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalOverlayBackground: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  modalBox: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  modalBoxTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 16,
  },
  modalSearchInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 12,
  },
  modalOptionList: {
    maxHeight: 320,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalOptionText: {
    fontSize: 15,
    color: '#334155',
  },
});
