import handler from '../../api/admin-users.js';
import { runNodeHandler } from '../../cf/node-adapter.mjs';

export const onRequest = (context) => runNodeHandler(handler, context);
