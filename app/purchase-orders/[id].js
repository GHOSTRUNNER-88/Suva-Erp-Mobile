import GenericDocumentDetailScreen from "../../screens/GenericDocumentDetailScreen";
import { useTranslation } from "react-i18next";

export default function PurchaseOrderDetailRoute() {
  const { t } = useTranslation();
  return (
    <GenericDocumentDetailScreen
      title={t("purchaseOrders.detailTitle", { defaultValue: "Purchase Order Detail" })}
      endpointPrefix="/api/mobile/purchase-orders"
      editRoutePrefix="/purchase-orders/edit"
      numberKey="orderNumber"
      dateKey="orderDate"
      hasPricing={true}
    />
  );
}