import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useModuleAccess } from "../lib/orgSession";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/AuthProvider";
import AppHeader from "../components/ui/AppHeader";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import BiometricSettingRow from "../components/settings/BiometricSettingRow";

const MY_BUSINESS_ROWS = [
  { key: "sale", module: "sales", title: "Sale", icon: "point-of-sale", href: "/sales", bg: "#EDE9FE", border: "#DDD6FE", color: "#7C3AED" },
  { key: "purchase", module: "purchase", title: "Purchase", icon: "cart-arrow-down", href: "/purchases", bg: "#FEF3C7", border: "#FDE68A", color: "#D97706" },
  { key: "expenses", module: "finance", title: "Expenses", icon: "wallet-outline", href: "/expenses", bg: "#FCE7F3", border: "#FBCFE8", color: "#DB2777" },
  { key: "storeManagement", title: "Store Management", icon: "store-cog-outline", href: "/store/modules", bg: "#F5F3FF", border: "#EDE9FE", color: "#8B5CF6" },
  { key: "wooOrders", module: "woocommerce", title: "My Online Store", icon: "storefront-outline", href: "/store/woocommerce-orders", bg: "#CCFBF1", border: "#99F6E4", color: "#0D9488" },
  { key: "reports", module: "reports", title: "Reports", icon: "file-chart-outline", href: "/reports", bg: "#E0F2FE", border: "#BAE6FD", color: "#0284C7" },
];

const SALES_DOCS_ROWS = [
  { key: "salesOrders", module: "sales", title: "Sales Orders", icon: "clipboard-text-outline", href: "/sales-orders", bg: "#EDE9FE", border: "#DDD6FE", color: "#7C3AED" },
  { key: "salesQuotations", module: "sales", title: "Sales Quotations", icon: "file-document-edit-outline", href: "/sales-quotations", bg: "#E0F2FE", border: "#BAE6FD", color: "#0284C7" },
  { key: "deliveryChallans", module: "sales", title: "Delivery Challans", icon: "truck-delivery-outline", href: "/delivery-challans", bg: "#CCFBF1", border: "#99F6E4", color: "#0D9488" },
  { key: "creditNotes", module: "sales", title: "Credit Notes", icon: "file-undo-outline", href: "/credit-notes", bg: "#DCFCE7", border: "#BBF7D0", color: "#16A34A" },
];

const PURCHASE_DOCS_ROWS = [
  { key: "purchaseOrders", module: "purchase", title: "Purchase Orders", icon: "clipboard-plus-outline", href: "/purchase-orders", bg: "#FEF3C7", border: "#FDE68A", color: "#D97706" },
  { key: "debitNotes", module: "purchase", title: "Debit Notes", icon: "file-replace-outline", href: "/debit-notes", bg: "#FFE4E6", border: "#FECDD3", color: "#E11D48" },
];

const INVENTORY_ROWS = [
  { key: "stockAdjustments", module: "items", title: "Stock Adjustments", icon: "tune-vertical-variant", href: "/inventory/adjustments", bg: "#F3E8FF", border: "#E9D5FF", color: "#9333EA" },
  { key: "stockTransfers", module: "items", title: "Stock Transfers", icon: "swap-horizontal-bold", href: "/inventory/transfers", bg: "#E0F2FE", border: "#BAE6FD", color: "#0284C7" },
];

const FINANCE_ROWS = [
  { key: "bankAccounts", module: "cashBank", title: "Bank Accounts", icon: "bank-outline", href: "/bank-accounts", bg: "#E0F2FE", border: "#BAE6FD", color: "#0284C7" },
  { key: "paymentIn", module: "finance", title: "Payment In", icon: "cash-plus", href: "/payments?type=in", bg: "#DCFCE7", border: "#BBF7D0", color: "#16A34A" },
  { key: "paymentOut", module: "finance", title: "Payment Out", icon: "cash-minus", href: "/payments?type=out", bg: "#FFE4E6", border: "#FECDD3", color: "#E11D48" },
  { key: "cheques", module: "finance", title: "Cheques Register", icon: "checkbook", href: "/cheques", bg: "#FEF3C7", border: "#FDE68A", color: "#D97706" },
  { key: "cashTransfers", module: "cashBank", title: "Cash Transfers", icon: "bank-transfer", href: "/cash-transfers", bg: "#EDE9FE", border: "#DDD6FE", color: "#7C3AED" },
];

  const PARTIES_EXTRA_ROWS = [
  { key: "partyDues", module: "parties", title: "Party Dues & Receivables", icon: "account-clock-outline", href: "/parties/dues", bg: "#FEF3C7", border: "#FDE68A", color: "#D97706" },
  { key: "partiesList", module: "parties", title: "All Parties", icon: "account-group-outline", href: "/parties", bg: "#E0F2FE", border: "#BAE6FD", color: "#0284C7" },
  { key: "partyGroups", module: "parties", title: "Party Groups", icon: "folder-account-outline", href: "/party-groups", bg: "#F5F3FF", border: "#EDE9FE", color: "#8B5CF6" },
];

