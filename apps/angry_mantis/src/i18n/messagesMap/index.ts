import { mergeMessagesMaps, type MessagesMap } from 'utils-shared/i18n';
import { messagesMap as messagesMapUiPixi } from 'components-ui-pixi';
import { messagesMap as messagesMapUiHtml } from 'components-ui-html';


import en from './en';
import zh from './zh';
import { IS_SOCIAL } from '../../game/social';

// Only `en` is required by Stake Engine; other languages fall back to the shared UI catalogs.
// Social mode (stake.us) requires English as the ONLY supported language (submission checklist),
// so non-en catalogs are not registered when social=true.
// IS_SOCIAL, not stateUrlDerived.social(): this runs at module scope, before the page store is
// populated, where the derived reads the wrong answer (see game/social.ts)
const messagesMapGame = IS_SOCIAL ? { en } : { en, zh };

const messagesMap = mergeMessagesMaps([
	messagesMapGame,
	messagesMapUiPixi,
	messagesMapUiHtml,
] as unknown as MessagesMap[]);

export default messagesMap;
