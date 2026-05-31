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
  login: z.string().min(3, 'Minimum 3 characters'),
  email: z.string().email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'Minimum 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
});
type FormData = z.infer<typeof schema>;

export default function RegisterScreen() {
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
      const res = await authApi.register({ login: data.login, email: data.email, password: data.password });
      await signIn(res.access_token);
      router.replace('/');
    } catch (e: any) {
      setError(e.message ?? 'Registration failed');
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
          <Text style={styles.title}>Sign Up</Text>
          <Text style={styles.subtitle}>Create your account and start offering services.</Text>

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
                  label="Username"
                  placeholder="Choose a username"
                  autoCapitalize="none"
                  error={errors.login?.message}
                  {...field}
                  onChangeText={field.onChange}
                />
              )}
            />

            <Controller
              control={control}
              name="email"
              render={({ field }) => (
                <Input
                  label="Email"
                  placeholder="Your email address"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  error={errors.email?.message}
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
                  placeholder="Create a password"
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

            {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

            <Button
              label={isSubmitting ? 'Creating account...' : 'Sign Up'}
              variant="primary"
              size="lg"
              fullWidth
              loading={isSubmitting}
              onPress={handleSubmit(onSubmit)}
            />
          </View>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/auth/login')}>
              <Text style={styles.loginLink}>Log In</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.terms}>
            By signing up, you agree to our{' '}
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
  errorBanner: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    color: Colors.accent,
    backgroundColor: '#FFF0EF',
    padding: Spacing.md,
    borderRadius: Radius.sm,
  },
  loginRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  loginText: { fontFamily: 'Manrope_500Medium', fontSize: 14, color: Colors.text03 },
  loginLink: { fontFamily: 'Manrope_800ExtraBold', fontSize: 14, color: Colors.primary },
  terms: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: Colors.text03,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: { color: Colors.primary, fontFamily: 'Manrope_800ExtraBold' },
});
