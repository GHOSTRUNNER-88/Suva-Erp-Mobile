import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Svg, { G, Rect, Line, Text as SvgText } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import { formatNpr, toNepaliDigits } from "../lib/format";

function formatCompactValue(val, isNepali) {
  if (!val || val <= 0) return "";
  if (val >= 10000000) {
    const v = (val / 10000000).toFixed(1).replace(/\.0$/, "");
    return isNepali ? `${toNepaliDigits(v)}क` : `${v}Cr`;
  }
  if (val >= 100000) {
    const v = (val / 100000).toFixed(1).replace(/\.0$/, "");
    return isNepali ? `${toNepaliDigits(v)}ला` : `${v}L`;
  }
  if (val >= 1000) {
    const v = (val / 1000).toFixed(1).replace(/\.0$/, "");
    return isNepali ? `${toNepaliDigits(v)}ह` : `${v}k`;
  }
  return isNepali ? toNepaliDigits(String(Math.round(val))) : String(Math.round(val));
}

/**
 * Sales vs Purchases, the mobile counterpart of desktop's dashboard chart
 * (dashboard-view.tsx's ApexCharts bar series). Same data, same two series,
 * same two colours — desktop passes `colors: [COLOR_PRIMARY, COLOR_WARNING]`.
 *
 * Enhanced with:
 * - Direct point data values formatted compactly on top of each bar
 * - Subtle grid guide lines at 33%, 66%, and 100% scale
 * - Interactive tap selection showing highlighted point breakdown
 * - Polished summary legend displaying series totals
 */
