import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Share,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../lib/api";
import { formatNumber } from "../lib/format";
import ScreenHeader from "../components/ui/ScreenHeader";
import FormField from "../components/ui/FormField";
import SwitchRow from "../components/ui/SwitchRow";
import StickyActionBar from "../components/ui/StickyActionBar";
import { useToast } from "../components/ui/Toast";
import { SkeletonForm, ErrorState } from "../components/ui/ListStates";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import { getSyncStatus } from "../lib/offline/sync";

export default function BusinessProfileScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [organization, setOrganization] = useState(null);
  const [settings, setSettings] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [userRole, setUserRole] = useState("owner");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Switch organization state
  const [switchOpen, setSwitchOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [activeTab, setActiveTab] = useState("basicDetails"); // "basicDetails" | "taxFinancials" | "organizations"

  // Form states
  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [isVatRegistered, setIsVatRegistered] = useState(false);
  const [defaultVatPercent, setDefaultVatPercent] = useState("13");
  const [currency, setCurrency] = useState("NPR");
  const [invoicePrefix, setInvoicePrefix] = useState("INV");
  const [billPrefix, setBillPrefix] = useState("BILL");

  const [fieldErrors, setFieldErrors] = useState({});
  const requestToken = useRef(0);

  const canEdit = userRole === "owner" || userRole === "admin";

  const populateForm = useCallback((orgData, settingsData) => {
    if (!orgData) return;
    setName(orgData.name || "");
    setPhoneNumber(orgData.phoneNumber || "");
    setEmail(orgData.email || "");
    setAddress(orgData.address || "");
    setIndustry(orgData.industry || "");
    setWebsite(orgData.website || "");
    setPanNumber(orgData.panNumber || "");
    setIsVatRegistered(Boolean(orgData.isVatRegistered));
    setDefaultVatPercent(String(settingsData?.defaultVatPercent || "13"));
    setCurrency(orgData.currency || settingsData?.currencySymbol || "NPR");
    setInvoicePrefix(settingsData?.invoicePrefix || "INV");
    setBillPrefix(settingsData?.billPrefix || "BILL");
    setFieldErrors({});
  }, []);

  // Offline sync status
  const [syncStatus, setSyncStatus] = useState({ isDownloaded: false, lastFullSync: null, pendingWriteCount: 0 });

  useEffect(() => {
    const refreshSyncStatus = () => setSyncStatus(getSyncStatus());
    refreshSyncStatus();
    const interval = setInterval(refreshSyncStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const load = useCallback((isRefresh = false) => {
    const token = ++requestToken.current;
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    apiFetch("/api/mobile/organization")
      .then((data) => {
        if (token !== requestToken.current) return;
        setOrganization(data?.organization ?? null);
        setSettings(data?.settings ?? null);
        setOrganizations(Array.isArray(data?.organizations) ? data.organizations : []);
        setUserRole(data?.userRole ?? "owner");
        populateForm(data?.organization, data?.settings);
        setError(null);
      })
      .catch((err) => {
        // Graceful fallback to /api/mobile/session if needed
        apiFetch("/api/mobile/session")
          .then((sess) => {
            if (token !== requestToken.current) return;
            const org = sess?.organization ?? null;
            setOrganization(org);
            setOrganizations(Array.isArray(sess?.organizations) ? sess.organizations : []);
            setUserRole(sess?.user?.role ?? "owner");
            populateForm(org, null);
            setError(null);
          })
          .catch((sessionErr) => {
            if (token !== requestToken.current) return;
            setError(err.messageKey ? t(err.messageKey) : (err.message || sessionErr.message));
          });
      })
      .finally(() => {
        if (token !== requestToken.current) return;
        setLoading(false);
        setRefreshing(false);
      });
  }, [t, populateForm]);

  useEffect(() => {
    load();
  }, [load]);

  async function selectOrganization(nextOrg) {
    if (!nextOrg || nextOrg.id === organization?.id) {
      setSwitchOpen(false);
      return;
    }
    setSwitching(true);
    try {
      await apiFetch("/api/organizations/switch", {
        method: "POST",
        body: { organizationId: nextOrg.id },
      });
      setSwitchOpen(false);
      showToast(
        t("businessProfile.switchSuccess", {
          name: nextOrg.name,
          defaultValue: `Switched to ${nextOrg.name} successfully!`,
        }),
        "success"
      );
      load();
    } catch (err) {
      showToast(err.messageKey ? t(err.messageKey) : err.message, "error");
    } finally {
      setSwitching(false);
    }
  }

  function handleShareCard() {
    const cardLines = [
      (name || organization?.name || "Business").toUpperCase(),
      industry ? `Industry: ${industry}` : null,
      phoneNumber ? `Phone: ${formatNumber(phoneNumber)}` : null,
      email ? `Email: ${email}` : null,
      address ? `Address: ${address}` : null,
      panNumber ? `PAN/VAT: ${formatNumber(panNumber)}` : null,
      website ? `Website: ${website}` : null,
    ].filter(Boolean);

    Share.share({ message: cardLines.join("\n") });
  }

  function validateForm() {
    const errors = {};
    if (!name.trim()) {
      errors.name = t("businessProfile.nameRequired", "Business name is required.");
    } else if (name.trim().length < 2) {
      errors.name = t("businessProfile.nameTooShort", "Business name must be at least 2 characters.");
    }

    if (!industry.trim()) {
      errors.industry = t("businessProfile.industryRequired", "Industry is required.");
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = t("auth.emailInvalid", "That doesn't look like a valid email.");
    }

    if (isVatRegistered && !panNumber.trim()) {
      errors.panNumber = t("businessProfile.panRequiredForVat", "PAN / VAT number is required when VAT registered.");
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!canEdit) {
      showToast(
        t("businessProfile.adminOnlyHint", "Only workspace owners and administrators can edit organization settings."),
        "error"
      );
      return;
    }

    if (!validateForm()) {
      showToast(t("forms.validationErrors", "Please fix the form errors before saving."), "error");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        industry: industry.trim(),
        address: address.trim(),
        isVatRegistered,
        panNumber: panNumber.trim(),
        phoneNumber: phoneNumber.trim(),
        email: email.trim(),
        website: website.trim(),
        currency: currency.trim() || "NPR",
        invoicePrefix: invoicePrefix.trim() || "INV",
        billPrefix: billPrefix.trim() || "BILL",
        defaultVatPercent: defaultVatPercent.trim() || "13",
      };

      const result = await apiFetch("/api/mobile/organization", {
        method: "PUT",
        body: payload,
      });

      if (result?.organization) {
        setOrganization(result.organization);
        setSettings(result.settings ?? settings);
        populateForm(result.organization, result.settings ?? settings);
      }

      showToast(
        t("businessProfile.saveSuccess", "Organization settings saved successfully!"),
        "success"
      );
    } catch (err) {
      if (err.fieldErrors) {
        setFieldErrors(err.fieldErrors);
      }
      showToast(
        err.messageKey ? t(err.messageKey) : (err.message || t("businessProfile.saveError", "Failed to save organization settings.")),
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Calculate profile completion percentage
  const completionPercentage = Math.min(
    100,
    (name ? 15 : 0) +
      (phoneNumber ? 15 : 0) +
      (email ? 15 : 0) +
      (address ? 15 : 0) +
      (industry ? 10 : 0) +
      (panNumber ? 15 : 0) +
      (isVatRegistered ? 10 : 0) +
      (website ? 10 : 0)
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScreenHeader
        title={t("businessProfile.title", "Business Profile & Org Settings")}
        right={
          organizations.length > 1 ? (
            <TouchableOpacity
              style={styles.switchOrgHeaderBtn}
              onPress={() => setSwitchOpen(true)}
              accessibilityLabel="Switch Organization"
              activeOpacity={0.8}
            >
              <Feather name="refresh-cw" size={14} color={colors.primary} />
              <Text style={styles.switchOrgHeaderBtnText}>{t("businessProfile.switch", "Switch")}</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {loading ? (
        <View style={styles.scrollContent}>
          <SkeletonForm fields={8} />
        </View>
      ) : error || !organization ? (
        <ErrorState message={error} onRetry={() => load(false)} />
      ) : (
        <KeyboardAvoidingView
          style={styles.flex1}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: 110 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => load(true)}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
          >
            {/* PayTide FinTech Visiting Card Showcase */}
            <View style={styles.visitingCardWrapper}>
              <View style={styles.visitingCard}>
                <View style={styles.visitingCardHeader}>
                  <View style={styles.visitingCardTitleCol}>
                    <Text style={styles.cardBusinessName} numberOfLines={1}>
                      {(name || organization.name).toUpperCase()}
                    </Text>
                    <Text style={styles.cardIndustrySubtitle} numberOfLines={1}>
                      {industry || organization.industry || "General Trading & Business"}
                    </Text>
                  </View>
                  <View style={styles.logoSquircle}>
                    <MaterialCommunityIcons name="domain" size={20} color={colors.primary} />
                  </View>
                </View>

                <View style={styles.cardContactsRow}>
                  <View style={styles.cardAccentBar} />
                  <View style={styles.cardContactItems}>
                    <View style={styles.contactItem}>
                      <Feather name="phone" size={13} color={colors.primary} />
                      <Text style={styles.contactText}>
                        {phoneNumber ? formatNumber(phoneNumber) : t("businessProfile.notProvided", "Phone Number")}
                      </Text>
                    </View>
                    <View style={styles.contactItem}>
                      <Feather name="mail" size={13} color={colors.primary} />
                      <Text style={styles.contactText} numberOfLines={1}>
                        {email || t("businessProfile.notProvided", "Email Address")}
                      </Text>
                    </View>
                    <View style={styles.contactItem}>
                      <Feather name="map-pin" size={13} color={colors.primary} />
                      <Text style={styles.contactText} numberOfLines={2}>
                        {address || t("businessProfile.notProvided", "Business Address")}
                      </Text>
                    </View>
                    {panNumber ? (
                      <View style={styles.contactItem}>
                        <Feather name="file-text" size={13} color={colors.primary} />
                        <Text style={styles.contactText}>
                          PAN/VAT: {formatNumber(panNumber)} {isVatRegistered ? "(VAT)" : ""}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.shareCardBtn}
                activeOpacity={0.85}
                onPress={handleShareCard}
              >
                <Feather name="share-2" size={15} color="#FFFFFF" />
                <Text style={styles.shareCardBtnText}>
                  {t("businessProfile.shareCard", "Share Card")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Profile Completion Bar */}
            <View style={styles.completionSection}>
              <View style={styles.completionHeaderRow}>
                <Text style={styles.completionLabel}>
                  {t("businessProfile.profileCompletion", {
                    percent: formatNumber(completionPercentage),
                    defaultValue: `Profile ${formatNumber(completionPercentage)}% complete.`,
                  })}
                </Text>
                <Text style={styles.completionPercentBadge}>
                  {formatNumber(completionPercentage)}%
                </Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${completionPercentage}%` }]} />
              </View>
            </View>

            {/* Business Tip Banner */}
            <View style={styles.tipRow}>
              <View style={styles.tipIconBadge}>
                <Feather name="info" size={15} color={colors.warning} />
              </View>
              <Text style={styles.tipText}>
                {formatNumber(67)}% {t("businessProfile.completionTip", "businessmen saw their business increase after sharing their visiting card")}
              </Text>
            </View>

            {/* Read-Only Member Banner */}
            {!canEdit ? (
              <View style={styles.memberBanner}>
                <Feather name="shield" size={16} color={colors.textMuted} />
                <Text style={styles.memberBannerText}>
                  {t("businessProfile.readOnlyNote", "Viewing as member — contact an admin to modify settings.")}
                </Text>
              </View>
            ) : null}

            {/* PayTide 3-Segment Tab Bar */}
            <View style={styles.tabBarRow}>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === "basicDetails" && styles.tabBtnActive]}
                onPress={() => setActiveTab("basicDetails")}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="domain"
                  size={17}
                  color={activeTab === "basicDetails" ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.tabBtnText, activeTab === "basicDetails" && styles.tabBtnTextActive]}>
                  {t("businessProfile.basicDetails", "Basic Details")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, activeTab === "taxFinancials" && styles.tabBtnActive]}
                onPress={() => setActiveTab("taxFinancials")}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="file-percent-outline"
                  size={17}
                  color={activeTab === "taxFinancials" ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.tabBtnText, activeTab === "taxFinancials" && styles.tabBtnTextActive]}>
                  {t("businessProfile.taxFinancials", "Tax & Financials")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, activeTab === "organizations" && styles.tabBtnActive]}
                onPress={() => setActiveTab("organizations")}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="swap-horizontal"
                  size={17}
                  color={activeTab === "organizations" ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.tabBtnText, activeTab === "organizations" && styles.tabBtnTextActive]}>
                  {t("businessProfile.activeOrganization", "Workspace")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tab 1: Basic Details */}
            {activeTab === "basicDetails" ? (
              <View style={styles.cardSection}>
                <FormField
                  label={t("businessProfile.businessName", "Business Name")}
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: null });
                  }}
                  error={fieldErrors.name}
                  required
                  placeholder="e.g. Suvacorp Traders Pvt. Ltd."
                  editable={canEdit}
                />

                <FormField
                  label={t("businessProfile.industry", "Industry / Nature")}
                  value={industry}
                  onChangeText={(text) => {
                    setIndustry(text);
                    if (fieldErrors.industry) setFieldErrors({ ...fieldErrors, industry: null });
                  }}
                  error={fieldErrors.industry}
                  required
                  placeholder="e.g. Retail, Wholesale, IT Services"
                  editable={canEdit}
                />

                <FormField
                  label={t("businessProfile.phoneNumber", "Phone Number")}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  error={fieldErrors.phoneNumber}
                  keyboardType="phone-pad"
                  placeholder="e.g. 9801234567"
                  editable={canEdit}
                />

                <FormField
                  label={t("businessProfile.email", "Email Address")}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: null });
                  }}
                  error={fieldErrors.email}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="e.g. info@business.com"
                  editable={canEdit}
                />

                <FormField
                  label={t("businessProfile.address", "Business Address")}
                  value={address}
                  onChangeText={setAddress}
                  error={fieldErrors.address}
                  multiline
                  numberOfLines={3}
                  placeholder="e.g. New Road, Kathmandu, Nepal"
                  editable={canEdit}
                />

                <FormField
                  label={t("businessProfile.website", "Website")}
                  value={website}
                  onChangeText={setWebsite}
                  error={fieldErrors.website}
                  keyboardType="url"
                  autoCapitalize="none"
                  placeholder="e.g. https://example.com"
                  editable={canEdit}
                />
              </View>
            ) : null}

            {/* Tab 2: Tax & Financials */}
            {activeTab === "taxFinancials" ? (
              <View style={styles.cardSection}>
                <SwitchRow
                  label={t("businessProfile.vatRegistered", "VAT Registered")}
                  value={isVatRegistered}
                  onValueChange={canEdit ? setIsVatRegistered : undefined}
                  hint="Check this if business issues Tax Invoices with VAT"
                  disabled={!canEdit}
                />

                <FormField
                  label={t("businessProfile.panNumber", "PAN / VAT Number")}
                  value={panNumber}
                  onChangeText={(text) => {
                    setPanNumber(text);
                    if (fieldErrors.panNumber) setFieldErrors({ ...fieldErrors, panNumber: null });
                  }}
                  error={fieldErrors.panNumber}
                  required={isVatRegistered}
                  keyboardType="number-pad"
                  placeholder="e.g. 601234567"
                  hint="9-digit PAN registered with Inland Revenue Department"
                  editable={canEdit}
                />

                <FormField
                  label={t("businessProfile.defaultVatPercent", "Default VAT Rate (%)")}
                  value={defaultVatPercent}
                  onChangeText={setDefaultVatPercent}
                  error={fieldErrors.defaultVatPercent}
                  keyboardType="numeric"
                  placeholder="13"
                  suffix="%"
                  editable={canEdit}
                />

                <FormField
                  label={t("businessProfile.currency", "Default Currency")}
                  value={currency}
                  onChangeText={setCurrency}
                  error={fieldErrors.currency}
                  autoCapitalize="characters"
                  placeholder="NPR"
                  editable={canEdit}
                />

                <View style={styles.rowTwoCols}>
                  <View style={styles.colHalf}>
                    <FormField
                      label={t("businessProfile.invoicePrefix", "Invoice Prefix")}
                      value={invoicePrefix}
                      onChangeText={setInvoicePrefix}
                      autoCapitalize="characters"
                      placeholder="INV"
                      editable={canEdit}
                    />
                  </View>
                  <View style={styles.colHalf}>
                    <FormField
                      label={t("businessProfile.billPrefix", "Bill Prefix")}
                      value={billPrefix}
                      onChangeText={setBillPrefix}
                      autoCapitalize="characters"
                      placeholder="BILL"
                      editable={canEdit}
                    />
                  </View>
                </View>
              </View>
            ) : null}

            {/* Tab 3: Workspace & Organizations */}
            {activeTab === "organizations" ? (
              <View style={styles.cardSection}>
                <Text style={styles.sectionHeaderTitle}>
                  {t("businessProfile.activeOrganization", "Active Organization")}
                </Text>

                <View style={styles.activeOrgCard}>
                  <View style={styles.orgHeaderRow}>
                    <View style={styles.activeSquircle}>
                      <MaterialCommunityIcons name="domain" size={24} color={colors.primary} />
                    </View>
                    <View style={styles.orgHeaderDetails}>
                      <Text style={styles.activeOrgName}>{organization.name}</Text>
                      <Text style={styles.activeOrgSlug}>Slug: {organization.slug}</Text>
                    </View>
                    <View style={styles.activeBadge}>
                      <Feather name="check" size={12} color="#16A34A" />
                      <Text style={styles.activeBadgeText}>{t("businessProfile.currentActive", "Active")}</Text>
                    </View>
                  </View>

                  <View style={styles.activeOrgDivider} />

                  <View style={styles.metaGrid}>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>ID</Text>
                      <Text style={styles.metaValue}>#{formatNumber(organization.id)}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Role</Text>
                      <Text style={[styles.metaValue, { textTransform: "capitalize" }]}>{userRole}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Currency</Text>
                      <Text style={styles.metaValue}>{organization.currency || "NPR"}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={styles.metaLabel}>Accounting Start</Text>
                      <Text style={styles.metaValue}>
                        {organization.accountingStartDate ? formatNumber(organization.accountingStartDate) : "Default"}
                      </Text>
                    </View>
                  </View>
                </View>

                {organizations.length > 1 ? (
                  <>
                    <Text style={[styles.sectionHeaderTitle, { marginTop: 24 }]}>
                      {t("businessProfile.switchOrganization", "Switch Organization")}
                    </Text>
                    <Text style={styles.sectionSubtitle}>
                      {t("businessProfile.switchOrganizationHint", "Choose another organization you belong to.")}
                    </Text>

                    <View style={styles.orgsList}>
                      {organizations.map((item) => {
                        const isActive = item.id === organization.id;
                        return (
                          <TouchableOpacity
                            key={item.id}
                            style={[styles.orgCardItem, isActive && styles.orgCardItemActive]}
                            onPress={() => selectOrganization(item)}
                            disabled={switching || isActive}
                            activeOpacity={0.75}
                          >
                            <View style={styles.orgCardLeft}>
                              <View
                                style={[
                                  styles.orgCardIcon,
                                  isActive && { backgroundColor: colors.primaryLight },
                                ]}
                              >
                                <MaterialCommunityIcons
                                  name="office-building"
                                  size={20}
                                  color={isActive ? colors.primary : colors.textMuted}
                                />
                              </View>
                              <View style={styles.orgCardTextWrap}>
                                <Text style={[styles.orgCardName, isActive && styles.orgCardNameActive]}>
                                  {item.name}
                                </Text>
                                <Text style={styles.orgCardSlug}>slug: {item.slug}</Text>
                              </View>
                            </View>

                            {isActive ? (
                              <View style={styles.activeDot}>
                                <Feather name="check" size={16} color={colors.primary} />
                              </View>
                            ) : (
                              <Feather name="chevron-right" size={18} color={colors.iconMuted} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                ) : null}
              </View>
            ) : null}

            {/* Offline Section */}
            <TouchableOpacity
              style={styles.offlineSectionCard}
              activeOpacity={0.75}
              onPress={() => router.push("/offline-manager")}
              accessibilityRole="button"
              accessibilityLabel={t("offline.title", { defaultValue: "Offline Data" })}
            >
              <View style={styles.offlineHeader}>
                <MaterialCommunityIcons
                  name={syncStatus.isDownloaded ? "cloud-check" : "cloud-download-outline"}
                  size={20}
                  color={syncStatus.isDownloaded ? colors.success : colors.textMuted}
                />
                <Text style={styles.offlineTitle}>{t("offline.title", { defaultValue: "Offline Data" })}</Text>
                {syncStatus.pendingWriteCount > 0 ? (
                  <View style={[styles.pendingBadge, { marginLeft: "auto" }]}>
                    <Text style={styles.pendingBadgeText}>{syncStatus.pendingWriteCount}</Text>
                  </View>
                ) : null}
                <Feather name="chevron-right" size={18} color={colors.iconMuted} />
              </View>
              <Text style={styles.offlineStatus}>
                {syncStatus.isDownloaded
                  ? t("offline.statusDownloaded", { defaultValue: "Company data available offline" })
                  : t("offline.statusNotDownloaded", { defaultValue: "Not downloaded yet" })}
              </Text>
              {syncStatus.lastFullSync ? (
                <Text style={styles.offlineSubtext}>
                  {t("offline.lastSync", {
                    value: new Date(syncStatus.lastFullSync).toLocaleDateString(),
                    defaultValue: "Last sync: {{value}}",
                  })}
                </Text>
              ) : null}
            </TouchableOpacity>
          </ScrollView>

          {/* Sticky Bottom Action Bar */}
          {canEdit && activeTab !== "organizations" ? (
            <StickyActionBar
              primaryLabel={t("businessProfile.saveChanges", "Save Settings")}
              onPrimary={handleSave}
              loading={submitting}
              primaryIcon="check"
              secondaryLabel={t("common.cancel", "Back")}
              onSecondary={() => router.back()}
            />
          ) : (
            <View style={[styles.staticBottomDock, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <TouchableOpacity
                style={styles.staticBackBtn}
                onPress={() => router.back()}
                activeOpacity={0.8}
              >
                <Feather name="arrow-left" size={16} color={colors.text} />
                <Text style={styles.staticBackBtnText}>{t("common.close", "Back")}</Text>
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      )}

      {/* Switch Organization Modal */}
      <Modal
        visible={switchOpen}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="slide"
        onRequestClose={() => setSwitchOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSwitchOpen(false)}
        >
          <TouchableOpacity style={styles.modalCard} activeOpacity={1} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t("businessProfile.switchOrganization", "Switch Organization")}
              </Text>
              <TouchableOpacity onPress={() => setSwitchOpen(false)} hitSlop={8}>
                <Feather name="x" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              {t("businessProfile.switchOrganizationHint", "Choose another organization you belong to.")}
            </Text>

            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {organizations.map((item) => {
                const isSelected = item.id === organization?.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.organizationOption, isSelected && styles.organizationOptionSelected]}
                    onPress={() => selectOrganization(item)}
                    disabled={switching}
                  >
                    <View style={styles.orgOptionTextCol}>
                      <Text style={[styles.orgName, isSelected && styles.orgNameSelected]}>
                        {item.name}
                      </Text>
                      <Text style={styles.orgSlugText}>{item.slug}</Text>
                    </View>
                    {isSelected ? (
                      <View style={styles.selectedBadge}>
                        <Feather name="check" size={16} color={colors.primary} />
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {switching ? (
              <View style={styles.switchingLoaderRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.switchingText}>Switching organization...</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  flex1: { flex: 1 },
  scrollContent: { padding: 16 },

  switchOrgHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  switchOrgHeaderBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.primary,
  },

  visitingCardWrapper: {
    alignItems: "center",
    marginBottom: 16,
  },
  visitingCard: {
    width: "100%",
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    paddingBottom: 28,
  },
  visitingCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  visitingCardTitleCol: {
    flex: 1,
    marginRight: 10,
  },
  cardBusinessName: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.primary,
    letterSpacing: 0.5,
  },
  cardIndustrySubtitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  logoSquircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.primary + "20",
  },
  cardContactsRow: {
    flexDirection: "row",
    gap: 12,
  },
  cardAccentBar: {
    width: 3,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  cardContactItems: {
    gap: 6,
    flex: 1,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  contactText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    flex: 1,
  },
  shareCardBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 10,
    marginTop: -16,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  shareCardBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: "#FFFFFF",
  },

  completionSection: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  completionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  completionLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.text,
  },
  completionPercentBadge: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.brandBlue,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.light,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.brandBlue,
    borderRadius: 3,
  },

  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.2)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  tipIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  tipText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12,
    color: "#92400E",
    lineHeight: 17,
  },

  memberBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.light,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberBannerText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },

  tabBarRow: {
    flexDirection: "row",
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: colors.primaryLight,
  },
  tabBtnText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  tabBtnTextActive: {
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },

  cardSection: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },

  rowTwoCols: {
    flexDirection: "row",
    gap: 12,
  },
  colHalf: {
    flex: 1,
  },

  sectionHeaderTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 14,
  },

  activeOrgCard: {
    backgroundColor: colors.light,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orgHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  activeSquircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  orgHeaderDetails: {
    flex: 1,
  },
  activeOrgName: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.text,
  },
  activeOrgSlug: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  activeBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: "#16A34A",
  },
  activeOrgDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 10,
  },
  metaItem: {
    width: "50%",
  },
  metaLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textMuted,
  },
  metaValue: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.text,
    marginTop: 2,
  },

  orgsList: {
    gap: 10,
  },
  orgCardItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orgCardItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight + "15",
  },
  orgCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  orgCardIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.light,
    alignItems: "center",
    justifyContent: "center",
  },
  orgCardTextWrap: {
    flex: 1,
  },
  orgCardName: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.text,
  },
  orgCardNameActive: {
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
  orgCardSlug: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  activeDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  staticBottomDock: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  staticBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    backgroundColor: colors.light,
    borderRadius: 10,
  },
  staticBackBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
  },

  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: colors.scrim,
  },
  modalCard: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  modalTitle: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.text,
  },
  modalSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 16,
  },
  modalList: {
    maxHeight: 300,
  },
  organizationOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  organizationOptionSelected: {
    backgroundColor: colors.primaryLight + "10",
  },
  orgOptionTextCol: {
    flex: 1,
  },
  orgName: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.text,
  },
  orgNameSelected: {
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
  orgSlugText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  selectedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  switchingLoaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingTop: 16,
  },
  switchingText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.primary,
  },
  offlineSectionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  offlineHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  offlineTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
  offlineStatus: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  offlineSubtext: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  pendingBadge: {
    backgroundColor: colors.danger + "15",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
  },
  pendingBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.danger,
  },
});
