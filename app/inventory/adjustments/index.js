import DocumentListScreen from "../../../screens/DocumentListScreen";
import { useTranslation } from "react-i18next";

export default function StockAdjustmentsListRoute() {
  const { t } = useTranslation();
  return (
    <DocumentListScreen
      title={t("inventory.adjustmentsTitle", { defaultValue: "Stock Adjustments" })}
      endpoint="/api/mobile/inventory/adjustments"
      numberKey="itemName"
      dateKey="createdAt"
      partyKey="warehouseName"
      amountKey={null}
      statusKey={null}
      createRoute="/inventory/adjustments/new"
      emptyTitle={t("inventory.noAdjustments", { defaultValue: "No stock adjustments yet" })}
    />
  );
}