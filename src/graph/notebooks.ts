import { paginate } from './client.js';
import type { Notebook } from './types.js';

const NOTEBOOK_SELECT =
  'id,displayName,isDefault,userRole,isShared,createdDateTime,lastModifiedDateTime,links';

export const listNotebooks = (): Promise<Notebook[]> =>
  paginate<Notebook>('/me/onenote/notebooks', {
    query: {
      $select: NOTEBOOK_SELECT,
      $orderby: 'displayName',
    },
  });
