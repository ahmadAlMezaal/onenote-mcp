import { paginate } from './client.js';
import type { Section } from './types.js';

const SECTION_SELECT =
  'id,displayName,isDefault,createdDateTime,lastModifiedDateTime,parentNotebook,parentSectionGroup,links';

export const listSections = (notebookId?: string): Promise<Section[]> => {
  const path = notebookId
    ? `/me/onenote/notebooks/${encodeURIComponent(notebookId)}/sections`
    : '/me/onenote/sections';
  return paginate<Section>(path, {
    query: {
      $select: SECTION_SELECT,
      $expand: 'parentNotebook($select=id,displayName)',
      $orderby: 'displayName',
    },
  });
};
