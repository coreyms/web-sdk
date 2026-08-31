import { mergeMessagesMaps, type MessagesMap } from 'utils-shared/i18n';
import { messagesMap as messagesMapUiPixi } from 'components-ui-pixi';
import { messagesMap as messagesMapUiHtml } from 'components-ui-html';

import { stateUrlDerived } from 'state-shared';

import en from './en';
import zh from './zh';

// Only `en` is required by Stake Engine; other languages fall back to the shared UI catalogs.
// Social mode (stake.us) requires English as the ONLY supported language (submission checklist),
// so non-en catalogs are not registered when social=true.
const messagesMapGame = stateUrlDerived.social() ? { en } : { en, zh };

const messagesMap = mergeMessagesMaps([
	messagesMapGame,
	messagesMapUiPixi,
	messagesMapUiHtml,
] as unknown as MessagesMap[]);

export default messagesMap;
