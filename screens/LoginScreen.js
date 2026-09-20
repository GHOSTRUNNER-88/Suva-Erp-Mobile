import { useState } from "react";
import { View, Image, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, ScrollView, Platform, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { SvgXml } from "react-native-svg";
import { googleMarkXml } from "../assets/brand/google-mark";
import { useAuth } from "../auth/AuthProvider";
import { setLanguage } from "../i18n/language";
import { recordCrashlyticsError } from "../firebase/crashlytics";
import { colors, tint } from "../theme/colors";
import { fonts } from "../theme/typography";

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
  const isNepali = (i18n.language || "").toLowerCase().startsWith("ne");
  const { login, loginWithGoogle, linkGoogleAccount } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [isMisconfiguredGoogle, setIsMisconfiguredGoogle] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  // Set when signInWithGoogle() reports this email already has a password-based Suva account.
  const [linkEmail, setLinkEmail] = useState(null);
  const [linkCredential, setLinkCredential] = useState(null);
  const [linkPassword, setLinkPassword] = useState("");
  const [linkError, setLinkError] = useState(null);
  const [linkSubmitting, setLinkSubmitting] = useState(false);

  function validate() {
    const errors = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) errors.email = t("auth.emailRequired");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) errors.email = t("auth.emailInvalid");
    if (!password) errors.password = t("auth.passwordRequired");
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit() {
    setFormError(null);
    setIsMisconfiguredGoogle(false);
    if (!validate()) return;
    setSubmitting(true);
    const result = await login(email.trim(), password);
    setSubmitting(false);
    if (!result.ok && result.messageKey) {
      setFormError(t(result.messageKey));
    }
  }

  async function handleGoogleSignIn() {
    setFormError(null);
    setIsMisconfiguredGoogle(false);
    setGoogleSubmitting(true);
    const result = await loginWithGoogle();
    setGoogleSubmitting(false);
    if (result.ok || result.cancelled) return;
    if (result.needsLinking) {
      setLinkEmail(result.email);
      setLinkCredential(result.pendingCredential);
      setLinkPassword("");
      setLinkError(null);
      return;
    }
    if (result.messageKey === "auth.errGoogleMisconfigured") {
      setIsMisconfiguredGoogle(true);
      setFormError(t("auth.errGoogleMisconfigured"));
      return;
    }
    setFormError(t(result.messageKey));
  }

  function closeLinkModal() {
    setLinkEmail(null);
    setLinkCredential(null);
  }

  async function handleLinkSubmit() {
    if (!linkPassword) {
      setLinkError(t("auth.passwordRequired"));
      return;
    }
    setLinkError(null);
    setLinkSubmitting(true);
    const result = await linkGoogleAccount(linkEmail, linkPassword, linkCredential);
    setLinkSubmitting(false);
    if (result.ok) {
      closeLinkModal();
      return;
    }
    setLinkError(t(result.messageKey));
  }

  function toggleLanguage() {
    setLanguage(isNepali ? "en" : "ne");
  }

  return (
    <View style={styles.root}>
      {/* Modern Enterprise Header Banner */}
      <LinearGradient
        colors={["#4C1D95", "#5B21B6", "#7C3AED"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
          {/* Top Bar: Nepal ERP Tag & Language Switcher */}
          <View style={styles.topBarRow}>
            <View style={styles.nepalTopPill}>
              <Text style={styles.nepalFlagEmoji}>🇳🇵</Text>
              <Text style={styles.nepalTopPillText}>
                {isNepali ? "नेपालको आधुनिक क्लाउड ERP" : "Smart Cloud ERP Nepal"}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.languageToggle}
              onPress={toggleLanguage}
              activeOpacity={0.8}
              accessibilityLabel={t("common.language")}
              accessibilityRole="button"
            >
              <Feather name="globe" size={12} color="#fff" style={{ marginRight: 4 }} />
              <Text style={styles.languageToggleText}>
                {isNepali ? "EN (English)" : "नेपाली"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Central Brand Shield & Title */}
          <View style={styles.brandHero}>
            <View style={styles.logoBadgeContainer}>
              <View style={styles.logoBadge}>
                <Image source={require("../assets/android-icon-foreground.png")} style={styles.logoImage} />
              </View>
            </View>

            <View style={styles.brandTextWrap}>
              <View style={styles.titleRow}>
                <Text style={styles.brandTitle}>SUVA ERP</Text>
                <View style={styles.nepalTag}>
                  <Text style={styles.nepalFlagText}>NEPAL</Text>
                </View>
              </View>
              <Text style={styles.brandSubtitle}>
                {isNepali
                  ? "स्मार्ट व्यापार, लेखा तथा स्टक व्यवस्थापन प्रणाली"
                  : "Smart Business Accounting & Inventory Management"}
              </Text>
            </View>
          </View>

          {/* Fiscal Year & Secure Cloud Row */}
          <View style={styles.fiscalBadgeRow}>
            <View style={styles.fiscalBadge}>
              <MaterialCommunityIcons name="calendar-clock" size={13} color="#FBBF24" />
              <Text style={styles.fiscalBadgeText}>
                {isNepali ? "आर्थिक वर्ष: २०८१/८२" : "Fiscal Year: FY 2081/82"}
              </Text>
            </View>
            <View style={styles.fiscalBadge}>
              <MaterialCommunityIcons name="shield-lock" size={13} color="#93C5FD" />
              <Text style={styles.fiscalBadgeText}>
                {isNepali ? "२५६-बिट सुरक्षित लेजर" : "256-Bit Secure Cloud"}
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Main Content & Sign-In Card */}
      <SafeAreaView edges={["bottom", "left", "right"]} style={styles.body}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Login Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.welcomeTitle}>{t("auth.welcomeBack")}</Text>
                <Text style={styles.welcomeSubtitle}>
                  {isNepali
                    ? "आफ्नो कार्यक्षेत्र (Workspace) मा सुरक्षित लगइन गर्नुहोस्"
                    : t("auth.welcomeBackSubtitle")}
                </Text>
              </View>

              {/* Form level error banner */}
              {formError ? (
                <View style={[styles.formErrorBanner, isMisconfiguredGoogle && styles.formErrorBannerWarning]}>
                  <Feather
                    name={isMisconfiguredGoogle ? "info" : "alert-circle"}
                    size={16}
                    color={isMisconfiguredGoogle ? "#D97706" : colors.danger}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.formErrorText, isMisconfiguredGoogle && styles.formErrorTextWarning]}>
                      {formError}
                    </Text>
                    {isMisconfiguredGoogle ? (
                      <Text style={styles.misconfiguredSubtext}>
                        {t("auth.googleMisconfiguredHint")}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ) : null}

              {/* Primary Fast Access: Google Sign-In */}
              <TouchableOpacity
                style={[styles.googleButton, googleSubmitting && styles.googleButtonDisabled]}
                activeOpacity={0.85}
                disabled={googleSubmitting}
                onPress={handleGoogleSignIn}
                accessibilityRole="button"
                accessibilityLabel={t("auth.continueWithGoogle")}
              >
                {googleSubmitting ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <>
                    <SvgXml xml={googleMarkXml} width={20} height={20} />
                    <Text style={styles.googleButtonText}>{t("auth.continueWithGoogle")}</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Clean Divider */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>
                  {isNepali ? "वा कार्यक्षेत्र इमेलबाट" : t("auth.or")}
                </Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Email field */}
              <View style={styles.field}>
                <Text style={styles.label}>{t("auth.email")}</Text>
                <View
                  style={[
                    styles.inputRow,
                    focusedField === "email" && styles.inputRowFocused,
                    fieldErrors.email && styles.inputRowError,
                  ]}
                >
                  <Feather
                    name="mail"
                    size={18}
                    color={focusedField === "email" ? colors.primary : colors.iconMuted}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder={t("auth.emailPlaceholder")}
                    placeholderTextColor={colors.iconMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    value={email}
                    onChangeText={(val) => {
                      setEmail(val);
                      if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: null }));
                    }}
                    onFocus={() => setFocusedField("email")}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
                {fieldErrors.email ? <Text style={styles.errorText}>{fieldErrors.email}</Text> : null}
              </View>

              {/* Password field */}
              <View style={styles.field}>
                <Text style={styles.label}>{t("auth.password")}</Text>
                <View
                  style={[
                    styles.inputRow,
                    focusedField === "password" && styles.inputRowFocused,
                    fieldErrors.password && styles.inputRowError,
                  ]}
                >
                  <Feather
                    name="lock"
                    size={18}
                    color={focusedField === "password" ? colors.primary : colors.iconMuted}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder={t("auth.passwordPlaceholder")}
                    placeholderTextColor={colors.iconMuted}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={(val) => {
                      setPassword(val);
                      if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: null }));
                    }}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={12}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  >
                    <Feather
                      name={showPassword ? "eye" : "eye-off"}
                      size={18}
                      color={showPassword ? colors.primary : colors.iconMuted}
                    />
                  </TouchableOpacity>
                </View>
                {fieldErrors.password ? <Text style={styles.errorText}>{fieldErrors.password}</Text> : null}
              </View>

              {/* Submit button */}
              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel={t("auth.signIn")}
              >
                {submitting ? (
                  <View style={styles.submittingRow}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.submitButtonText}>{t("auth.signingIn", "Signing in...")}</Text>
                  </View>
                ) : (
                  <View style={styles.submitRow}>
                    <Text style={styles.submitButtonText}>{t("auth.signIn")}</Text>
                    <Feather name="arrow-right" size={18} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Built for Nepal Enterprise Features */}
            <View style={styles.complianceCard}>
              <View style={styles.complianceHeaderRow}>
                <MaterialCommunityIcons name="star-circle" size={16} color="#7C3AED" />
                <Text style={styles.complianceHeading}>
                  {isNepali ? "नेपाली व्यवसायका लागि विशेष सुविधाहरू" : "Built for Nepali Businesses"}
                </Text>
              </View>

              <View style={styles.complianceGrid}>
                <View style={styles.complianceItem}>
                  <MaterialCommunityIcons name="calendar-sync" size={14} color="#2563EB" />
                  <Text style={styles.complianceText}>
                    {isNepali ? "वि.सं. (BS) तथा ई.सं. (AD) क्यालेन्डर" : "Dual BS & AD Calendar"}
                  </Text>
                </View>

                <View style={styles.complianceItem}>
                  <MaterialCommunityIcons name="receipt-text-outline" size={14} color="#059669" />
                  <Text style={styles.complianceText}>
                    {isNepali ? "बीजक तथा बिलिङ सुविधा" : "Invoicing & Billing"}
                  </Text>
                </View>

                <View style={styles.complianceItem}>
                  <MaterialCommunityIcons name="account-group-outline" size={14} color="#7C3AED" />
                  <Text style={styles.complianceText}>
                    {isNepali ? "मल्टि-युजर कार्यक्षेत्र" : "Multi-User Workspace"}
                  </Text>
                </View>

                <View style={styles.complianceItem}>
                  <MaterialCommunityIcons name="shield-lock-outline" size={14} color="#D97706" />
                  <Text style={styles.complianceText}>
                    {isNepali ? "२५६-बिट सुरक्षित क्लाउड लेजर" : "256-Bit Secure Cloud"}
                  </Text>
                </View>
              </View>

              <Text style={styles.versionFooter}>
                SUVA ERP v1.0.2 • Smart Cloud Edition
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Account linking modal */}
      <Modal
        visible={!!linkEmail}
        animationType="slide"
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={closeLinkModal}
      >
        <View style={styles.linkModalBackdrop}>
          <View style={styles.linkModalCard}>
            <View style={styles.modalDragPill} />
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalIconWrap}>
                <Feather name="link-2" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.linkModalTitle}>{t("auth.linkAccountTitle")}</Text>
                <Text style={styles.linkModalBody}>
                  {t("auth.linkAccountBody", { email: linkEmail })}
                </Text>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{t("auth.password")}</Text>
              <View style={[styles.inputRow, linkError && styles.inputRowError]}>
                <Feather name="lock" size={18} color={colors.iconMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t("auth.passwordPlaceholder")}
                  placeholderTextColor={colors.iconMuted}
                  secureTextEntry
                  value={linkPassword}
                  onChangeText={setLinkPassword}
                  autoFocus
                />
              </View>
              {linkError ? <Text style={styles.errorText}>{linkError}</Text> : null}
            </View>

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleLinkSubmit}
              disabled={linkSubmitting}
              activeOpacity={0.88}
            >
              {linkSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>{t("auth.linkAccountButton")}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={closeLinkModal} style={styles.linkModalCancel} activeOpacity={0.7}>
              <Text style={styles.linkModalCancelText}>{t("common.cancel")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bodyBg },
  flex: { flex: 1 },
  header: {
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingBottom: 24,
    shadowColor: "#4C1D95",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  headerSafeArea: { paddingHorizontal: 18 },
  topBarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingTop: 6,
    paddingBottom: 10,
  },
  nepalTopPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    gap: 6,
  },
  nepalFlagEmoji: { fontSize: 13 },
  nepalTopPillText: {
    color: "#E2E8F0",
    fontFamily: fonts.semiBold,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  languageToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  languageToggleText: { color: "#fff", fontFamily: fonts.semiBold, fontSize: 12 },
  brandHero: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 12,
    gap: 14,
  },
  logoBadgeContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  logoBadge: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: "#2F2F2F",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: { width: 86, height: 86 },
  brandTextWrap: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandTitle: {
    color: "#fff",
    fontSize: 22,
    fontFamily: fonts.bold,
    letterSpacing: 1.1,
  },
  nepalTag: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  nepalFlagText: { color: "#fff", fontFamily: fonts.semiBold, fontSize: 10 },
  brandSubtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontFamily: fonts.medium,
    marginTop: 3,
    lineHeight: 15,
  },
  fiscalBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    gap: 8,
  },
  fiscalBadge: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  fiscalBadgeText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 10.5,
    fontFamily: fonts.semiBold,
  },
  body: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 28,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardHeader: { marginBottom: 16, alignItems: "center" },
  welcomeTitle: {
    fontSize: 19,
    fontFamily: fonts.semiBold,
    color: colors.text,
    marginBottom: 4,
    textAlign: "center",
  },
  welcomeSubtitle: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textAlign: "center",
  },
  formErrorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: tint("danger", 0.08),
    borderWidth: 1,
    borderColor: tint("danger", 0.28),
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  formErrorBannerWarning: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FCD34D",
  },
  formErrorText: {
    color: colors.danger,
    fontSize: 12,
    fontFamily: fonts.medium,
    lineHeight: 16,
  },
  formErrorTextWarning: {
    color: "#B45309",
    fontFamily: fonts.semiBold,
  },
  misconfiguredSubtext: {
    color: "#92400E",
    fontSize: 11,
    fontFamily: fonts.regular,
    marginTop: 4,
    lineHeight: 15,
  },
  googleButton: {
    flexDirection: "row",
    width: "100%",
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
  },
  googleButtonDisabled: { opacity: 0.7 },
  googleButtonText: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginVertical: 16,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: {
    marginHorizontal: 10,
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fonts.medium,
  },
  field: { width: "100%", marginBottom: 14 },
  label: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.text,
    marginBottom: 5,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.2,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.bodyBg,
    minHeight: 46,
  },
  inputRowFocused: {
    borderColor: colors.primary,
    backgroundColor: "#fff",
    shadowColor: colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
  },
  inputRowError: {
    borderColor: colors.danger,
    backgroundColor: tint("danger", 0.03),
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.text,
  },
  errorText: {
    color: colors.danger,
    fontSize: 11,
    fontFamily: fonts.medium,
    marginTop: 4,
    marginLeft: 2,
  },
  submitButton: {
    width: "100%",
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    shadowColor: colors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  submitButtonDisabled: { opacity: 0.75 },
  submitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submittingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitButtonText: {
    color: "#fff",
    fontFamily: fonts.semiBold,
    fontSize: 14.5,
    letterSpacing: 0.2,
  },
  complianceCard: {
    marginTop: 16,
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  complianceHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  complianceHeading: {
    fontFamily: fonts.semiBold,
    fontSize: 11.5,
    color: colors.text,
  },
  complianceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  complianceItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.bodyBg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  complianceText: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.textMuted,
  },
  versionFooter: {
    marginTop: 10,
    textAlign: "center",
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.textMuted,
  },
  linkModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "flex-end",
  },
  linkModalCard: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    paddingBottom: 34,
  },
  modalDragPill: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: 14,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  modalIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: tint("primary", 0.12),
    borderWidth: 1,
    borderColor: tint("primary", 0.25),
    alignItems: "center",
    justifyContent: "center",
  },
  linkModalTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.text,
    marginBottom: 4,
  },
  linkModalBody: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.textMuted,
    lineHeight: 17,
  },
  linkModalCancel: { alignItems: "center", marginTop: 12, paddingVertical: 8 },
  linkModalCancelText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.textMuted },
});
