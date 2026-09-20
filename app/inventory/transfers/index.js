import DocumentListScreen from "../../../screens/DocumentListScreen";
import { useTranslation } from "react-i18next";

export default function InventoryTransfersListRoute() {
  const { t } = useTranslation();
  return (
    <DocumentListScreen
      title={t("inventory.transfersTitle", { defaultValue: "Stock Transfers" })}
      endpoint="/api/mobile/inventory/transfers"
      numberKey="transferNumber"
      dateKey="transferDate"
      partyKey="fromWarehouseName"
      amountKey={null}
      createRoute="/inventory/transfers/new"
      emptyTitle={t("inventory.noTransfers", { defaultValue: "No stock transfers yet" })}
    />
  );
}