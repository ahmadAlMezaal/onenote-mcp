import { paginate } from './client.js';
import type { Notebook } from './types.js';

const NOTEBOOK_SELECT =
  'id,displayName,isDefault,userRole,isShared,createdDateTime,lastModifiedDateTime,links';

export async function listNotebooks(): Promise<Notebook[]> {
  return paginate<Notebook>('/me/onenote/notebooks', {
    query: {
      $select: NOTEBOOK_SELECT,
      $orderby: 'displayName',
    },
  });
}
