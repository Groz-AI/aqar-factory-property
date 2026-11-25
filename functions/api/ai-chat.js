import handler from '../../api/ai-chat.js';
import { runNodeHandler } from '../../cf/node-adapter.mjs';

export const onRequest = (context) => runNodeHandler(handler, context);
