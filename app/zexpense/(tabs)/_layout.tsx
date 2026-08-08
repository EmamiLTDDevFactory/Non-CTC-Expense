import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Tabs, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useAuth } from '../../../src/context/AuthContext';
import { useClaim } from '../../../src/context/ClaimContext';

export default function TabLayout() {
  const { activeRole, currentUser } = useAuth();
  const { claims } = useClaim();
  const { width } = useWindowDimensions();
  const isCompact = width < 768;
  const normalizeId = (id?: string) => (id || '').toString().replace(/\D/g, '').padStart(8, '0');
  const myNumeric = normalizeId(currentUser?.employeeId);

  // Compute counts for approvals and finance tabs: match currentApprover to logged-in user and relevant rawStatus
  const approvalsCount = claims.filter(c => {
    if (!c.currentApprover) return false;
    try {
      if (activeRole === 'manager') {
        return normalizeId(c.currentApprover) === myNumeric && (c.rawStatus === 'N' || c.rawStatus === 'A');
      }
      if (activeRole === 'B') {
        const employeeNumeric = (c.employeeId || '').toString().replace(/\D/g, '').padStart(8, '0');
        if (employeeNumeric === myNumeric) return false;
        return c.rawStatus === 'H' || c.rawStatus === 'P';
      }
      return false;
    } catch {
      return false;
    }
  }).length;

  const financeCount = claims.filter(c => {
    if (c.rawStatus !== 'H') return false;
    if (!currentUser?.employeeId) return false;

    try {
      return normalizeId(c.employeeId) !== myNumeric;
    } catch {
      return false;
    }
  }).length;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0F172A',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          backgroundColor: '#F8FAFC',
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          height: isCompact ? 84 : 84,
          paddingBottom: isCompact ? 8 : 10,
          paddingTop: isCompact ? 8 : 8,
          paddingHorizontal: isCompact ? 4 : 10,
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: -2 },
          elevation: 4,
        },
        tabBarItemStyle: {
          flex: 1,
          minWidth: 0,
          marginHorizontal: isCompact ? 2 : 3,
          paddingHorizontal: 0,
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarLabelStyle: {
          fontSize: isCompact ? 11 : 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarButton: (props) => (
            <CustomTabButton
              {...props}
              compact={isCompact}
              title="Dashboard"
              subtitle="Overview & Analytics"
              iconName="view-dashboard"
              gradientColors={['#FFFFFF', '#F0FDF4']}
              accent="#10B981"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create Claim',
          tabBarButton: (props) => (
            <CustomTabButton
              {...props}
              compact={isCompact}
              title="Create"
              subtitle="New Claim"
              iconName="plus-circle"
              gradientColors={['#FFFFFF', '#EFF6FF']}
              accent="#2563EB"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="my-claims"
        options={{
          title: 'My Claims',
          tabBarButton: (props) => (
            <CustomTabButton
              {...props}
              compact={isCompact}
              title="My Claims"
              subtitle="View & Track Claims"
              iconName="receipt-text"
              gradientColors={['#FFFFFF', '#FFF7ED']}
              accent="#F97316"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="approvals"
        options={
          activeRole === 'manager' || activeRole === 'B'
            ? {
                title: 'Approvals',
                tabBarBadge: approvalsCount > 0 ? approvalsCount : undefined,
                tabBarButton: (props) => (
                  <CustomTabButton
                    {...props}
                    compact={isCompact}
                    title="Approvals"
                    subtitle="Manager Review"
                    iconName="clipboard-text"
                    gradientColors={['#FFFFFF', '#F5F3FF']}
                    accent="#8B5CF6"
                    badge={approvalsCount > 0 ? approvalsCount : undefined}
                  />
                ),
              }
            : {
                title: 'Approvals',
                href: null,
              }
        }
      />
      <Tabs.Screen
        name="finance"
        options={
          activeRole === 'finance'
            ? {
                title: 'Finance',
                tabBarBadge: financeCount > 0 ? financeCount : undefined,
                tabBarButton: (props) => (
                  <CustomTabButton
                    {...props}
                    compact={isCompact}
                    title="Finance"
                    subtitle="Finance & Reports"
                    iconName="wallet-outline"
                    gradientColors={['#FFFFFF', '#F5F3FF']}
                    accent="#8B5CF6"
                    badge={financeCount > 0 ? financeCount : undefined}
                  />
                ),
              }
            : {
                title: 'Finance',
                href: null,
              }
        }
      />
      <Tabs.Screen
        name="errors"
        options={{
          title: 'SAP Errors',
          href: null,
          tabBarIcon: ({ color, size }) => <Ionicons name="construct-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

function CustomTabButton({ onPress, accessibilityState, title, subtitle, iconName, gradientColors, accent, badge, compact, style }: any) {
  const pathname = usePathname();

  // Manually compute selected state for web compatibility
  const selected = accessibilityState?.selected ||
    (title === 'Dashboard' && (pathname === '/zexpense' || pathname === '/zexpense/')) ||
    (title === 'Create' && pathname === '/zexpense/create') ||
    (title === 'My Claims' && pathname === '/zexpense/my-claims') ||
    (title === 'Approvals' && pathname === '/zexpense/approvals') ||
    (title === 'Finance' && pathname === '/zexpense/finance');
  const scale = useRef(new Animated.Value(selected ? 1.03 : 1)).current;

  // Active gradient colors map (darker vibrant versions for high text contrast)
  const activeGradients: Record<string, string[]> = {
    Dashboard: ['#10B981', '#059669'],    // Vibrant emerald green
    Create: ['#2563EB', '#1D4ED8'],       // Vibrant royal blue
    'My Claims': ['#F97316', '#EA580C'],  // Vibrant orange
    Approvals: ['#A855F7', '#8B5CF6'],    // Vibrant purple
    Finance: ['#0EA5E9', '#0284C7'],      // Vibrant sky blue
  };

  const activeColors = activeGradients[title] || [accent, accent];
  const currentGradient = selected ? activeColors : (gradientColors || ['#FFFFFF', '#FFFFFF']);

  useEffect(() => {
    Animated.spring(scale, {
      toValue: selected ? (compact ? 1.015 : 1.04) : 1,
      friction: 10,
      tension: 160,
      useNativeDriver: true,
    }).start();
  }, [selected, scale, compact]);

  return (
    <Animated.View style={[style, localStyles.btn, selected && localStyles.activeBtn, { transform: [{ scale }] }]}>
      <TouchableOpacity 
        onPress={onPress} 
        activeOpacity={0.9} 
        style={[localStyles.touchArea, compact && { paddingHorizontal: 4, paddingVertical: 5 }]}
      >
        <LinearGradient
          colors={currentGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={localStyles.innerGlow} />
        <View style={[localStyles.content, compact && { gap: 4 }]}>
          <View style={[
            localStyles.iconWrap,
            compact && { width: 24, height: 24, borderRadius: 8 },
            { backgroundColor: selected ? '#FFFFFF' : accent }
          ]}>
            <MaterialCommunityIcons
              name={iconName}
              size={compact ? 15 : 20}
              color={selected ? accent : '#FFFFFF'}
            />
          </View>
          <View style={localStyles.textWrap}>
            <Text
              numberOfLines={1}
              style={[
                localStyles.label,
                compact && localStyles.labelCompact,
                { color: selected ? '#FFFFFF' : '#0F172A' }
              ]}
            >
              {title}
            </Text>
            {compact ? null : (
              <Text
                numberOfLines={1}
                style={[
                  localStyles.subtitle,
                  { color: selected ? 'rgba(255,255,255,0.92)' : '#475569' }
                ]}
              >
                {subtitle}
              </Text>
            )}
          </View>
          {compact ? null : (
            <View style={localStyles.chevronWrap}>
              <Ionicons name="chevron-forward" size={16} color={accent} />
            </View>
          )}
        </View>
        {badge ? (
          <View style={[localStyles.badge, compact && localStyles.badgeCompact]}>
            <Text style={localStyles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

const localStyles = StyleSheet.create({
  btn: {
    flex: 1,
    minWidth: 0,
    height: '90%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    marginHorizontal: 2,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    shadowColor: '#000',
    shadowOpacity: 0.09,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 9,
  },
  activeBtn: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
    borderColor: 'rgba(255,255,255,0.92)',
  },
  touchArea: {
    flex: 1,
    minHeight: 52,
    minWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    borderRadius: 18,
    paddingHorizontal: 8,
    paddingVertical: 7,
    overflow: 'hidden',
  },
  innerGlow: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    letterSpacing: 0.1,
  },
  labelCompact: {
    fontSize: 10,
  },
  subtitle: {
    marginTop: 1,
    fontSize: 9,
    lineHeight: 12,
    color: '#475569',
    fontWeight: '500',
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  chevronWrap: {
    width: 22,
    height: 22,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 8,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeCompact: {
    top: 5,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
