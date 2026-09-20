import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { resources } from "./resources.js";
import { toNepaliDigits } from "../lib/nepaliDigits.js";

i18next.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
    format: (value, format, lng) => {
      if (lng?.startsWith("ne")) {
        if (typeof value === "number") {
          return toNepaliDigits(String(value));
        }
        if (typeof value === "string" && /^[0-9]+$/.test(value)) {
          return toNepaliDigits(value);
        }
      }
      return value;
    },
  },
});

export default i18next;
