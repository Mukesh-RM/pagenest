import { APP_LICENSE, LICENSES_FOOTNOTE, LICENSE_ATTRIBUTIONS } from '@/app/legal/licenses-summary';
import { PRIVACY_SECTIONS } from '@/app/legal/privacy-content';

/** Phase 7: dedicated Privacy and Open-source licenses sections in Settings. */
export function LegalSettingsPanel() {
  return (
    <>
      <section className="pn-set-card" aria-labelledby="pn-set-privacy">
        <h2 id="pn-set-privacy" className="pn-set-card__title">
          Privacy
        </h2>
        {PRIVACY_SECTIONS.map((block) => (
          <div key={block.title} className="pn-legal-block">
            <h3 className="pn-legal-block__title">{block.title}</h3>
            <p className="pn-set-card__text">{block.body}</p>
          </div>
        ))}
      </section>

      <section className="pn-set-card" aria-labelledby="pn-set-licenses">
        <h2 id="pn-set-licenses" className="pn-set-card__title">
          Open-source licenses
        </h2>
        <p className="pn-set-card__text">{APP_LICENSE}</p>
        <ul className="pn-legal-list">
          {LICENSE_ATTRIBUTIONS.map((row) => (
            <li key={row.name}>
              <span className="pn-legal-list__name">{row.name}</span>
              <span className="pn-legal-list__license">{row.license}</span>
            </li>
          ))}
        </ul>
        <p className="pn-set-card__text">{LICENSES_FOOTNOTE}</p>
      </section>
    </>
  );
}
