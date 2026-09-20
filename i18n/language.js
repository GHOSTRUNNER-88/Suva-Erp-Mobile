import AsyncStorage from "@react-native-async-storage/async-storage";
import i18next from "./index";

const LANGUAGE_STORAGE_KEY = "suva.language";

/** Call once on app boot — restores the viewer's last-chosen language. */
export async function restoreLanguage() {
  const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === "en" || stored === "ne") {
    await i18next.changeLanguage(stored);
  }
}

export async function setLanguage(language) {
  await i18next.changeLanguage(language);
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
}
