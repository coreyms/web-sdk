import { mergeMessagesMaps, type MessagesMap } from 'utils-shared/i18n';
import { messagesMap as messagesMapUiPixi } from 'components-ui-pixi';
import { messagesMap as messagesMapUiHtml } from 'components-ui-html';

import en from './en';
import zh from './zh';

// Only `en` is required by Stake Engine; other languages fall back to the shared UI catalogs.
const messagesMapGame = { en, zh };

const messagesMap = mergeMessagesMaps([
	messagesMapGame,
	messagesMapUiPixi,
	messagesMapUiHtml,
] as unknown as MessagesMap[]);

export default messagesMap;
