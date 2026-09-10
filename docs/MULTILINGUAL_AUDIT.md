# Multilingual Audit

## 22 August 2026

The language selector correctly recognized the `?lang=hi` URL locale and changed its accessible label to Hindi, proving that locale initialization works. However, nearly all current Victim App labels—including SOS activation, voice notes, map preview, conditions, navigation, and safety flow copy—remained in English. The protected Command entry page also retained English title, helper copy, and action labels.

The root cause is incomplete translation coverage for the newer panic-first Victim and protected-access interfaces. Their rendered strings are mostly direct English literals; many are neither translated through `t()` nor represented in the fetched operational language pack. The remote pack is reachable but cannot translate missing entries. The repair must provide local complete phrase coverage for the visible public/protected shells, use a resilient merged translation lookup, and keep the selected locale synchronized in URL and browser storage.

After adding built-in current-interface term coverage and merging it with the remotely hosted operational pack, the Hindi Home check rendered translated SOS activation, connection state, voice-note card, map label, flood-condition heading/statistics, trend control, navigation, and theme-control label. A subsequent direct visit to Tracking without `?lang=hi` retained Hindi from browser storage and rendered its title, storage note, empty-state title, action, and shared navigation in Hindi. A small number of longer descriptive sentences remain English when not yet represented in either translation pack; the core interactive safety workflow is now visibly localized and persists across routes.

Tamil verification confirmed that the language selector, persisted locale, dark-theme control label, Safety title/tagline, shared navigation, and protected Command title/actions switch to Tamil without layout breakage. This proves the repair is not limited to Hindi and that the current-interface terms merge correctly with the existing ten-language base and operational translations.
