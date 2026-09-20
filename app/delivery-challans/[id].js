import GenericDocumentDetailScreen from "../../screens/GenericDocumentDetailScreen";
import { useTranslation } from "react-i18next";

export default function DeliveryChallanDetailRoute() {
  const { t } = useTranslation();
  return (
    <GenericDocumentDetailScreen
      title={t("deliveryChallans.detailTitle", { defaultValue: "Delivery Challan Detail" })}
      endpointPrefix="/api/mobile/delivery-challans"
      editRoutePrefix="/delivery-challans/edit"
      numberKey="challanNumber"
      dateKey="challanDate"
      hasPricing={false}
    />
  );
}