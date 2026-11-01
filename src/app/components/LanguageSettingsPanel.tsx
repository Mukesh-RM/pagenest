import { SUPPORTED_UI_LOCALES, uiLocaleLabel } from '@/app/i18n/locales';

/** Phase 7: localization entry point (English UI today; structure ready for more locales). */
export function LanguageSettingsPanel() {
  const active = SUPPORTED_UI_LOCALES[0];
  return (
    <section className="pn-set-card" aria-labelledby="pn-set-language">
      <h2 id="pn-set-language" className="pn-set-card__title">
        Language
      </h2>
      <p className="pn-set-card__text">
        InkQuiet&apos;s interface is in {uiLocaleLabel(active)}. More languages will ship as community translations are reviewed.
      </p>
      <p className="pn-set-card__text pn-set-card__muted">
        Your books keep their own language. Dictionary and read-aloud voices follow the book or the voice you pick.
      </p>
    </section>
  );
}
