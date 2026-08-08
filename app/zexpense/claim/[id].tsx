import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as WT from '../../../src/components/WorkflowTimeline';
import { API_BASE_URL } from '../../../src/config/api';
import { useAuth } from '../../../src/context/AuthContext';
// RESUBMIT_FEATURE: Import useClaim to access setTempClaimForResubmit
import { useClaim } from '../../../src/context/ClaimContext';

export default function ClaimDetailPage() {
  const params = useLocalSearchParams();
  const claimIdValue = params?.id ?? params?.claimId ?? '';
  const claimId = Array.isArray(claimIdValue) ? claimIdValue[0] : String(claimIdValue || '');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionRemarks, setActionRemarks] = useState('');
  const [actionMode, setActionMode] = useState<'manager-reject' | 'finance-reject' | ''>('');
  const router = useRouter();
  const { currentUser } = useAuth();
  // RESUBMIT_FEATURE: Get setTempClaimForResubmit from context
  const { setTempClaimForResubmit, approveClaim, rejectClaim, releasePayment, rejectClaimFinance } = useClaim();

  const loadClaim = async () => {
    if (!claimId) return null;
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/claim-header/${claimId}?expand=CLAIMNAV,HISTORYNAV`);
      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(err || 'Failed to fetch claim');
      }
      const json = await resp.json();
      const nextData = json.d || json || null;
      setData(nextData);
      return nextData;
    } catch (e: any) {
      console.error('Failed to load claim detail', e);
      Alert.alert('Load error', e.message || String(e));
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    if (!claimId) return;
    (async () => {
      const nextData = await loadClaim();
      if (!mounted && nextData) {
        return;
      }
    })();
    return () => { mounted = false; };
  }, [claimId]);

  if (!claimId) return (
    <View style={styles.center}><Text style={styles.err}>No Claim ID supplied.</Text></View>
  );

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color="#005A9E" /></View>
  );

  if (!data) return (
    <View style={styles.center}><Text style={styles.err}>Claim not found.</Text></View>
  );

  const header = data;
  const lines = data.CLAIMNAV?.results || data.CLAIMNAV || [];
  const historyEntries = data.HISTORYNAV?.results || data.HISTORYNAV || [];

  const formatDate = (value: string | undefined) => {
    if (!value) return '';
    let d = new Date(value);
    const timestampMatch = value.match(/(\d+)/);
    if (timestampMatch && value.includes('/Date(')) {
      d = new Date(parseInt(timestampMatch[1], 10));
    }
    if (Number.isNaN(d.getTime())) return value;
    const dd = String(d.getDate()).padStart(2, '0');
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = months[d.getMonth()];
    const yyyy = d.getFullYear();
    return `${dd} ${monthName} ${yyyy}`;
  };

  const formatTime = (value: string | undefined) => {
    if (!value) return '';
    const match = value.match(/PT(\d+)H(\d+)M(\d+)S/);
    if (match) {
      return `${match[1].padStart(2, '0')}:${match[2].padStart(2, '0')}:${match[3].padStart(2, '0')}`;
    }
    return value;
  };

  const getStatusLabel = (status: string | undefined) => {
    switch ((status || '').toUpperCase()) {
      case 'A':
        return 'Approved';
      case 'R':
      case 'REJECT':
      case 'REJECTED':
        return 'Rejected';
      case 'N':
      case 'SUBMIT':
      case 'RESUBMIT':
        return 'Submitted';
      case 'H':
        return 'HOD Approval';
      case 'C':
        return 'Created';
      default:
        return status || 'Unknown';
    }
  };

  const getStatusColor = (status: string | undefined) => {
    switch ((status || '').toUpperCase()) {
      case 'A':
        return '#16A34A';
      case 'R':
      case 'REJECT':
      case 'REJECTED':
        return '#DC2626';
      case 'H':
        return '#F59E0B';
      case 'N':
      case 'SUBMIT':
      case 'RESUBMIT':
        return '#2563EB';
      case 'C':
        return '#0EA5E9';
      default:
        return '#6B7280';
    }
  };

  const getActionLevelLabel = (level: string | undefined) => {
    switch ((level || '').toUpperCase()) {
      case 'L1':
        return 'Manager Approval';
      case 'L2':
        return 'HOD Approval';
      default:
        return 'Employee Action';
    }
  };

  const getEntryDisplayLabel = (entry: any) => {
    const status = (entry?.Status || '').toString().toUpperCase();
    const action = (entry?.Action || '').toString().toUpperCase();

    if (status === 'S') return 'Paid';
    if (status === 'P') return 'Release for Payment';
    if (status === 'H') return 'Pending at finance';

    if (action === 'APPROVE') return 'Approved';
    if (action === 'REJECT') return 'Rejected';
    if (action === 'SUBMIT' || action === 'RESUBMIT') return 'Submitted';
    if (status === 'A') return 'Approved';
    if (status === 'R') return 'Rejected';
    if (status === 'N') return 'Submitted';
    if (status === 'C') return 'Created';
    return entry?.Action || entry?.Status || 'Unknown';
  };

  const getEntryDisplayColor = (entry: any) => {
    const status = (entry?.Status || '').toString().toUpperCase();
    const action = (entry?.Action || '').toString().toUpperCase();

    if (status === 'S') return '#16A34A';
    if (status === 'P') return '#005A9E';
    if (status === 'H') return '#F59E0B';

    if (action === 'APPROVE') return '#16A34A';
    if (action === 'REJECT') return '#DC2626';
    if (action === 'SUBMIT' || action === 'RESUBMIT') return '#2563EB';
    if (status === 'A') return '#16A34A';
    if (status === 'R') return '#DC2626';
    if (status === 'H') return '#F59E0B';
    if (status === 'N') return '#2563EB';
    if (status === 'C') return '#0EA5E9';
    return '#6B7280';
  };

  const getStatusPalette = (status: string) => {
    const normalized = (status || '').toString().trim().toLowerCase();
    switch (normalized) {
      case 'approved':
      case 'paid':
        return { bg: '#D1FAE5', border: '#10B981', text: '#065F46' };
      case 'release for payment':
        return { bg: '#E0F2FE', border: '#0284C7', text: '#0369A1' };
      case 'pending at finance':
        return { bg: '#FEF3C7', border: '#D97706', text: '#B45309' };
      case 'submitted':
        return { bg: '#DBEAFE', border: '#1D4ED8', text: '#1E3A8A' };
      case 'rejected':
        return { bg: '#FEE2E2', border: '#EF4444', text: '#B91C1C' };
      default:
        return { bg: '#FFFFFF', border: '#E2E8F0', text: '#111827' };
    }
  };

  const handleOpenAttachment = async (ln: any) => {
    const mimetype = ln.Mimetype || ln.mimetype || 'application/pdf';
    const filename = ln.Filename || ln.filename || 'attachment.pdf';
    const value = ln.Value || ln.Value;
    if (!value) {
      Alert.alert('Attachment', 'No attachment data available');
      return;
    }
    const dataUri = `data:${mimetype};base64,${value}`;

    if (Platform.OS === 'web') {
      if (typeof document !== 'undefined' && document.createElement) {
        const a = document.createElement('a');
        a.href = dataUri;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }
    }

    // Native fallback: try to open the data URI (may not work on all platforms)
    try {
      await Linking.openURL(dataUri);
    } catch (e) {
      Alert.alert('Attachment', 'Cannot open attachment on this platform. Please use the web app to download.');
    }
  };

  const normalizedHeaderStatus = (header.Status || '').toString().toUpperCase();
  const currentUserId = (currentUser?.employeeId || '').toString().replace(/\D/g, '').padStart(8, '0');
  const claimApproverId = (header.CurrentApprover || header.currentApprover || '').toString().replace(/\D/g, '').padStart(8, '0');
  const isManagerRole = currentUser?.role === 'manager';
  const isFinanceRole = currentUser?.role === 'finance' || currentUser?.role === 'B';
  const isTopLevelPending = currentUser?.role === 'B' && normalizedHeaderStatus === 'P';
  const showManagerActions = isManagerRole && (claimApproverId === currentUserId || normalizedHeaderStatus === 'N' || normalizedHeaderStatus === 'SUBMITTED');
  const showFinanceActions = isFinanceRole && (normalizedHeaderStatus === 'A' || normalizedHeaderStatus === 'APPROVED' || normalizedHeaderStatus === 'H' || normalizedHeaderStatus === 'PENDING RELEASE' || isTopLevelPending);

  const handleManagerApprove = async () => {
    const result = await approveClaim(claimId);
    if (!result.success) {
      Alert.alert('Error', result.error || 'Failed to approve claim.');
      return;
    }
    await loadClaim();
    Alert.alert('Success', `Claim ${claimId} has been approved successfully.`);
  };

  const handleOpenManagerReject = () => {
    setActionMode('manager-reject');
    setActionRemarks('');
    setActionModalVisible(true);
  };

  const handleFinanceRelease = async () => {
    const result = await releasePayment(claimId);
    if (!result.success) {
      Alert.alert('Error', result.error || 'Failed to release payment.');
      return;
    }
    await loadClaim();
    Alert.alert('Success', `Claim ${claimId} has been paid successfully and workflow updated.`);
  };

  const handleOpenFinanceReject = () => {
    setActionMode('finance-reject');
    setActionRemarks('');
    setActionModalVisible(true);
  };

  const handleConfirmReject = async () => {
    const remarks = actionRemarks.trim();
    if (!remarks) {
      Alert.alert('Validation Error', 'Rejection remarks are mandatory.');
      return;
    }

    const result =
      actionMode === 'finance-reject'
        ? await rejectClaimFinance(claimId, remarks)
        : await rejectClaim(claimId, remarks);

    if (!result.success) {
      Alert.alert('Error', result.error || 'Failed to reject claim.');
      return;
    }

    setActionModalVisible(false);
    await loadClaim();
    Alert.alert('Success', `Claim ${claimId} has been rejected successfully.`);
  };

  const TimelineComp = (WT as any)?.WorkflowTimeline || null;
  const normalizedStatus = header.Status === 'R' ? 'Rejected' : header.Status === 'A' ? 'Approved' : header.Status === 'N' ? 'Submitted' : header.Status;
  const claimOwner = currentUser && currentUser.employeeId === header.EmpId;
  const canEdit = claimOwner && (header.Status === 'R' || String(header.Status).toLowerCase() === 'rejected');
  const isRejectedClaim = canEdit;

  // Group line items by type and description to prevent duplicates for multiple attachments (Option 2)
  const groupedLines: any[] = [];
  lines.forEach((ln: any) => {
    const type = ln.ZglName || ln.ExpenseType || ln.ItemType || 'Other';
    const desc = ln.Description || ln.Description1 || '';
    const existing = groupedLines.find(g => g.type === type && g.desc === desc);
    
    const attachment = (ln.Filename || ln.Value) ? {
      Filename: ln.Filename,
      Value: ln.Value,
      Mimetype: ln.Mimetype,
      ClaimId: ln.ClaimId,
      ItemNo: ln.ItemNo
    } : null;

    if (existing) {
      if (attachment) {
        existing.attachments.push(attachment);
      }
      existing.amount += parseFloat(ln.Amount || ln.Value || 0);
    } else {
      groupedLines.push({
        type,
        desc,
        amount: parseFloat(ln.Amount || ln.Value || 0),
        status: ln.Status,
        rejReason: ln.RejReason || ln.Rejreason || ln.Rej_Reason,
        attachments: attachment ? [attachment] : [],
        date: ln.ExpenseDate || ln.expenseDate || null
      });
    }
  });

  // Extract optional posting document and fiscal year safely
  const postingDoc = header?.Belnr ? String(header.Belnr).trim() : '';
  const gjahrRaw = header?.Gjahr ? String(header.Gjahr).trim() : '';
  const fiscalYear = gjahrRaw && gjahrRaw !== '0000' ? gjahrRaw : '';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Claim {header.ClaimId}</Text>
          <Text style={styles.sub}>{header.EmpName} • {formatDate(header.ClaimDate || header.CreatedOn)}</Text>
        </View>

        {canEdit ? (
          <TouchableOpacity style={styles.editBtn} onPress={() => {
            // RESUBMIT_FEATURE: Store claim data and navigate
            setTempClaimForResubmit(data);
            router.push(`/zexpense/create?claimId=${encodeURIComponent(header.ClaimId)}`);
          }}>
            <Ionicons name="pencil" size={18} color="#FFFFFF" />
            <Text style={styles.editText}>Edit / Resubmit</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.summaryLabel}>{header.ZglName || header.ExpenseType || header.ClaimType || 'Claim Summary'}</Text>
        <View style={styles.inlineGrid}>
          <View style={styles.inlineItem}>
            <Text style={styles.infoLabel}>Amount</Text>
            <Text style={styles.infoValue}>₹{parseFloat(header.TotalAmount || header.Total || 0).toFixed(2)}</Text>
          </View>
          <View style={[styles.inlineItem, styles.divider]}>
            <Text style={styles.infoLabel}>Status</Text>
            <Text style={styles.infoValue}>{normalizedStatus}</Text>
          </View>
          <View style={[styles.inlineItem, styles.divider]}>
            <Text style={styles.infoLabel}>Cost Center</Text>
            <Text style={styles.infoValue}>{header.CostCenter || header.Costcenter || '-'}</Text>
          </View>
          <View style={[styles.inlineItem, styles.divider]}>
            <Text style={styles.infoLabel}>Department</Text>
            <Text style={styles.infoValue}>{header.Department || header.department || '-'}</Text>
          </View>
          <View style={[styles.inlineItem, styles.divider]}>
            <Text style={styles.infoLabel}>Designation</Text>
            <Text style={styles.infoValue}>{header.Designation || header.designation || '-'}</Text>
          </View>
          {postingDoc ? (
            <View style={[styles.inlineItem, styles.divider]}>
              <Text style={styles.infoLabel}>Posting Document</Text>
              <Text style={styles.infoValue}>{postingDoc}</Text>
            </View>
          ) : null}
          {fiscalYear ? (
            <View style={[styles.inlineItem, styles.divider]}>
              <Text style={styles.infoLabel}>Fiscal Year</Text>
              <Text style={styles.infoValue}>{fiscalYear}</Text>
            </View>
          ) : null}
        </View>
        {(header.Status === 'R' || String(header.Status).toLowerCase() === 'rejected') && (header.RejReason || header.Rejreason) ? (
          <View style={styles.rejectionBlock}>
            <Text style={styles.rejectionLabel}>Rejection Reason</Text>
            <Text style={styles.rejectionText}>{header.RejReason || header.Rejreason}</Text>
          </View>
        ) : null}
      </View>

      {(showManagerActions || showFinanceActions) ? (
        <View style={styles.actionCard}>
          {showManagerActions ? (
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.smallActionBtn, styles.smallRejectBtn]} onPress={handleOpenManagerReject}>
                <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
                <Text style={[styles.smallActionText, styles.smallRejectText]}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.smallActionBtn, styles.smallApproveBtn]} onPress={handleManagerApprove}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                <Text style={[styles.smallActionText, styles.smallApproveText]}>Approve</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {showFinanceActions ? (
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.smallActionBtn, styles.smallRejectBtn]} onPress={handleOpenFinanceReject}>
                <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
                <Text style={[styles.smallActionText, styles.smallRejectText]}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.smallActionBtn, styles.smallReleaseBtn]} onPress={handleFinanceRelease}>
                <Ionicons name="cash-outline" size={16} color="#FFFFFF" />
                <Text style={[styles.smallActionText, styles.smallReleaseText]}>Release Payment</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* <Text style={styles.section}>Line Items</Text> */}
      {groupedLines.length === 0 && <Text style={styles.empty}>No line items</Text>}
      {groupedLines.map((ln: any, idx: number) => {
        const lineStatus = ln.status === 'A' ? 'Approved' : ln.status === 'R' ? 'Rejected' : ln.status === 'N' ? 'Submitted' : ln.status || normalizedStatus;
        const lineBackground = lineStatus === 'Approved' ? '#D1FAE5' : lineStatus === 'Submitted' ? '#DBEAFE' : lineStatus === 'Rejected' ? '#FEE2E2' : '#FFFFFF';
        const lineBorder = lineStatus === 'Approved' ? '#10B981' : lineStatus === 'Submitted' ? '#1D4ED8' : lineStatus === 'Rejected' ? '#EF4444' : '#E2E8F0';
        return (
          <View key={idx} style={[styles.lineRow, { backgroundColor: lineBackground, borderColor: lineBorder }]}>
            <View style={styles.lineRowHeader}>
              <Text style={styles.lineType}>{ln.type}</Text>
              <Text style={styles.lineAmt}>₹{ln.amount.toFixed(2)}</Text>
            </View>
            <Text style={styles.lineDesc}>{ln.desc}</Text>
            {ln.date ? (
              <Text style={styles.lineDate}>Date: {formatDate(ln.date)}</Text>
            ) : null}
            {isRejectedClaim && ln.rejReason ? (
              <Text style={styles.rejectionText}>{ln.rejReason}</Text>
            ) : null}
            {ln.attachments && ln.attachments.length > 0 ? (
              <View style={{ marginTop: 8, gap: 4 }}>
                {ln.attachments.map((att: any, aIdx: number) => (
                  <TouchableOpacity 
                    key={aIdx} 
                    onPress={() => handleOpenAttachment(att)} 
                    style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}
                  >
                    <Ionicons name="document-text" size={16} color="#005A9E" style={{ marginRight: 6 }} />
                    <Text style={styles.attachmentText}>
                      {att.Filename ? `Attachment: ${att.Filename}` : `Attachment ${aIdx + 1}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}

      {/* Attachments and timeline might be returned via expanded payload */}
      {data.CLAIMNAV && data.CLAIMNAV.length > 0 && <View style={{ height: 8 }} />}

      <Text style={styles.section}>Claim Status History{historyEntries.length > 0 ? ` (${historyEntries.length})` : ''}</Text>
      {historyEntries.length === 0 ? (
        <Text style={styles.empty}>No workflow history available.</Text>
      ) : (
        historyEntries.map((entry: any, idx: number) => {
          const entryStatus = getEntryDisplayLabel(entry);
          const entryPalette = getStatusPalette(entryStatus);
          return (
            <View key={idx} style={[styles.historyRow, { backgroundColor: entryPalette.bg, borderColor: entryPalette.border }]}>
              <View style={styles.historyHeader}>
                <View style={styles.historyTitleBlock}>
                  <Text style={styles.historyDate}>{formatDate(entry.ActionDate)} • {formatTime(entry.ActionTime)}</Text>
                  <Text style={styles.historyName}>{entry.ActionByName || entry.ActionBy || 'Unknown'}</Text>
                  <Text style={styles.historySubtitle}>{entry.Action || getStatusLabel(entry.Status)} • {getActionLevelLabel(entry.ActionLevel)}</Text>
                </View>
                <View style={[styles.historyBadge, { backgroundColor: getEntryDisplayColor(entry) }]}>
                  <Text style={styles.historyBadgeText}>{entryStatus}</Text>
                </View>
              </View>
                {(() => {
                  const nextApproverName = (entry.NextApproverName || '').toString().trim();
                  const nextApproverValue = (entry.NextApprover || '').toString().trim();
                  const shouldShowNextApprover =
                    nextApproverName !== '' || (nextApproverValue !== '' && nextApproverValue !== '00000000');

                  if (!shouldShowNextApprover) return null;

                  return (
                    <View style={styles.historyMetaRow}>
                      <Text style={styles.historyMetaLabel}>Next Approver:</Text>
                      <Text style={styles.historyMetaValue}>{nextApproverName || nextApproverValue}</Text>
                    </View>
                  );
                })()}
              {entry.Remarks ? (
                <View style={styles.historyMetaRow}>
                  <Text style={styles.historyMetaLabel}>Remarks:</Text>
                  <Text style={styles.historyMetaValue}>{entry.Remarks}</Text>
                </View>
              ) : null}
            </View>
          );
        })
      )}

      {/* Workflow Timeline fallback (render only if component exported correctly and no HISTORYNAV) */}
      {historyEntries.length === 0 && TimelineComp ? <TimelineComp events={header.workflowHistory || []} /> : null}

      <Modal visible={actionModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {actionMode === 'finance-reject' ? 'Reject Claim' : 'Reject Claim'}
            </Text>
            <Text style={styles.modalSub}>
              Please provide a mandatory reason for rejecting this expense claim. This will be recorded in the workflow audit log.
            </Text>
            <TextInput
              style={styles.textInputArea}
              value={actionRemarks}
              onChangeText={setActionRemarks}
              placeholder="Enter mandatory rejection remarks..."
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalActionButtons}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setActionModalVisible(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnConfirmReject} onPress={handleConfirmReject}>
                <Text style={styles.modalBtnConfirmRejectText}>Confirm Rejection</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EBF4FF' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  err: { color: '#DC2626' },
  title: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  sub: { color: '#475569', marginTop: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  editBtn: { backgroundColor: '#2563EB', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center' },
  editText: { color: '#FFFFFF', marginLeft: 8, fontWeight: '700' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 5,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#1D4ED8',
    fontWeight: '800',
    marginBottom: 14,
  },
  inlineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  inlineItem: {
    flex: 1,
    minWidth: 120,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  divider: {},
  infoLabel: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '700',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '800',
    marginTop: 4,
  },
  label: { fontSize: 12, color: '#64748B', marginTop: 8 },
  value: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  section: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginTop: 8, marginBottom: 6 },
  empty: { color: '#94A3B8' },
  lineRow: { backgroundColor: '#F8FAFF', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 8 },
  lineRowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lineType: { fontWeight: '700', color: '#0F172A' },
  lineDesc: { color: '#475569', marginTop: 8 },
  lineDate: { color: '#64748B', marginTop: 4, fontSize: 13 },
  lineAmt: { fontWeight: '800', color: '#0F172A' },
  attachmentText: { marginTop: 8, color: '#1D4ED8', fontSize: 13 },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    padding: 10,
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  smallActionBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallActionText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '700',
  },
  smallApproveBtn: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  smallApproveText: {
    color: '#FFFFFF',
  },
  smallRejectBtn: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  smallRejectText: {
    color: '#DC2626',
  },
  smallReleaseBtn: {
    backgroundColor: '#005A9E',
    borderColor: '#005A9E',
  },
  smallReleaseText: {
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 18,
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 13,
    color: '#475569',
    marginTop: 8,
    lineHeight: 18,
  },
  textInputArea: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    color: '#0F172A',
    textAlignVertical: 'top',
    backgroundColor: '#F8FAFC',
  },
  modalActionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalBtnCancel: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  modalBtnCancelText: {
    color: '#334155',
    fontWeight: '700',
  },
  modalBtnConfirmReject: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#DC2626',
  },
  modalBtnConfirmRejectText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  historyRow: { backgroundColor: '#F8FAFF', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 10 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  historyTitleBlock: { flex: 1, paddingRight: 8 },
  historyDate: { fontSize: 13, fontWeight: '700', color: '#475569' },
  historyName: { marginTop: 4, fontSize: 13, fontWeight: '600', color: '#334155' },
  historyTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  historySubtitle: { marginTop: 2, fontSize: 12, color: '#6B7280' },
  historyBadge: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, alignSelf: 'flex-start', marginTop: 2 },
  historyBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  historyMetaRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, alignItems: 'center' },
  historyMetaLabel: { fontSize: 12, color: '#6B7280', fontWeight: '700' },
  historyMetaValue: { marginLeft: 6, fontSize: 13, color: '#334155' },
  rejectionBlock: { marginTop: 8 },
  rejectionLabel: { color: '#64748B', fontSize: 12, fontWeight: '600' },
  rejectionText: { marginTop: 4, color: '#DC2626', fontSize: 13, fontWeight: '600' },
  inlineDetails: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 8,
  },
});
