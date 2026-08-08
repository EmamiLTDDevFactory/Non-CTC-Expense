import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../../src/context/AuthContext';
import { useClaim } from '../../../src/context/ClaimContext';
import { ExpenseClaim } from '../../../src/types';

export default function FinanceScreen() {
  const router = useRouter();
  const { filterClaims, validateClaimFinance, releasePayment, rejectClaimFinance, claims, fetchClaims, fetchHistorySet, historyEntries } = useClaim();
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [screenMessage, setScreenMessage] = useState<{ title: string; message: string; type: 'success' | 'error' } | null>(null);
  const [selectedClaimIds, setSelectedClaimIds] = useState<string[]>([]);

  const normalizeId = (id?: string) => (id || '').toString().replace(/\D/g, '').padStart(8, '0');
  const financeNumeric = normalizeId(currentUser?.employeeId);
  const financeName = (currentUser?.employeeName || '').toLowerCase();
  const financeHistoryEntries = historyEntries || [];

  const financeRelevantClaims = currentUser ? claims.filter(c => {
    const assignedToFinance = normalizeId(c.currentApprover) === financeNumeric && c.rawStatus === 'H';
    const actedByFinance = (c.workflowHistory || []).some(event =>
      !!financeName &&
      event.actor.toLowerCase().includes(financeName) &&
      (event.step.toLowerCase().includes('finance') || event.step === 'Payment Processing')
    );

    return assignedToFinance || actedByFinance;
  }) : [];
  const financeStatusesForCount = currentUser?.role === 'B' ? ['H', 'P'] : ['H'];
  const financeApprovedCount = financeHistoryEntries.filter(entry => (entry.Action || '').toString().toUpperCase() === 'APPROVE').length;
  const financePendingCount = claims.filter(c =>
    financeStatusesForCount.includes(c.rawStatus || '') && normalizeId(c.employeeId) !== financeNumeric
  ).length;
  const financeRejectedCount = financeHistoryEntries.filter(entry => (entry.Action || '').toString().toUpperCase() === 'REJECT').length;
  const financeTotalCount = financeHistoryEntries.length;

  const financeStats = [
    { label: 'Approved', value: financeApprovedCount, icon: 'checkmark-circle-outline', accent: '#059669', iconColor: '#166534' },
    { label: 'Pending', value: financePendingCount, icon: 'shield-checkmark-outline', accent: '#D97706', iconColor: '#92400E' },
    { label: 'Rejected', value: financeRejectedCount, icon: 'close-circle-outline', accent: '#DC2626', iconColor: '#991B1B' },
    { label: 'Total', value: financeTotalCount, icon: 'briefcase-outline', accent: '#005A9E', iconColor: '#1D4ED8' },
  ];

  // Finance view gets Approved and Pending Release claims
  const financeClaims = filterClaims('finance', searchQuery);
  const isBulkReleaseUser = currentUser?.role === 'B';
  const isBPendingRelease = (claim: ExpenseClaim) => isBulkReleaseUser && claim.rawStatus === 'P';
  const bulkReleaseClaims = financeClaims.filter(claim => claim.status === 'Pending Release' || isBPendingRelease(claim));
  const allBulkSelected = bulkReleaseClaims.length > 0 && bulkReleaseClaims.every(claim => selectedClaimIds.includes(claim.id));
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectClaimId, setRejectClaimId] = useState('');
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [releaseConfirmVisible, setReleaseConfirmVisible] = useState(false);
  const [releaseConfirmClaimId, setReleaseConfirmClaimId] = useState('');
  const [bulkReleaseConfirmVisible, setBulkReleaseConfirmVisible] = useState(false);

  // Stat card selection — drives history list view
  const [selectedStat, setSelectedStat] = useState<string | null>(null);

  const formatHistoryDate = (value?: string) => {
    if (!value) return '';
    let d = new Date(value);
    const m = value.match(/(\d+)/);
    if (m && value.includes('/Date(')) d = new Date(parseInt(m[1], 10));
    if (Number.isNaN(d.getTime())) return value;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  // History items filtered by selected stat card
  const filteredHistoryItems =
    selectedStat === 'Approved'
      ? financeHistoryEntries.filter(e => (e.Action || '').toUpperCase() === 'APPROVE')
      : selectedStat === 'Rejected'
      ? financeHistoryEntries.filter(e => (e.Action || '').toUpperCase() === 'REJECT')
      : selectedStat === 'Total'
      ? [...financeHistoryEntries]
      : [];
  // When Approved/Rejected/Total selected → show history. Pending → show finance claims.
  const showHistoryList = selectedStat !== null && selectedStat !== 'Pending';

  const formatSapErrorMessage = (message?: string) => {
    const rawMessage = (message || '').toString().trim();
    if (!rawMessage) {
      return 'The finance action could not be completed. Please try again.';
    }

    if (/error in document/i.test(rawMessage)) {
      const documentError = rawMessage.split(':').slice(1).join(':').trim();
      return documentError
        ? `SAP document posting failed. ${documentError}`
        : 'SAP document posting failed. Please review the claim and try again.';
    }

    if (/sap rejected/i.test(rawMessage)) {
      return 'SAP rejected the request. Please check the claim data and try again.';
    }

    return rawMessage;
  };

  useFocusEffect(
    useCallback(() => {
      fetchHistorySet();
    }, [fetchHistorySet, currentUser?.employeeId])
  );

  const refreshHistoryStats = async () => {
    await fetchHistorySet();
  };

  useEffect(() => {
    setSelectedClaimIds(prev => prev.filter(id => bulkReleaseClaims.some(claim => claim.id === id)));
  }, [bulkReleaseClaims.map(claim => claim.id).join('|')]);

  const showScreenMessage = (message: string, type: 'success' | 'error' = 'success', title?: string) => {
    setScreenMessage({
      title: title || (type === 'error' ? 'Action Failed' : 'Success'),
      message,
      type,
    });
    setTimeout(() => setScreenMessage(null), 5000);
  };

  const handleValidate = (id: string) => {
    Alert.alert(
      'Simulate SAP Financial Validation',
      `Run simulated SAP compliance checks and verify posting readiness for claim ${id}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Validate Claim', 
          onPress: () => {
            validateClaimFinance(id);
            showScreenMessage(`Claim ${id} passed financial checks. Status changed to Pending Release.`, 'success');
          } 
        }
      ]
    );
  };

  const handleRelease = (id: string) => {
    setReleaseConfirmClaimId(id);
    setReleaseConfirmVisible(true);
  };

  const closeReleaseConfirm = () => {
    setReleaseConfirmVisible(false);
    setReleaseConfirmClaimId('');
  };

  const confirmReleasePayment = async () => {
    const id = releaseConfirmClaimId;
    if (!id) return;

    closeReleaseConfirm();
    const result = await releasePayment(id);
    if (!result.success) {
      showScreenMessage(
        formatSapErrorMessage(result.error),
        'error',
        'Payment Release Failed'
      );
      return;
    }

    await refreshHistoryStats();
    await fetchClaims();
    showScreenMessage(`Claim ${id} has been paid successfully and workflow updated.`, 'success', 'Payment Released');
  };

  const handleReject = (id: string) => {
    setRejectClaimId(id);
    setRejectRemarks('');
    setRejectModalVisible(true);
  };

  const confirmReject = async () => {
    const result = await rejectClaimFinance(rejectClaimId, rejectRemarks);
    if (!result.success) {
      setRejectModalVisible(false);
      showScreenMessage(
        formatSapErrorMessage(result.error),
        'error',
        'Rejection Failed'
      );
      return;
    }

    await refreshHistoryStats();
    await fetchClaims();
    setRejectModalVisible(false);
    showScreenMessage(`Claim ${rejectClaimId} has been rejected successfully and the reason has been saved.`, 'success', 'Claim Rejected');
  };

  const toggleClaimSelection = (id: string) => {
    setSelectedClaimIds(prev => (
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    ));
  };

  const toggleSelectAllBulkClaims = () => {
    setSelectedClaimIds(prev => (
      allBulkSelected ? [] : bulkReleaseClaims.map(claim => claim.id)
    ));
  };

  const confirmBulkRelease = async () => {
    if (selectedClaimIds.length === 0) {
      showScreenMessage('Please select at least one claim to release.', 'error', 'No Claims Selected');
      return;
    }

    setBulkReleaseConfirmVisible(false);

    let successCount = 0;
    let failureCount = 0;
    const failedIds: string[] = [];

    for (const claimId of selectedClaimIds) {
      const result = await releasePayment(claimId);
      if (result.success) {
        successCount += 1;
      } else {
        failureCount += 1;
        failedIds.push(claimId);
      }
    }

    setSelectedClaimIds(failedIds);
    await refreshHistoryStats();
    await fetchClaims();

    if (failureCount > 0) {
      showScreenMessage(
        `${successCount} claim(s) released. ${failureCount} claim(s) could not be released.`,
        'error',
        'Bulk Release Partial'
      );
      return;
    }

    showScreenMessage(
      `${successCount} claim(s) have been released successfully.`,
      'success',
      'Bulk Release Complete'
    );
  };

  const handleBulkRelease = () => {
    if (selectedClaimIds.length === 0) {
      showScreenMessage('Please select at least one claim to release.', 'error', 'No Claims Selected');
      return;
    }
    setBulkReleaseConfirmVisible(true);
  };

  const closeBulkReleaseConfirm = () => {
    setBulkReleaseConfirmVisible(false);
  };

  const getStatusBadge = (status: ExpenseClaim['status']) => {
    switch (status) {
      case 'Approved':
        return { bg: '#D1FAE5', text: '#065F46' };
      case 'Pending Release':
        return { bg: '#FEF3C7', text: '#92400E' };
      case 'Paid':
        return { bg: '#D1FAE0', text: '#047857' };
      default:
        return { bg: '#F1F5F9', text: '#475569' };
    }
  };

  const getDisplayStatus = (claim: ExpenseClaim) => (isBPendingRelease(claim) ? 'Pending Release' : claim.status);
  const getDisplayBadge = (claim: ExpenseClaim) => getStatusBadge(getDisplayStatus(claim));

  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <Text style={styles.pageTitle}>Finance Processing</Text>
        {/* <Text style={styles.pageSubtitle}>Validate approved claims and release payments (SAP FI Simulation)</Text> */}
        <View style={styles.statsRow}>
          {financeStats.map(stat => (
            <TouchableOpacity
              key={stat.label}
              activeOpacity={0.6}
              style={[
                styles.statCard,
                { borderBottomColor: stat.accent },
                selectedStat === stat.label ? {
                  backgroundColor: stat.label === 'Approved' ? '#ECFDF5' : stat.label === 'Pending' ? '#FFFBEB' : stat.label === 'Rejected' ? '#FEF2F2' : '#EFF6FF',
                  borderColor: stat.accent,
                  borderWidth: 2,
                  borderBottomWidth: 3,
                  shadowOpacity: 0.16,
                  shadowRadius: 10,
                  elevation: 6,
                } : {
                  shadowOpacity: 0.05,
                  shadowRadius: 3,
                  elevation: 2,
                }
              ]}
              onPress={() => setSelectedStat(selectedStat === stat.label ? null : stat.label)}
            >
              <View style={styles.statIconRow}>
                <Ionicons name={stat.icon as keyof typeof Ionicons.glyphMap} size={18} color={stat.iconColor} />
              </View>
              <Text style={styles.statLabel}>{stat.label}</Text>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Ionicons
                name={selectedStat === stat.label ? "chevron-up" : "chevron-down"}
                size={14}
                color={selectedStat === stat.label ? stat.accent : '#475569'}
                style={{ marginTop: 2 }}
              />
            </TouchableOpacity>
          ))}
        </View>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#64748B" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by Claim ID, Employee, Cost Center..."
            placeholderTextColor="#94A3B8"
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {isBulkReleaseUser && bulkReleaseClaims.length > 0 ? (
          <View style={styles.bulkActionBar}>
            <TouchableOpacity style={styles.bulkSelectBtn} onPress={toggleSelectAllBulkClaims}>
              <Ionicons
                name={(allBulkSelected ? 'checkbox-outline' : 'square-outline') as keyof typeof Ionicons.glyphMap}
                size={18}
                color="#005A9E"
              />
              <Text style={styles.bulkSelectBtnText}>
                {allBulkSelected ? 'Clear Selection' : `Select All (${bulkReleaseClaims.length})`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bulkReleaseBtn} onPress={handleBulkRelease}>
              <Ionicons name="cash-outline" size={18} color="#FFFFFF" />
              <Text style={styles.bulkReleaseBtnText}>Release Selected</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {/* Claims / History List */}
      <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>

        {/* Header row shown when a stat card is active */}
        {selectedStat && (
          <View style={styles.selectedStatHeader}>
            <Text style={styles.selectedStatTitle}>
              {selectedStat === 'Pending' ? 'Pending Claims' : `${selectedStat} Claims`}
            </Text>
            <TouchableOpacity onPress={() => setSelectedStat(null)} style={styles.clearStatBtn}>
              <Ionicons name="close-circle" size={16} color="#64748B" />
              <Text style={styles.clearStatText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        {showHistoryList ? (
          /* History view for Approved / Rejected / Total */
          filteredHistoryItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-outline" size={54} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No Records</Text>
              <Text style={styles.emptySub}>No {selectedStat?.toLowerCase()} claims found in your history.</Text>
            </View>
          ) : (
            filteredHistoryItems.map((entry: any, idx: number) => {
              const isApprove = (entry.Action || '').toUpperCase() === 'APPROVE';
              return (
                <TouchableOpacity
                  key={`${entry.ClaimId}-${idx}`}
                  style={[
                    styles.historyClaimCard,
                    {
                      borderLeftWidth: 5,
                      borderLeftColor: isApprove ? '#059669' : '#DC2626',
                      backgroundColor: isApprove ? '#D1FAE5' : '#FEE2E2',
                    }
                  ]}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/zexpense/claim/${entry.ClaimId}`)}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'stretch' }}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={styles.historyClaimId}>{entry.ClaimId}</Text>
                      <Text style={styles.historyClaimDate}>{formatHistoryDate(entry.ActionDate)}</Text>
                      {entry.ActionByName ? (
                        <Text style={styles.historyClaimActor}>By: {entry.ActionByName}</Text>
                      ) : null}
                      {entry.Remarks ? (
                        <Text style={styles.historyClaimRemarks} numberOfLines={2}>
                          Remarks: {entry.Remarks}
                        </Text>
                      ) : null}
                    </View>

                    <View style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <View style={[
                        styles.historyActionBadge,
                        { backgroundColor: isApprove ? '#D1FAE5' : '#FEE2E2' },
                      ]}>
                        <Text style={[
                          styles.historyActionText,
                          { color: isApprove ? '#065F46' : '#B91C1C' },
                        ]}>
                          {isApprove ? 'Released' : 'Rejected'}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                        <Text style={styles.historyClaimViewText}>View Full Details</Text>
                        <Ionicons name="chevron-forward" size={16} color="#005A9E" />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )
        ) : (
          /* Default: existing finance claims list */
          financeClaims.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="card-outline" size={54} color="#10B981" />
            <Text style={styles.emptyTitle}>All Payments Processed</Text>
            <Text style={styles.emptySub}>There are no approved or pending release claims requiring finance action right now.</Text>
          </View>
        ) : (
          financeClaims.map(claim => {
            const badge = getStatusBadge(claim.status);
            return (
              <View key={claim.id} style={styles.claimCard}>
                {isBulkReleaseUser && (claim.status === 'Pending Release' || isBPendingRelease(claim)) ? (
                  <TouchableOpacity
                    style={styles.bulkSelectCol}
                    onPress={() => toggleClaimSelection(claim.id)}
                  >
                    <Ionicons
                      name={(selectedClaimIds.includes(claim.id) ? 'checkbox-outline' : 'square-outline') as keyof typeof Ionicons.glyphMap}
                      size={22}
                      color="#005A9E"
                    />
                  </TouchableOpacity>
                ) : null}

                <View style={styles.cardRightContent}>
                  <TouchableOpacity 
                    style={styles.cardMainContent}
                    onPress={() => router.push(`/zexpense/claim/${claim.id}`)}
                  >
                    <View style={styles.cardHeader}>
                      <View>
                        <Text style={styles.claimId}>{claim.id}</Text>
                        <Text style={styles.employeeName}>{claim.employeeName} ({claim.department})</Text>
                      </View>
                      <View style={styles.amountBadgeCol}>
                        <Text style={styles.amount}>₹{claim.amount.toFixed(2)}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                          <Text style={[styles.statusText, { color: badge.text }]}>{getDisplayStatus(claim)}</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.justificationBox}>
                      <Text style={styles.expenseType}>{claim.expenseType}</Text>
                      <Text style={styles.justification} numberOfLines={2}>{claim.justification}</Text>
                    </View>

                    <View style={styles.cardMetaRow}>
                      <Text style={styles.metaText}>Cost Center: {claim.costCenter}</Text>
                      <Text style={styles.metaText}>Date: {claim.claimDate}</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Action Buttons based on Flow */}
                  <View style={styles.actionsFooter}>
                    {claim.status === 'Approved' ? (
                      <TouchableOpacity style={styles.actionBtnValidate} onPress={() => handleValidate(claim.id)}>
                        <Ionicons name="shield-checkmark-outline" size={18} color="#005A9E" />
                        <Text style={styles.actionBtnValidateText}>Validate Claim (SAP Check)</Text>
                      </TouchableOpacity>
                    ) : isBPendingRelease(claim) ? (
                      <View style={styles.financeActionsRow}>
                        <TouchableOpacity style={styles.actionBtnRelease} onPress={() => handleRelease(claim.id)}>
                          <Ionicons name="cash-outline" size={18} color="#FFFFFF" />
                          <Text style={styles.actionBtnReleaseText}>Release Payment (SAP Pay)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtnReject} onPress={() => handleReject(claim.id)}>
                          <Ionicons name="close-circle-outline" size={18} color="#FFFFFF" />
                          <Text style={styles.actionBtnRejectText}>Reject Claim</Text>
                        </TouchableOpacity>
                      </View>
                    ) : claim.status === 'Paid' ? (
                      <View style={styles.paidNotice}>
                        <Ionicons name="checkmark-circle-outline" size={18} color="#047857" />
                        <Text style={styles.paidNoticeText}>Payment already released</Text>
                      </View>
                    ) : (
                      <View style={styles.financeActionsRow}>
                        <TouchableOpacity style={styles.actionBtnRelease} onPress={() => handleRelease(claim.id)}>
                          <Ionicons name="cash-outline" size={18} color="#FFFFFF" />
                          <Text style={styles.actionBtnReleaseText}>Release Payment (SAP Pay)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtnReject} onPress={() => handleReject(claim.id)}>
                          <Ionicons name="close-circle-outline" size={18} color="#FFFFFF" />
                          <Text style={styles.actionBtnRejectText}>Reject Claim</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })
        )
        )}
      </ScrollView>

      <Modal visible={!!screenMessage} transparent animationType="fade" onRequestClose={() => setScreenMessage(null)}>
        <Pressable style={styles.messageOverlay} onPress={() => setScreenMessage(null)}>
          <Pressable style={[styles.messageBox, screenMessage?.type === 'error' ? styles.messageBoxError : styles.messageBoxSuccess]} onPress={() => {}}>
            <View style={styles.messageHeader}>
              <View style={[styles.messageIconWrap, screenMessage?.type === 'error' ? styles.messageIconWrapError : styles.messageIconWrapSuccess]}>
                <Ionicons
                  name={screenMessage?.type === 'error' ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                  size={22}
                  color={screenMessage?.type === 'error' ? '#B91C1C' : '#047857'}
                />
              </View>
              <View style={styles.messageHeaderCopy}>
                <Text style={styles.messageTitle}>{screenMessage?.title}</Text>
                <Text style={styles.messageText}>{screenMessage?.message}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.messageCloseBtn} onPress={() => setScreenMessage(null)}>
              <Text style={styles.messageCloseText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={bulkReleaseConfirmVisible} transparent animationType="fade" onRequestClose={closeBulkReleaseConfirm}>
        <Pressable style={styles.confirmOverlay} onPress={closeBulkReleaseConfirm}>
          <Pressable style={styles.confirmBox} onPress={() => {}}>
            <View style={styles.confirmIconWrap}>
              <Ionicons name="cash-outline" size={22} color="#059669" />
            </View>
            <Text style={styles.confirmTitle}>Release Selected Claims?</Text>
            <Text style={styles.confirmText}>
              Release payment for {selectedClaimIds.length} selected claim(s) now?
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={closeBulkReleaseConfirm}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmOkBtn} onPress={confirmBulkRelease}>
                <Text style={styles.confirmOkText}>Release Selected</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={releaseConfirmVisible} transparent animationType="fade" onRequestClose={closeReleaseConfirm}>
        <Pressable style={styles.confirmOverlay} onPress={closeReleaseConfirm}>
          <Pressable style={styles.confirmBox} onPress={() => {}}>
            <View style={styles.confirmIconWrap}>
              <Ionicons name="cash-outline" size={22} color="#059669" />
            </View>
            <Text style={styles.confirmTitle}>Release Payment?</Text>
            <Text style={styles.confirmText}>
              Authorize payment release and post the payment document in SAP FI for claim {releaseConfirmClaimId}?
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={closeReleaseConfirm}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmOkBtn} onPress={confirmReleasePayment}>
                <Text style={styles.confirmOkText}>Release Payment</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={rejectModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setRejectModalVisible(false)}>
          <Pressable style={styles.modalBox} onPress={() => {}}>
            <Text style={styles.modalTitle}>Reject Claim</Text>
            <Text style={styles.modalText}>Please provide the reason for rejecting claim {rejectClaimId}.</Text>
            <TextInput
              style={styles.modalInput}
              value={rejectRemarks}
              onChangeText={setRejectRemarks}
              placeholder="Enter rejection reason"
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setRejectModalVisible(false)}>
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmModalBtn} onPress={confirmReject}>
                <Text style={styles.confirmModalBtnText}>Reject Claim</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
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
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    minWidth: 100,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderBottomWidth: 3,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
  },
  statIconRow: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    backgroundColor: '#F1F5F9',
  },
  statLabel: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '700',
    marginBottom: 3,
  },
  statValue: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
  bulkActionBar: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  bulkSelectBtn: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  bulkSelectBtnText: {
    marginLeft: 6,
    color: '#005A9E',
    fontWeight: '700',
    fontSize: 13,
  },
  bulkReleaseBtn: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  bulkReleaseBtnText: {
    marginLeft: 6,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 70,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 14,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  claimCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  bulkSelectCol: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  cardRightContent: {
    flex: 1,
  },
  cardMainContent: {
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  claimId: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  employeeName: {
    fontSize: 13,
    color: '#005A9E',
    fontWeight: '600',
  },
  amountBadgeCol: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  justificationBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  expenseType: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 2,
  },
  justification: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 16,
  },
  cardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  actionsFooter: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    padding: 8,
  },
  actionBtnValidate: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#005A9E',
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionBtnValidateText: {
    color: '#005A9E',
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 6,
  },
  actionBtnRelease: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 10,
    borderRadius: 10,
    flex: 1,
    marginRight: 8,
  },
  actionBtnReject: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    borderRadius: 10,
    flex: 1,
  },
  actionBtnReleaseText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 6,
  },
  actionBtnRejectText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 6,
  },
  paidNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    paddingVertical: 10,
  },
  paidNoticeText: {
    marginLeft: 6,
    color: '#047857',
    fontWeight: '700',
    fontSize: 13,
  },
  financeActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  messageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  messageBox: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 12,
  },
  messageBoxSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  messageBoxError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  messageIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  messageIconWrapSuccess: {
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  messageIconWrapError: {
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  messageHeaderCopy: {
    flex: 1,
  },
  messageTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  messageText: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
  },
  messageCloseBtn: {
    marginTop: 18,
    alignSelf: 'flex-end',
    backgroundColor: '#005A9E',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  messageCloseText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmBox: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 12,
  },
  confirmIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: 12,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  confirmText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  confirmCancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmCancelText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 14,
  },
  confirmOkBtn: {
    flex: 1,
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmOkText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    padding: 22,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  modalText: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 16,
    lineHeight: 20,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
    color: '#0F172A',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelModalBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelModalBtnText: {
    color: '#475569',
    fontWeight: '700',
  },
  confirmModalBtn: {
    flex: 1,
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmModalBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  // Stat selection header
  selectedStatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectedStatTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  clearStatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clearStatText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  // History claim cards
  historyClaimCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  historyClaimHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  historyClaimId: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  historyClaimDate: {
    fontSize: 12,
    color: '#334155',
    marginBottom: 2,
    fontWeight: '600',
  },
  historyClaimActor: {
    fontSize: 12,
    color: '#1E293B',
    fontWeight: '700',
  },
  historyActionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  historyActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  historyClaimRemarks: {
    fontSize: 13,
    color: '#1E293B',
    marginTop: 10,
    lineHeight: 18,
    fontWeight: '600',
  },
  historyClaimFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 4,
  },
  historyClaimViewText: {
    fontSize: 13,
    color: '#005A9E',
    fontWeight: '600',
  },
});
