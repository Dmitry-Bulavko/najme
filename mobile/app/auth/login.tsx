import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Divider } from '@/components/ui/divider';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { useGoogleAuth } from '@/hooks/use-google-auth';
import { useAuth } from '@/context/auth-context';
import { authApi } from '@/lib/api';
import { Colors, Spacing, Radius } from '@/constants/colors';

const schema = z.object({
  login: z.string().min(1, 'Required'),
  password: z.string().min(1, 'Required'),
});
type FormData = z.infer<typeof schema>;

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const { request, promptAsync } = useGoogleAuth(
    async (token) => {
      await signIn(token);
      router.replace('/');
    },
    (err) => {
      setGoogleLoading(false);
      setError(err.message);
    },
  );

  async function onSubmit(data: FormData) {
    try {
      setError('');
      const res = await authApi.login({ login: data.login, password: data.password });
      await signIn(res.access_token);
      router.replace('/');
    } catch (e: any) {
      setError(e.message ?? 'Login failed');
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.text01} />
          </TouchableOpacity>

          <Text style={styles.logo}>
            Najme<Text style={styles.logoDot}>.</Text>me
          </Text>
          <Text style={styles.title}>Log In</Text>
          <Text style={styles.subtitle}>Welcome back! Sign in to your account.</Text>

          <GoogleSignInButton
            loading={googleLoading}
            disabled={!request}
            onPress={() => {
              setGoogleLoading(true);
              setError('');
              promptAsync();
            }}
          />

          <Divider label="or continue with email" />

          <View style={styles.form}>
            <Controller
              control={control}
              name="login"
              render={({ field }) => (
                <Input
                  label="Email / Username"
                  placeholder="Your email or username"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  error={errors.login?.message}
                  {...field}
                  onChangeText={field.onChange}
                />
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field }) => (
                <Input
                  label="Password"
                  placeholder="Your password"
                  secureTextEntry={!showPassword}
                  error={errors.password?.message}
                  rightSlot={
                    <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                      <Ionicons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={Colors.text03}
                      />
                    </TouchableOpacity>
                  }
                  {...field}
                  onChangeText={field.onChange}
                />
              )}
            />

            <TouchableOpacity>
              <Text style={styles.forgotLink}>Forgot your password?</Text>
            </TouchableOpacity>

            {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

            <Button
              label={isSubmitting ? 'Logging in...' : 'Log In'}
              variant="primary"
              size="lg"
              fullWidth
              loading={isSubmitting}
              onPress={handleSubmit(onSubmit)}
            />
          </View>

          <View style={styles.signUpRow}>
            <Text style={styles.signUpText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/auth/register')}>
              <Text style={styles.signUpLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.terms}>
            By continuing, you agree to our{' '}
            <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  content: { padding: Spacing.xl, gap: Spacing.xl },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.base01,
    borderWidth: 1,
    borderColor: Colors.base04,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  logo: { fontFamily: 'Manrope_800ExtraBold', fontSize: 18, color: Colors.text01 },
  logoDot: { color: Colors.primary },
  title: { fontFamily: 'Manrope_800ExtraBold', fontSize: 32, color: Colors.text01, lineHeight: 38 },
  subtitle: { fontFamily: 'Manrope_500Medium', fontSize: 15, color: Colors.text03, marginTop: -Spacing.md },
  form: { gap: Spacing.lg },
  eyeBtn: { padding: Spacing.sm },
  forgotLink: { fontFamily: 'Manrope_500Medium', fontSize: 14, color: Colors.primary },
  errorBanner: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    color: Colors.accent,
    backgroundColor: '#FFF0EF',
    padding: Spacing.md,
    borderRadius: Radius.sm,
  },
  signUpRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  signUpText: { fontFamily: 'Manrope_500Medium', fontSize: 14, color: Colors.text03 },
  signUpLink: { fontFamily: 'Manrope_800ExtraBold', fontSize: 14, color: Colors.primary },
  terms: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: Colors.text03,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: { color: Colors.primary, fontFamily: 'Manrope_800ExtraBold' },
});