const CRM_ROWS = [
  { key: "deals", module: "crm", title: "Deals & CRM", icon: "handshake-outline", href: "/deals", bg: "#CCFBF1", border: "#99F6E4", color: "#0D9488" },
];

const B2B_ROWS = [
  { key: "b2bOrders", module: "b2b-portal", title: "B2B Orders", icon: "store-outline", href: "/coming-soon?title=B2B+Orders", bg: "#EDE9FE", border: "#DDD6FE", color: "#7C3AED" },
  { key: "b2bStockControl", module: "b2b-portal", title: "B2B Stock Control", icon: "cube-send", href: "/coming-soon?title=B2B+Stock+Control", bg: "#CCFBF1", border: "#99F6E4", color: "#0D9488" },
  { key: "b2bPaymentVerifications", module: "b2b-portal", title: "Payment Verifications", icon: "check-decagram-outline", href: "/coming-soon?title=Payment+Verifications", bg: "#DCFCE7", border: "#BBF7D0", color: "#16A34A" },
];

const WHATSAPP_ROWS = [
  { key: "whatsappConnection", module: "whatsapp", title: "WhatsApp Connection", icon: "whatsapp", href: "/coming-soon?title=WhatsApp+Connection", bg: "#DCFCE7", border: "#BBF7D0", color: "#25D366" },
  { key: "whatsappTemplates", module: "whatsapp", title: "WhatsApp Templates", icon: "message-text-outline", href: "/coming-soon?title=WhatsApp+Templates", bg: "#E0F2FE", border: "#BAE6FD", color: "#0284C7" },
  { key: "whatsappHistory", module: "whatsapp", title: "Message History", icon: "history", href: "/coming-soon?title=WhatsApp+History", bg: "#FEF3C7", border: "#FDE68A", color: "#D97706" },
];

const PAYROLL_ROWS = [
  { key: "payrollDashboard", module: "payroll", title: "Dashboard", icon: "account-cash-outline", href: "/payroll", bg: "#EDE9FE", border: "#DDD6FE", color: "#7C3AED" },
  { key: "payrollEmployees", module: "payroll", title: "Employees", icon: "account-group-outline", href: "/payroll/employees", bg: "#E0F2FE", border: "#BAE6FD", color: "#0284C7" },
  { key: "payrollAttendance", module: "payroll", title: "Attendance", icon: "calendar-check-outline", href: "/payroll/attendance", bg: "#DCFCE7", border: "#BBF7D0", color: "#16A34A" },
  { key: "payrollSalaryLetters", module: "payroll", title: "Salary Letters", icon: "file-certificate-outline", href: "/payroll/salary-letters", bg: "#FEF3C7", border: "#FDE68A", color: "#D97706" },
  { key: "payrollReports", module: "payroll", title: "Payroll Reports", icon: "chart-box-outline", href: "/payroll/reports", bg: "#FCE7F3", border: "#FBCFE8", color: "#DB2777" },
];

const OFFLINE_ROWS = [
  { key: "offlineManager", title: "Offline Data", icon: "cloud-download-outline", href: "/offline-manager", bg: "#E0F2FE", border: "#BAE6FD", color: "#0284C7" },
];

function RowIconChip({ icon, bg, border, color, size = 20 }) {
  return (
    <View style={[styles.rowIconChip, { backgroundColor: bg, borderColor: border || color + "30" }]}>
      <MaterialCommunityIcons name={icon} size={size} color={color} />
    </View>
  );
}

