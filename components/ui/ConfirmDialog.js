import { View, Text, StyleSheet, Modal, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import Button from "./Button";
import { colors } from "../../theme/colors";
import { fonts } from "../../theme/typography";

/** Simple Yes/Cancel confirmation modal — delete confirmations, destructive actions. */
export default function ConfirmDialog({ visible, title, message, confirmLabel, cancelLabel, onConfirm, onCancel, destructive = false }) {
  const { t } = useTranslation();
  return (
    <Modal
      visible={!!visible}
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.root} onPress={onCancel} accessibilityLabel={cancelLabel ?? t("common.cancel")}>
        {/* Swallows taps so pressing the card itself never dismisses. */}
        <Pressable style={styles.card} onPress={() => {}}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.actions}>
            <Button label={cancelLabel ?? t("common.cancel")} variant="secondary" onPress={onCancel} style={styles.actionButton} />
            <Button
              label={confirmLabel ?? t("common.confirm")}
              variant={destructive ? "danger" : "primary"}
              onPress={onConfirm}
              style={styles.actionButton}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.scrim },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 20,
    elevation: 20,
  },
  title: { fontFamily: fonts.semiBold, fontSize: 16, color: colors.text, marginBottom: 8 },
  message: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, lineHeight: 20, marginBottom: 22 },
  actions: { flexDirection: "row", gap: 10 },
  actionButton: { flex: 1 },
}); 