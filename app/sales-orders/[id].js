import GenericDocumentDetailScreen from "../../screens/GenericDocumentDetailScreen";
import { useTranslation } from "react-i18next";

export default function SalesOrderDetailRoute() {
  const { t } = useTranslation();
  return (
    <GenericDocumentDetailScreen
      title={t("salesOrders.detailTitle", { defaultValue: "Sales Order Detail" })}
      endpointPrefix="/api/mobile/sales-orders"
      editRoutePrefix="/sales-orders/edit"
      numberKey="orderNumber"
      dateKey="orderDate"
      hasPricing={true}
    />
  );
}