export default function TrendChart({ points, height = 180 }) {
  const { t, i18n } = useTranslation();
  const [width, setWidth] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const isNepali = (i18n.language || "").toLowerCase().startsWith("ne");

  if (!points?.length) {
    return <Text style={styles.empty}>{t("dashboard.noTrendData", "No trend data available")}</Text>;
  }

  const totalSales = points.reduce((sum, p) => sum + (Number(p.sales) || 0), 0);
  const totalPurchases = points.reduce((sum, p) => sum + (Number(p.purchases) || 0), 0);

  const rawPeak = Math.max(1, ...points.flatMap((p) => [Number(p.sales) || 0, Number(p.purchases) || 0]));
  // Add 15% headroom for data value labels
  const peak = rawPeak * 1.18;

  const topPadding = 22;
  const bottomPadding = 4;
  const chartHeight = height - topPadding - bottomPadding;
  const slot = width / points.length;
  const barWidth = Math.max(4, Math.min(15, (slot - 10) / 2));

  const activePoint = selectedIndex !== null && points[selectedIndex] ? points[selectedIndex] : null;

  return (
    <View style={styles.container}>
      {/* Legend with Totals */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
          <Text style={styles.legendText}>
            {t("dashboard.sales", "Sales")}:{" "}
            <Text style={styles.legendBold}>{formatNpr(totalSales)}</Text>
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
          <Text style={styles.legendText}>
            {t("dashboard.purchases", "Purchases")}:{" "}
            <Text style={styles.legendBold}>{formatNpr(totalPurchases)}</Text>
          </Text>
        </View>
      </View>

      {/* Interactive Selection Highlight Banner */}
      {activePoint ? (
        <View style={styles.highlightBanner}>
          <Text style={styles.highlightMonth}>
            {isNepali ? activePoint.labelNe : activePoint.labelEn}:
          </Text>
          <View style={styles.highlightValuesRow}>
            <Text style={[styles.highlightVal, { color: colors.primary }]}>
              {t("dashboard.sales", "Sales")}: {formatNpr(activePoint.sales)}
            </Text>
            <Text style={styles.highlightDot}>•</Text>
            <Text style={[styles.highlightVal, { color: colors.warning }]}>
              {t("dashboard.purchases", "Purchases")}: {formatNpr(activePoint.purchases)}
            </Text>
          </View>
        </View>
      ) : null}

      {/* SVG Chart Area */}
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {/* Grid Guide Lines */}
            {[0.33, 0.66, 1].map((ratio) => {
              const y = topPadding + chartHeight * (1 - ratio);
              return (
                <Line
                  key={`grid-${ratio}`}
                  x1={0}
                  y1={y}
                  x2={width}
                  y2={y}
                  stroke={colors.borderLight}
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
              );
            })}

            {/* Baseline */}
            <Line
              x1={0}
              y1={topPadding + chartHeight}
              x2={width}
              y2={topPadding + chartHeight}
              stroke={colors.border}
              strokeWidth={1}
            />

            {/* Bars and Data Labels */}
            {points.map((point, index) => {
              const sales = Number(point.sales) || 0;
              const purchases = Number(point.purchases) || 0;
              const salesHeight = Math.max(2, (sales / peak) * chartHeight);
              const purchaseHeight = Math.max(2, (purchases / peak) * chartHeight);
              const left = index * slot + (slot - barWidth * 2 - 3) / 2;
              const isSelected = selectedIndex === index;

              const salesY = topPadding + chartHeight - salesHeight;
              const purchaseY = topPadding + chartHeight - purchaseHeight;

              return (
                <G key={`${point.labelEn}-${index}`}>
                  {/* Highlight Column Backdrop when selected */}
                  {isSelected ? (
                    <Rect
                      x={index * slot + 2}
                      y={topPadding - 4}
                      width={slot - 4}
                      height={chartHeight + 8}
                      rx={6}
                      fill={colors.light}
                      opacity={0.7}
                    />
                  ) : null}

                  {/* Sales Bar */}
                  <Rect
                    x={left}
                    y={salesY}
                    width={barWidth}
                    height={salesHeight}
                    rx={3}
                    fill={colors.primary}
                    opacity={isSelected || selectedIndex === null ? 1 : 0.6}
                  />

                  {/* Sales Value Label */}
                  {sales > 0 && (
                    <SvgText
                      x={left + barWidth / 2}
                      y={Math.max(12, salesY - 3)}
                      textAnchor="middle"
                      fontSize={8}
                      fontWeight="600"
                      fill={colors.primary}
                    >
                      {formatCompactValue(sales, isNepali)}
                    </SvgText>
                  )}

                  {/* Purchases Bar */}
                  <Rect
                    x={left + barWidth + 3}
                    y={purchaseY}
                    width={barWidth}
                    height={purchaseHeight}
                    rx={3}
                    fill={colors.warning}
                    opacity={isSelected || selectedIndex === null ? 1 : 0.6}
                  />

                  {/* Purchases Value Label */}
                  {purchases > 0 && (
                    <SvgText
                      x={left + barWidth + 3 + barWidth / 2}
                      y={Math.max(12, purchaseY - 3)}
                      textAnchor="middle"
                      fontSize={8}
                      fontWeight="600"
                      fill={colors.warning}
                    >
                      {formatCompactValue(purchases, isNepali)}
                    </SvgText>
                  )}
                </G>
              );
            })}
          </Svg>
        ) : (
          <View style={{ height }} />
        )}
      </View>

      {/* Clickable Month Axis Labels */}
      <View style={styles.axisRow}>
        {points.map((point, index) => {
          const isSelected = selectedIndex === index;
          return (
            <TouchableOpacity
              key={`${point.labelEn}-${index}-label`}
              style={[styles.axisCol, isSelected && styles.axisColSelected]}
              onPress={() => setSelectedIndex(selectedIndex === index ? null : index)}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.axisLabel, isSelected && styles.axisLabelSelected]}
                numberOfLines={1}
              >
                {isNepali ? point.labelNe : point.labelEn}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 2,
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    flexWrap: "wrap",
    gap: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textMuted,
  },
  legendBold: {
    fontFamily: fonts.semiBold,
    color: colors.text,
  },
  highlightBanner: {
    backgroundColor: colors.cardBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 4,
  },
  highlightMonth: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.text,
  },
  highlightValuesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  highlightVal: {
    fontFamily: fonts.medium,
    fontSize: 11,
  },
  highlightDot: {
    color: colors.textSubtle,
    fontSize: 10,
  },
  axisRow: {
    flexDirection: "row",
    marginTop: 6,
  },
  axisCol: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
    borderRadius: 6,
  },
  axisColSelected: {
    backgroundColor: colors.light,
  },
  axisLabel: {
    textAlign: "center",
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.textMuted,
  },
  axisLabelSelected: {
    color: colors.primary,
    fontFamily: fonts.semiBold,
  },
  empty: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    paddingVertical: 12,
  },
});
