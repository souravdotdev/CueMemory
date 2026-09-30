# Items

What Users save into CueMemory and how CueMemory makes sense of it.

## Language

### Items

**Item**:
A link a User saved into CueMemory, together with what CueMemory learned about it.
_Avoid_: Bookmark, save, entry, note

**Source URL**:
The address the User pasted to create an Item.
_Avoid_: Link, original URL

**Thumbnail**:
The preview image CueMemory keeps for an Item.
_Avoid_: Cover, preview image, OG image

### Item types

**Item type**:
What kind of thing an Item is: Article, Tweet, Video, Image, PDF, or Link.
_Avoid_: Category, kind

**Link**:
The Item type for anything that isn't recognisably one of the other types.
_Avoid_: Other, generic, unknown

### Processing

**Processing**:
The work CueMemory does after an Item is saved to learn its type, title, description, thumbnail, and text.
_Avoid_: Ingestion, enrichment, parsing

**Ready**:
An Item whose processing finished, so its content is available.
_Avoid_: Success, done, processed

**Failed**:
An Item whose processing gave up. The User can retry it.
_Avoid_: Error, broken
