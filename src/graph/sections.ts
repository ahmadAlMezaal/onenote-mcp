import { graphRequest, paginate } from './client.js';
import type { Section } from './types.js';

const SECTION_SELECT =
  'id,displayName,isDefault,createdDateTime,lastModifiedDateTime,parentNotebook,parentSectionGroup,links';

const SECTION_EXPAND = 'parentNotebook($select=id,displayName)';

export const listSections = (notebookId?: string): Promise<Section[]> => {
  const path = notebookId
    ? `/me/onenote/notebooks/${encodeURIComponent(notebookId)}/sections`
    : '/me/onenote/sections';
  return paginate<Section>(path, {
    query: {
      $select: SECTION_SELECT,
      $expand: SECTION_EXPAND,
      $orderby: 'displayName',
    },
  });
};

export const createSection = (notebookId: string, name: string): Promise<Section> =>
  graphRequest<Section>(
    `/me/onenote/notebooks/${encodeURIComponent(notebookId)}/sections`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: name }),
      // Without these, the POST response omits parentNotebook and the tool's
      // summary would show undefined for the section's parent notebook name.
      query: { $select: SECTION_SELECT, $expand: SECTION_EXPAND },
    },
  );
