import { updateHomeLanguagePreferenceAction } from './actions';
import {
  SUPPORTED_LANGUAGES,
  getTranslations,
  type AppLanguage,
} from '@/modules/i18n';

type HomeLanguageSwitchProps = {
  currentLanguage: AppLanguage;
  spaceId: string;
};

export function HomeLanguageSwitch({
  currentLanguage,
  spaceId,
}: HomeLanguageSwitchProps) {
  const t = getTranslations(currentLanguage);

  return (
    <div
      className="settings-language-compact home-language-switch"
      aria-label={t.languageSwitcher.label}
    >
      {SUPPORTED_LANGUAGES.map((language) => (
        <form
          key={language}
          action={updateHomeLanguagePreferenceAction}
          className="settings-language-compact-form"
        >
          <input name="preferredLanguage" type="hidden" value={language} />
          <input name="spaceId" type="hidden" value={spaceId} />
          <button
            className={
              currentLanguage === language
                ? 'settings-language-compact-button settings-language-compact-button-active'
                : 'settings-language-compact-button'
            }
            type="submit"
          >
            {t.languageSwitcher[language]}
          </button>
        </form>
      ))}
    </div>
  );
}
