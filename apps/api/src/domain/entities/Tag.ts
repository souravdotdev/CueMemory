// Who applied a Tag to an Item: the AI during Processing, or the User.
export const TAG_SOURCES = ["ai", "user"] as const;
export type TagSource = (typeof TAG_SOURCES)[number];

// One of a User's own Tags. The name is always the canonical slug (see slugifyTagName).
export interface Tag {
  id: string;
  userId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

// A Tag attached to an Item, recording who applied it.
export interface TagLink {
  itemId: string;
  tagId: string;
  source: TagSource;
}

// A Tag on an Item: the User's Tag joined with the source recorded on its TagLink.
export interface AppliedTag {
  tag: Tag;
  source: TagSource;
}
