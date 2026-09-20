import CreateDocumentScreen from "../../../screens/CreateDocumentScreen";
import { useTranslation } from "react-i18next";

export default function DeliveryChallanEditRoute() {
  const { t } = useTranslation();
  return (
    <CreateDocumentScreen
      docType="delivery-challans"
      createTitle={t("deliveryChallans.newTitle", { defaultValue: "New Delivery Challan" })}
      editTitle={t("deliveryChallans.editTitle", { defaultValue: "Edit Delivery Challan" })}
      endpoint="/api/mobile/delivery-challans"
      partyTypeFilter="Customer"
      dateFieldProp="challanDate"
      hasPricing={false}
      hasDeliveryToggle={true}
      successRedirectPrefix="/delivery-challans"
    />
  );
}