export default function MenuScreen() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const canSee = useModuleAccess();

  // Hide rows for modules this organization/user can't see (same rule as
  // the desktop sidebar), and a whole section when none of its rows remain.
  function renderSection(title, rows) {
    const visible = rows.filter((row) => canSee(row.module));
    if (visible.length === 0) return null;
    return (
      <>
        <Text style={styles.sectionTitle}>{title}</Text>
        {renderRowGroup(visible)}
      </>
    );
  }

  function renderRowGroup(items) {
    return (
      <View style={styles.card}>
        {items.map((row, index) => (
          <TouchableOpacity
            key={row.key}
            style={[styles.row, index < items.length - 1 && styles.rowDivider]}
            activeOpacity={0.75}
            onPress={() => router.push(row.href)}
          >
            <RowIconChip icon={row.icon} bg={row.bg} border={row.border} color={row.color} />
            <Text style={styles.rowLabel}>
              {row.title ? t(`menu.${row.key}`, { defaultValue: row.title }) : t(`menu.${row.key}`)}
            </Text>
            {row.isNew ? (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>New</Text>
              </View>
            ) : null}
            <Feather name="chevron-right" size={18} color={colors.iconMuted} />
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <AppHeader title={t("nav.menu", "Menu")} />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Navy Alert Banner matching Screenshot 6 */}
        <View style={styles.navyAlertCard}>
          <View style={styles.alertHeaderRow}>
            <Text style={styles.alertTitle}>Business ERP Cloud 📣</Text>
          </View>
          <Text style={styles.alertSubtitle}>
            Your multi-company ERP database is active and synced in real-time with desktop.
          </Text>
          <TouchableOpacity
            style={styles.alertButton}
            activeOpacity={0.85}
            onPress={() => router.push("/business-profile")}
          >
            <Text style={styles.alertButtonText}>Manage Plan</Text>
          </TouchableOpacity>
        </View>

        {/* Profile shortcuts */}
        <View style={styles.card}>
          <TouchableOpacity
            style={[styles.row, styles.rowDivider]}
            activeOpacity={0.75}
            onPress={() => router.push("/organization-settings")}
          >
            <RowIconChip icon="domain" bg="#E0F2FE" border="#BAE6FD" color="#0284C7" />
            <Text style={styles.rowLabel}>{t("businessProfile.orgSettingsTitle", "Organization Settings")}</Text>
            <Feather name="chevron-right" size={18} color={colors.iconMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.75}
            onPress={() => router.push("/profile")}
          >
            <RowIconChip icon="account-cog-outline" bg="#EDE9FE" border="#DDD6FE" color="#6366F1" />
            <Text style={styles.rowLabel}>{t("profile.title", "User Settings & Language")}</Text>
            <Feather name="chevron-right" size={18} color={colors.iconMuted} />
          </TouchableOpacity>
        </View>

        {/* Security / Biometric Setting */}
        <BiometricSettingRow />

        {renderSection(t("menu.myBusiness", "My Business"), MY_BUSINESS_ROWS)}

        {renderSection(t("menu.salesDocs", { defaultValue: "Sales Orders & Quotations" }), SALES_DOCS_ROWS)}

        {renderSection(t("menu.purchaseDocs", { defaultValue: "Purchase Orders & Notes" }), PURCHASE_DOCS_ROWS)}

        {renderSection(t("menu.inventory", { defaultValue: "Inventory Management" }), INVENTORY_ROWS)}

        {renderSection(t("menu.cashBank", "Cash & Bank"), FINANCE_ROWS)}

        {renderSection(t("menu.partiesManagement", { defaultValue: "Parties & Dues" }), PARTIES_EXTRA_ROWS)}

        {renderSection(t("menu.crm", { defaultValue: "Business / CRM" }), CRM_ROWS)}

        {renderSection(t("menu.b2bPortal", { defaultValue: "B2B Portal" }), B2B_ROWS)}

        {renderSection(t("menu.whatsapp", { defaultValue: "WhatsApp" }), WHATSAPP_ROWS)}

        {renderSection(t("menu.payroll", { defaultValue: "Payroll (पेरोल)" }), PAYROLL_ROWS)}

        {renderSection(t("menu.offline", { defaultValue: "Offline" }), OFFLINE_ROWS)}

        <TouchableOpacity
          style={styles.logoutRow}
          activeOpacity={0.8}
          onPress={logout}
          accessibilityRole="button"
          accessibilityLabel={t("common.logOut")}
        >
          <RowIconChip icon="logout-variant" bg="#FFE4E6" border="#FECDD3" color="#EF4444" />
          <Text style={styles.logoutLabel}>{t("common.logOut", "Log Out")}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bodyBg },
  scrollContent: { padding: 16 },

  navyAlertCard: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  alertHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  alertTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: "#FFFFFF",
  },
  alertSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: "#94A3B8",
    lineHeight: 18,
    marginBottom: 14,
  },
  alertButton: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  alertButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: "#0F172A",
  },

  sectionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
    marginBottom: 8,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  rowIconChip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.text,
  },
  newBadge: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 4,
  },
  newBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    color: "#FFFFFF",
  },

  logoutRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
    marginTop: 8,
    marginBottom: 16,
  },
  logoutLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.danger,
  },
});
