import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../../src/context/AuthContext';
import { useClaim } from '../../../src/context/ClaimContext';
import { ExpenseClaim } from '../../../src/types';
import { formatClaimDisplayDate, getClaimCreatedTimestamp } from '../../../src/utils/claim-date';

export default function DashboardScreen() {
  const router = useRouter();
  const { kpis, claims, fetchClaims } = useClaim();
  const { activeRole } = useAuth();
  const recentClaims = [...claims]
    .sort((left, right) => getClaimCreatedTimestamp(right) - getClaimCreatedTimestamp(left))
    .slice(0, 5);

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

  // Visual-only color mappings for card accents and subtle tints
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

  // Icon color and circular background for KPI icons
  const iconColors: Record<string, string> = {
    total: '#005A9E',
    pending: '#D97706',
    approved: '#059669',
    paid: '#10B981',
    rejected: '#DC2626',
  };

  const iconBg: Record<string, string> = {
    total: '#E6F2FF',
    pending: '#FFF6E6',
    approved: '#ECFDF5',
    paid: '#ECFDF0',
    rejected: '#FFF1F2',
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* KPI Cards Section (BR-001) */}
      <View style={styles.kpiGrid}>
        <TouchableOpacity style={[styles.kpiCard, styles.cardBlue]} onPress={() => router.push('/zexpense/my-claims?status=All')}>
          <Text style={styles.kpiCount}>{kpis.total}</Text>
          <Text style={styles.kpiLabel}>Total Claims</Text>
          <View style={[styles.kpiIconWrap, { backgroundColor: iconBg.total }]}> 
            <Ionicons name="documents-outline" size={22} color={iconColors.total} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.kpiCard, styles.cardYellow]} onPress={() => router.push('/zexpense/my-claims?status=Submitted')}>
          <Text style={styles.kpiCount}>{kpis.pending}</Text>
          <Text style={styles.kpiLabel}>Pending Approval</Text>
          <View style={[styles.kpiIconWrap, { backgroundColor: iconBg.pending }]}> 
            <Ionicons name="time-outline" size={22} color={iconColors.pending} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.kpiCard, styles.cardGreen]} onPress={() => router.push('/zexpense/my-claims?status=Approved')}>
          <Text style={styles.kpiCount}>{kpis.approved}</Text>
          <Text style={styles.kpiLabel}>Approved / Pending Pay</Text>
          <View style={[styles.kpiIconWrap, { backgroundColor: iconBg.approved }]}> 
            <Ionicons name="checkmark-circle-outline" size={22} color={iconColors.approved} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.kpiCard, styles.cardEmerald]} onPress={() => router.push('/zexpense/my-claims?status=Paid')}>
          <Text style={styles.kpiCount}>{kpis.paid}</Text>
          <Text style={styles.kpiLabel}>Paid Claims</Text>
          <View style={[styles.kpiIconWrap, { backgroundColor: iconBg.paid }]}> 
            <Ionicons name="cash-outline" size={22} color={iconColors.paid} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.kpiCard, styles.cardRed]} onPress={() => router.push('/zexpense/my-claims?status=Rejected')}>
          <Text style={styles.kpiCount}>{kpis.rejected}</Text>
          <Text style={styles.kpiLabel}>Rejected</Text>
          <View style={[styles.kpiIconWrap, { backgroundColor: iconBg.rejected }]}> 
            <Ionicons name="close-circle-outline" size={22} color={iconColors.rejected} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.kpiCard, styles.cardEmerald]} onPress={() => router.push('/zexpense/my-claims?status=Paid&period=last3months')}>
          <Text style={styles.kpiCount}>₹{(kpis.last3MonthsTotal || 0).toFixed(2)}</Text>
          <Text style={styles.kpiLabel}>Last 3 Months Total</Text>
          <View style={[styles.kpiIconWrap, { backgroundColor: iconBg.paid }]}> 
            <Ionicons name="bar-chart-outline" size={22} color={iconColors.paid} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <View style={styles.actionBanner}>
        <View style={styles.bannerTextCol}>
          <Text style={styles.bannerTitle}>Need to submit a reimbursement?</Text>
          <Text style={styles.bannerSub}>Attach receipts and route to your manager instantly.</Text>
        </View>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => {
            router.push('/zexpense/create');
          }}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.actionBtnText}>Create Claim</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Claims Section */}
      <View style={styles.recentSectionHeader}>
        <Text style={styles.sectionTitle}>Recent Claims Activity</Text>
        <View style={styles.recentHeaderRight}>
          {activeRole === 'employee' && (
            <TouchableOpacity onPress={() => router.push('/zexpense/my-claims')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          )}
          {/* Retry button — re-fetches data if API previously failed */}
          <TouchableOpacity style={styles.refreshBtn} onPress={() => fetchClaims()}>
            <Text style={styles.refreshBtnText}>↺ Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.recentList}>
        {recentClaims.map(claim => {
          const badge = getStatusBadge(claim.status);
          const accent = accentColors[claim.status] || accentColors.default;
          const tint = tintColors[claim.status] || tintColors.default;
          const expenseType = (claim.expenseType || '').trim();
          return (
            <TouchableOpacity
              key={claim.id}
              style={[styles.claimRow, { borderLeftColor: accent, backgroundColor: tint }]}
              onPress={() => router.push(`/zexpense/claim/${claim.id}`)}
            >
              <View style={styles.claimLeft}>
                <View style={styles.claimIdRow}>
                  <Text style={styles.claimId}>{claim.id}</Text>
                  {expenseType ? <Text style={styles.claimType}>{expenseType}</Text> : null}
                </View>
                <Text style={styles.claimDesc} numberOfLines={1}>{claim.justification}</Text>
                <Text style={styles.claimMeta}>{claim.employeeName} | Date: {formatClaimDisplayDate(claim)}</Text>
              </View>
              <View style={styles.claimRight}>
                <Text style={styles.claimAmount}>₹{claim.amount.toFixed(2)}</Text>
                <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.statusText, { color: badge.text }]}>{claim.status}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  kpiCard: {
    flexGrow: 1,
    width: '46%',
    backgroundColor: 'rgba(255,255,255,0.80)',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
    position: 'relative',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 6,
    overflow: 'hidden',
  },
  cardBlue: { borderBottomWidth: 6, borderBottomColor: '#005A9E' },
  cardYellow: { borderBottomWidth: 6, borderBottomColor: '#D97706' },
  cardGreen: { borderBottomWidth: 6, borderBottomColor: '#059669' },
  cardEmerald: { borderBottomWidth: 6, borderBottomColor: '#10B981' },
  cardRed: { borderBottomWidth: 6, borderBottomColor: '#DC2626' },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  kpiCount: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
  },
  kpiIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
    opacity: 0,
  },
  kpiIconWrap: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  actionBanner: {
    backgroundColor: '#005A9E',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  bannerTextCol: {
    flex: 1,
    marginRight: 16,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  bannerSub: {
    fontSize: 13,
    color: '#E0F2FE',
    lineHeight: 18,
  },
  actionBtn: {
    backgroundColor: '#002E5D',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 4,
  },
  recentSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  recentHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#005A9E',
  },
  // Refresh button — lets user retry if API failed to load
  refreshBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#005A9E',
  },
  recentList: {
    gap: 10,
  },
  claimRow: {
    backgroundColor: '#FBFDFF',
    borderRadius: 14,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.04)',
    borderLeftWidth: 6,
    borderLeftColor: '#60A5FA',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    marginVertical: 8,
    overflow: 'hidden',
  },
  claimLeft: {
    flex: 1,
    marginRight: 12,
  },
  claimId: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 0,
  },
  claimIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  claimType: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  claimDesc: {
    fontSize: 14,
    color: '#0E2540',
    marginBottom: 6,
  },
  claimMeta: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  claimRight: {
    alignItems: 'flex-end',
  },
  claimAmount: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    minWidth: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
