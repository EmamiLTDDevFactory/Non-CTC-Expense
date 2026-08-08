import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from '../../src/config/api';
import { useAuth } from '../../src/context/AuthContext';
import { UserRole } from '../../src/types';

export default function LoginScreen() {
  const { login } = useAuth();

  const [employeeId, setEmployeeId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [step, setStep] = useState<'ID' | 'OTP'>('ID');
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');

  // Inline error message (replaces Alert popups)
  const [errorMsg, setErrorMsg] = useState('');
  // Success toast (e.g. OTP sent confirmation)
  const [successMsg, setSuccessMsg] = useState('');

  // Auto-dismiss the green success toast after 5 seconds
  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(''), 5000);
    return () => clearTimeout(t);
  }, [successMsg]);

  const handleSendOtp = async () => {
    if (isLoading) return;
    setErrorMsg('');

    const trimmedId = employeeId.trim();
    if (!trimmedId) {
      setErrorMsg('Please enter your Employee ID');
      return;
    }

    if (trimmedId.length < 8 || trimmedId.length > 10) {
      setErrorMsg('Employee ID must be 8 to 10 characters long');
      return;
    }

    const numericId = trimmedId.replace(/\D/g, '');
    if (!numericId || numericId.length > 8) {
      setErrorMsg('Employee ID must contain a valid numeric identifier');
      return;
    }

    setIsLoading(true);
    try {
      // Call the SAP LoginSet via our node server
      const empIdForSAP = numericId.padStart(8, '0');
      const targetUrl = `${API_BASE_URL}/api/send-otp?loginId=${empIdForSAP}`;
      console.log('[DEBUG OTP FETCH] API_BASE_URL is:', JSON.stringify(API_BASE_URL), 'Target URL:', targetUrl);
      const response = await fetch(targetUrl);
      const rawText = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        console.error('[OTP Fetch Error] Non-JSON response:', rawText);
        setErrorMsg(`Server returned unexpected response (${response.status}). Please check backend.`);
        return;
      }

      const responseType = (data?.d?.Type || data?.Type || '').toString().toUpperCase();
      const apiErrorMessage = data?.error || data?.d?.Message || data?.Message || 'Unable to send OTP';
      const userEmail = data?.d?.Email || data?.Email || '';

      if (!response.ok || responseType === 'E' || !userEmail) {
        setErrorMsg(apiErrorMessage || 'Employee ID not found or not registered for OTP');
        return;
      }

      setEmail(userEmail);
      setSuccessMsg('OTP sent to your registered email. Please check your inbox.');
      setStep('OTP');

    } catch (error: any) {
      console.error('Error sending OTP:', error);
      setErrorMsg(error?.message || 'Unable to connect to server. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (isLoading) return;
    setErrorMsg('');

    if (!otp) {
      setErrorMsg('Please enter the OTP sent to your email.');
      return;
    }
    
    setIsLoading(true);
    const trimmedId = employeeId.trim();
    let detectedRole: UserRole = 'employee';

    try {
      const empIdForSAP = trimmedId.replace(/\D/g, '').padStart(8, '0');
      const response = await fetch(`${API_BASE_URL}/api/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId: empIdForSAP, otp, email })
      });

      const rawText = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        console.error('[Verify OTP Fetch Error] Non-JSON response:', rawText);
        setErrorMsg(`Server returned unexpected response (${response.status}). Please check backend.`);
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        const message = data?.error || 'Invalid OTP. Please check and try again.';
        setErrorMsg(message);
        setIsLoading(false);
        return;
      }

      const legacyRole = typeof data?.role === 'string' ? data.role.trim() : 'employee';
      const explicitRole = typeof data?.Role === 'string' ? data.Role.trim() : '';

      detectedRole =
        explicitRole.toUpperCase() === 'B'
          ? 'B'
          : ((legacyRole || 'employee') as UserRole);
      
      // Login successful!
      const success = login(trimmedId.toUpperCase(), detectedRole, data?.Name, data);
      if (!success) {
        setErrorMsg('Login failed. Please try again.');
      }
    } catch (error) {
      console.log('Error verifying OTP in SAP:', error);
      setErrorMsg('Could not reach the server. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <View style={styles.card}>
          <View style={styles.loginLogoWrap}>
            <Image
              source={require('../../assets/images/emami-logo1.png.jpg')}
              style={styles.loginLogo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.cardSubtitle}>Enter your Employee ID to continue</Text>

          {/* Green success toast — auto-dismisses after 5s */}
          {successMsg ? (
            <View style={styles.successBanner}>
              <Text style={styles.successText}>✓  {successMsg}</Text>
            </View>
          ) : null}

          {/* Red inline error — clears as soon as user types */}
          {errorMsg ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>⚠  {errorMsg}</Text>
            </View>
          ) : null}

          {step === 'ID' ? (
            <>
              <TextInput
                style={[styles.input, errorMsg ? styles.inputError : null]}
                placeholder="e.g., EMP-9021 (8-10 chars)"
                placeholderTextColor="#94A3B8"
                value={employeeId}
                onChangeText={(text) => { setEmployeeId(text); setErrorMsg(''); }}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={handleSendOtp}
              />

              <TouchableOpacity
                style={styles.button}
                onPress={handleSendOtp}
                disabled={isLoading}
              >
                <Text style={styles.buttonText}>Send OTP</Text>
              </TouchableOpacity>

              <Text style={styles.hintText}>
                Valid IDs: EMP-9021, MGR-4052, FIN-1092
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.hintText}>Enter OTP sent to your registered device</Text>
              <TextInput
                style={[styles.input, errorMsg ? styles.inputError : null]}
                placeholder="6-digit OTP"
                placeholderTextColor="#94A3B8"
                value={otp}
                onChangeText={(text) => { setOtp(text); setErrorMsg(''); }}
                keyboardType="numeric"
                maxLength={6}
                returnKeyType="done"
                onSubmitEditing={handleVerifyOtp}
              />

              <TouchableOpacity
                style={styles.button}
                onPress={handleVerifyOtp}
              >
                <Text style={styles.buttonText}>Login</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  setStep('ID');
                  setOtp('');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
              >
                <Text style={styles.secondaryButtonText}>Back to ID Entry</Text>
              </TouchableOpacity>
            </>
          )}

          {isLoading && (
            <ActivityIndicator size="large" color="#005A9E" style={styles.loader} />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#002E5D',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    alignItems: 'center',
  },
  loginLogoWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: 'transparent',
    alignSelf: 'center',
  },
  loginLogo: {
    width: 124,
    height: 124,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#E2E8F0',
  },
  card: {
    width: '100%',
    maxWidth: 620,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 28,
    paddingTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 6,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 16,
    textAlign: 'center',
  },
  // Error banner — replaces Alert.alert for all login errors
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  // Green toast — shown when OTP is sent successfully
  successBanner: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  successText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  input: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 16,
  },
  // Input turns red border when there is an error
  inputError: {
    borderColor: '#DC2626',
    backgroundColor: '#FFF5F5',
  },
  button: {
    backgroundColor: '#005A9E',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
  },
  hintText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  loader: {
    marginTop: 16,
  },
});
