import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { formatNpr, formatNumber } from "../../lib/format";
import { colors } from "../../theme/colors";
import { fonts } from "../../theme/typography";
import { usePressScale, useFadeInUp } from "../../lib/useFadeInUp";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function TransactionCard({
  partyName,
  documentNumber,
  documentDate,
  badgeText = "SALE",
  badgeTone = "success", // success, info, danger, warning
  totalAmount,
  balanceAmount,
  onPress,
  onPrint,
  onShare,
  onMore,
  delay = 0,
}) {
  const { t } = useTranslation();
  const press = usePressScale();
  const enterAnimation = useFadeInUp(delay);

  const badgeBg =
    badgeTone === "success"
      ? colors.successLight
      : badgeTone === "info"
      ? colors.infoLight
      : badgeTone === "danger"
      ? colors.dangerLight
      : colors.warningLight;

  const badgeColor =
    badgeTone === "success"
      ? colors.success
      : badgeTone === "info"
      ? colors.info
      : badgeTone === "danger"
      ? colors.danger
      : colors.warning;

  return (
    <AnimatedTouchable
      style={[styles.card, enterAnimation, press.style]}
      activeOpacity={0.88}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={`${partyName ?? ""} ${documentNumber ?? ""}`.trim()}
    >
      <View style={styles.topRow}>
        <View style={styles.partyAndBadge}>
          <Text style={styles.partyName} numberOfLines={1}>
            {partyName || t("common.unspecified", "Cash Sale")}
          </Text>
          {badgeText ? (
            <View style={[styles.badge, { backgroundColor: badgeBg }]}>
              <Text style={[styles.badgeText, { color: badgeColor }]}>
                {badgeText.toUpperCase()}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.metaRight}>
          {documentNumber ? (
            <Text style={styles.docNumber} numberOfLines={1}>
              #{formatNumber(documentNumber)}
            </Text>
          ) : null}
          {documentDate ? (
            <Text style={styles.docDate}>{formatNumber(documentDate)}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.amountsAndActions}>
        <View style={styles.amountsCol}>
          <View style={styles.amountPair}>
            <Text style={styles.amountLabel}>{t("sale.total", "Total")}</Text>
            <Text style={styles.amountValue}>{formatNpr(totalAmount)}</Text>
          </View>
          {balanceAmount !== undefined && balanceAmount !== null ? (
            <View style={styles.amountPair}>
              <Text style={styles.amountLabel}>{t("sale.balance", "Balance")}</Text>
              <Text
                style={[
                  styles.amountValue,
                  Number(balanceAmount) > 0 ? styles.balanceDue : null,
                ]}
              >
                {formatNpr(balanceAmount)}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.actionButtons}>
          {onPrint ? (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={onPrint}
              hitSlop={8}
            >
              <Feather name="printer" size={17} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
          {onShare ? (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={onShare}
              hitSlop={8}
            >
              <Feather name="share-2" size={17} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
          {onMore ? (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={onMore}
              hitSlop={8}
            >
              <Feather name="more-vertical" size={17} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 8,
  },
  partyAndBadge: {
    flex: 1,
    gap: 6,
  },
  partyName: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.text,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  metaRight: {
    alignItems: "flex-end",
  },
  docNumber: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 2,
  },
  docDate: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textSubtle,
  },
  amountsAndActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  amountsCol: {
    flexDirection: "row",
    gap: 24,
  },
  amountPair: {
    gap: 2,
  },
  amountLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textMuted,
  },
  amountValue: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  balanceDue: {
    color: colors.danger,
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.light,
  },
});
