import { mergeMessagesMaps, type MessagesMap } from 'utils-shared/i18n';
import { messagesMap as messagesMapUiPixi } from 'components-ui-pixi';
import { messagesMap as messagesMapUiHtml } from 'components-ui-html';

import en from './en';

// English is the only catalog Angry Mantis ships: the shared UI packages also carry a `zh`
// catalog, but none of this game's own copy is translated, so registering it would advertise a
// language with no game text behind it (and social mode allows English only — submission
// checklist). `?lang=zh` therefore falls back to `en` in LoadI18n like any unknown locale.
const merged = mergeMessagesMaps([{ en }, messagesMapUiPixi, messagesMapUiHtml] as unknown as MessagesMap[]);
const messagesMap = { en: merged.en } as MessagesMap;

export default messagesMap;
