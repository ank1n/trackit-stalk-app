import * as SecureStore from "expo-secure-store";

const CARD_SETTINGS_KEY = "trackit_card_settings";

export type CardDisplaySettings = {
  showLabels: boolean;
  showPriority: boolean;
  showAssignees: boolean;
  showDueDate: boolean;
  showId: boolean;
  showAttachments: boolean;
  showCoverImage: boolean;
};

const DEFAULTS: CardDisplaySettings = {
  showLabels: true,
  showPriority: true,
  showAssignees: true,
  showDueDate: true,
  showId: true,
  showAttachments: true,
  showCoverImage: true,
};

export async function getCardSettings(): Promise<CardDisplaySettings> {
  try {
    const raw = await SecureStore.getItemAsync(CARD_SETTINGS_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULTS;
}

export async function saveCardSettings(settings: CardDisplaySettings): Promise<void> {
  await SecureStore.setItemAsync(CARD_SETTINGS_KEY, JSON.stringify(settings));
}
