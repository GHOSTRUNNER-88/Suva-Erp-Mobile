import { useRef, useState } from "react";
import { View, Image, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Animated, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import { useAuth } from "../auth/AuthProvider";
import { markOnboardingSeen } from "../lib/onboarding";
import { formatNpr, formatNumber } from "../lib/format";
import { LanguageSwitch } from "../components/ui/AppHeader";
import { colors, tint } from "../theme/colors";
import { fonts } from "../theme/typography";

const { width } = Dimensions.get("window");

const TOTAL_SLIDES = 5;

/**
 * Detailed first sign-in tutorial and onboarding walkthrough.
 * Teaches users the core capabilities of Suva ERP:
 *   1. Dual Calendar (BS/AD) & Bilingual Nepal-first ERP
 *   2. Fast, Professional Invoicing (WhatsApp share, Print, VAT)
 *   3. Customer Party Ledgers & Dues Tracking
 *   4. Real-time Inventory & AI Receipt Scanner
 *   5. Interactive Launchpad with "Create First Invoice" CTA
 */
export default function OnboardingScreen() {
  const { t, i18n } = useTranslation();
  const isNepali = (i18n.language || "").toLowerCase().startsWith("ne");
  const { user, completeOnboarding } = useAuth();
  const [index, setIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const scrollRef = useRef(null);

  async function handleFinish(destination = "dashboard") {
    if (finishing) return;
    setFinishing(true);
    try {
      if (user?.uid) await markOnboardingSeen(user.uid);
    } catch (_error) {
      // Local storage failure shouldn't block user navigation
    }
    completeOnboarding();
    if (destination === "invoice") {
      router.replace("/sales/new");
    } else {
      router.replace("/(tabs)");
    }
  }

  function goToSlide(targetIndex) {
    if (targetIndex < 0 || targetIndex >= TOTAL_SLIDES) return;
    scrollRef.current?.scrollTo({ x: targetIndex * width, animated: true });
    setIndex(targetIndex);
  }

  function handleScroll(event) {
    const newIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    if (newIndex !== index) setIndex(newIndex);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Top Header Bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <View style={styles.brandIconBox}>
            <Image source={require("../assets/android-icon-foreground.png")} style={styles.brandImage} />
          </View>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>
              {t("onboarding.stepIndicator", {
                current: formatNumber(index + 1),
                total: formatNumber(TOTAL_SLIDES),
              })}
            </Text>
          </View>
        </View>

        <View style={styles.topBarRight}>
          <LanguageSwitch />
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => handleFinish("dashboard")}
            hitSlop={12}
            disabled={finishing}
          >
            <Text style={styles.skipText}>{t("onboarding.skip")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Horizontal Paging Carousel */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        style={styles.scrollArea}
      >
        {/* Slide 1: Welcome & Nepal ERP Overview */}
        <View style={[styles.slide, { width }]}>
          <View style={styles.heroVisualWrap}>
            <View style={[styles.iconCircle, { backgroundColor: "#F3EEFF" }]}>
              <Feather name="shield" size={44} color={colors.primary} />
            </View>
            <View style={styles.glowingDot} />
          </View>

          <Text style={styles.slideTitle}>{t("onboarding.slide1Title")}</Text>
          <Text style={styles.slideSubtitle}>{t("onboarding.slide1Subtitle")}</Text>
          <Text style={styles.slideBody}>{t("onboarding.slide1Body")}</Text>

          {/* Feature Highlights Grid */}
          <View style={styles.featureHighlights}>
            <View style={styles.highlightRow}>
              <View style={[styles.highlightIcon, { backgroundColor: "#EBFBFA" }]}>
                <Feather name="calendar" size={16} color={colors.info} />
              </View>
              <Text style={styles.highlightText}>{t("onboarding.slide1Pill2")}</Text>
            </View>
            <View style={styles.highlightRow}>
              <View style={[styles.highlightIcon, { backgroundColor: "#F3EEFF" }]}>
                <Feather name="globe" size={16} color={colors.primary} />
              </View>
              <Text style={styles.highlightText}>{t("onboarding.slide1Pill1")}</Text>
            </View>
            <View style={styles.highlightRow}>
              <View style={[styles.highlightIcon, { backgroundColor: "#EAFBF3" }]}>
                <Feather name="check-circle" size={16} color={colors.success} />
              </View>
              <Text style={styles.highlightText}>{t("onboarding.slide1Pill3")}</Text>
            </View>
          </View>
        </View>

        {/* Slide 2: Invoicing & Billing Walkthrough */}
        <View style={[styles.slide, { width }]}>
          {/* Mock Interactive Invoice Card */}
          <View style={styles.mockCard}>
            <View style={styles.mockHeader}>
              <View>
                <Text style={styles.mockDocId}>
                  {t("onboarding.slide2SampleInvoice")} #{formatNumber(101)}
                </Text>
                <Text style={styles.mockCustomer}>{t("onboarding.slide2SampleCustomer")}</Text>
              </View>
              <View style={styles.paidBadge}>
                <Text style={styles.paidBadgeText}>{t("onboarding.slide2SampleStatus")}</Text>
              </View>
            </View>

            <View style={styles.mockDivider} />

            <View style={styles.mockLineItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.mockItemName}>{t("onboarding.slide2SampleItem")}</Text>
                <Text style={styles.mockItemQty}>
                  {formatNumber(2)} pcs × {formatNpr(3750)}
                </Text>
              </View>
              <Text style={styles.mockItemAmount}>{formatNpr(7500)}</Text>
            </View>

            <View style={styles.mockTotalRow}>
              <Text style={styles.mockTotalLabel}>
                {isNepali ? "कुल जम्मा (भ्याट १३% सहित)" : "Total (incl. 13% VAT)"}
              </Text>
              <Text style={styles.mockTotalAmount}>{formatNpr(8475)}</Text>
            </View>

            <View style={styles.mockActionChips}>
              <View style={styles.mockChip}>
                <Feather name="message-circle" size={12} color="#25D366" />
                <Text style={styles.mockChipText}>{t("onboarding.slide2ActionShare")}</Text>
              </View>
              <View style={styles.mockChip}>
                <Feather name="printer" size={12} color={colors.primary} />
                <Text style={styles.mockChipText}>{t("onboarding.slide2ActionPrint")}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.slideTitle}>{t("onboarding.slide2Title")}</Text>
          <Text style={styles.slideSubtitle}>{t("onboarding.slide2Subtitle")}</Text>
          <Text style={styles.slideBody}>{t("onboarding.slide2Body")}</Text>
        </View>

        {/* Slide 3: Customer Ledgers & Dues Tracking */}
        <View style={[styles.slide, { width }]}>
          {/* Mock Customer Ledger Card */}
          <View style={styles.mockCard}>
            <View style={styles.partyHeaderRow}>
              <View style={[styles.partyAvatar, { backgroundColor: "#FFF6E8" }]}>
                <Feather name="user" size={22} color={colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mockCustomer}>{t("onboarding.slide3SampleParty")}</Text>
                <Text style={styles.partySubtitle}>
                  {isNepali ? "नियमित ग्राहक" : "Regular Customer"}
                </Text>
              </View>
            </View>

            <View style={styles.partyBalanceBox}>
              <Text style={styles.partyBalanceLabel}>{t("onboarding.slide3SampleBalance")}</Text>
              <Text style={styles.partyBalanceAmount}>{formatNpr(25000)}</Text>
            </View>

            <View style={styles.partyMetricsRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricVal}>{formatNpr(120000)}</Text>
                <Text style={styles.metricLabel}>{isNepali ? "कुल बिक्री" : "Total Sales"}</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={[styles.metricVal, { color: colors.success }]}>{formatNpr(95000)}</Text>
                <Text style={styles.metricLabel}>{isNepali ? "प्राप्त रकम" : "Received"}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.slideTitle}>{t("onboarding.slide3Title")}</Text>
          <Text style={styles.slideSubtitle}>{t("onboarding.slide3Subtitle")}</Text>
          <Text style={styles.slideBody}>{t("onboarding.slide3Body")}</Text>
        </View>

        {/* Slide 4: Real-time Stock & AI Scanner */}
        <View style={[styles.slide, { width }]}>
          {/* Mock Stock & Scan Card */}
          <View style={styles.mockCard}>
            <View style={styles.stockItemRow}>
              <View style={[styles.partyAvatar, { backgroundColor: "#EBFBFA" }]}>
                <Feather name="box" size={22} color={colors.info} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mockCustomer}>{t("onboarding.slide4StockItem")}</Text>
                <View style={styles.stockStatusRow}>
                  <View style={styles.stockDot} />
                  <Text style={styles.stockQtyText}>{t("onboarding.slide4StockQty")}</Text>
                </View>
              </View>
            </View>

            <View style={styles.scanBannerBox}>
              <Feather name="camera" size={18} color={colors.primary} />
              <Text style={styles.scanBannerText}>
                {t("onboarding.slide4ScanBadge")}: {isNepali ? "कागजी बिलबाट स्वचालित विवरण" : "Auto-extract party, PAN & totals"}
              </Text>
            </View>
          </View>

          <Text style={styles.slideTitle}>{t("onboarding.slide4Title")}</Text>
          <Text style={styles.slideSubtitle}>{t("onboarding.slide4Subtitle")}</Text>
          <Text style={styles.slideBody}>{t("onboarding.slide4Body")}</Text>
        </View>

        {/* Slide 5: Finale & Direct Invoice Creator */}
        <View style={[styles.slide, { width }]}>
          <View style={styles.heroVisualWrap}>
            <View style={[styles.iconCircle, { backgroundColor: "#EAFBF3" }]}>
              <Feather name="check" size={44} color={colors.success} />
            </View>
          </View>

          <Text style={styles.slideTitle}>{t("onboarding.slide5Title")}</Text>
          <Text style={styles.slideSubtitle}>{t("onboarding.slide5Subtitle")}</Text>
          <Text style={styles.slideBody}>{t("onboarding.slide5Body")}</Text>

          {/* Ready Checklist */}
          <View style={styles.checklistCard}>
            <View style={styles.checkItem}>
              <Feather name="check-circle" size={16} color={colors.success} />
              <Text style={styles.checkText}>{t("onboarding.slide5Ready1")}</Text>
            </View>
            <View style={styles.checkItem}>
              <Feather name="check-circle" size={16} color={colors.success} />
              <Text style={styles.checkText}>{t("onboarding.slide5Ready2")}</Text>
            </View>
            <View style={styles.checkItem}>
              <Feather name="check-circle" size={16} color={colors.success} />
              <Text style={styles.checkText}>{t("onboarding.slide5Ready3")}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Dots Indicator */}
      <View style={styles.dotsRow}>
        {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
          <TouchableOpacity
            key={i}
            onPress={() => goToSlide(i)}
            style={[styles.dot, i === index && styles.dotActive]}
            hitSlop={8}
          />
        ))}
      </View>

      {/* Bottom Navigation Actions */}
      <View style={styles.bottomBar}>
        {index === TOTAL_SLIDES - 1 ? (
          // Final Slide: Primary "Create Invoice" CTA + Secondary "Dashboard" CTA
          <View style={styles.finalActionsWrap}>
            <TouchableOpacity
              style={styles.primaryInvoiceBtn}
              activeOpacity={0.88}
              onPress={() => handleFinish("invoice")}
              disabled={finishing}
            >
              <Feather name="file-plus" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryInvoiceBtnText}>
                {t("onboarding.createFirstInvoice")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryDashboardBtn}
              activeOpacity={0.8}
              onPress={() => handleFinish("dashboard")}
              disabled={finishing}
            >
              <Text style={styles.secondaryDashboardBtnText}>
                {t("onboarding.exploreDashboard")}
              </Text>
              <Feather name="arrow-right" size={16} color={colors.textMuted} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        ) : (
          // Steps 0 to 3: Back & Next Buttons
          <View style={styles.navRow}>
            {index > 0 ? (
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => goToSlide(index - 1)}
                hitSlop={8}
              >
                <Feather name="arrow-left" size={16} color={colors.textMuted} />
                <Text style={styles.backBtnText}>{t("onboarding.back")}</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 80 }} />
            )}

            <TouchableOpacity
              style={styles.nextBtn}
              activeOpacity={0.88}
              onPress={() => goToSlide(index + 1)}
            >
              <Text style={styles.nextBtnText}>{t("onboarding.next")}</Text>
              <Feather name="arrow-right" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bodyBg,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#2F2F2F",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  brandImage: { width: 58, height: 58 },
  stepBadge: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepBadgeText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  skipText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.textMuted,
  },
  scrollArea: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  heroVisualWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  glowingDot: {
    position: "absolute",
    bottom: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  slideTitle: {
    fontFamily: fonts.bold,
    fontSize: 21,
    color: colors.text,
    textAlign: "center",
    marginBottom: 6,
  },
  slideSubtitle: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.primary,
    textAlign: "center",
    marginBottom: 10,
  },
  slideBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 18,
  },
  featureHighlights: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  highlightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  highlightIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  highlightText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.text,
  },
  mockCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  mockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  mockDocId: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.text,
  },
  mockCustomer: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  paidBadge: {
    backgroundColor: "#EAFBF3",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  paidBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.success,
  },
  mockDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  mockLineItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mockItemName: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.text,
  },
  mockItemQty: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  mockItemAmount: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.text,
  },
  mockTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F8F9FD",
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
  },
  mockTotalLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  mockTotalAmount: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.primary,
  },
  mockActionChips: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  mockChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F3EEFF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  mockChipText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.primary,
  },
  partyHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  partyAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  partySubtitle: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  partyBalanceBox: {
    backgroundColor: "#FFF8F0",
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  partyBalanceLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.warning,
  },
  partyBalanceAmount: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.text,
    marginTop: 2,
  },
  partyMetricsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  metricItem: {
    alignItems: "center",
  },
  metricVal: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.text,
  },
  metricLabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  stockItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stockStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  stockDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  stockQtyText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.success,
  },
  scanBannerBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F3EEFF",
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  scanBannerText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.primary,
    flex: 1,
  },
  checklistCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.text,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E2E6EE",
  },
  dotActive: {
    width: 24,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === "ios" ? 8 : 16,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  backBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.textMuted,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  nextBtnText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: "#FFFFFF",
  },
  finalActionsWrap: {
    gap: 10,
  },
  primaryInvoiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  primaryInvoiceBtnText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: "#FFFFFF",
  },
  secondaryDashboardBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryDashboardBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
  },
});
