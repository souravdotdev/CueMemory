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

### Tags

**Tag**:
A short topic name a User organises their Items by. Every User has their own Tags, and one Tag can be on many Items.
_Avoid_: Label, category, folder, collection

**Tag source**:
Who put a Tag on a particular Item: CueMemory's AI or the User. The same Tag can come from the AI on one Item and from the User on another.
_Avoid_: AI-generated flag, origin

### Item types

**Item type**:
What form an Item's content takes: Article, Post, Video, Image, Audio, PDF, Code, File, or Link.
_Avoid_: Category, kind

**Article**:
The Item type for a written piece: a page that declares itself an article, or a page on a known publishing site such as Medium, Substack or dev.to. Documentation pages are Articles; a docs landing page is a Link.
_Avoid_: Page, blog, blog post

**Post**:
The Item type for something a person published on a social network: X, Threads, Bluesky, Mastodon, LinkedIn, Facebook, Reddit threads, Instagram posts, GitHub issues, pull requests and discussions, and Stack Overflow questions. Instagram reels and TikToks are Videos.
_Avoid_: Tweet, X post, status

**Video**:
The Item type for something to watch, including YouTube videos, Instagram reels and TikToks.
_Avoid_: Clip, reel

**Image**:
The Item type for a picture, including image files.
_Avoid_: Photo, picture

**Audio**:
The Item type for something to listen to: music, podcasts and audio files, including Spotify, SoundCloud, Apple Podcasts and Bandcamp.
_Avoid_: Podcast, track, song

**PDF**:
The Item type for a PDF document.
_Avoid_: Document, file

**Code**:
The Item type for source code: repositories, files, folders, gists, snippets and sandboxes (GitHub, GitLab, Bitbucket, Gist, CodePen, CodeSandbox, Replit), and package pages on npm or PyPI. Documentation about code is an Article.
_Avoid_: Repo, snippet, project

**File**:
The Item type for a download that isn't a PDF, Image, Video or Audio, such as a `.zip`, `.docx`, `.xlsx` or `.dmg`.
_Avoid_: Download, attachment, document

**Link**:
The Item type for everything else, including homepages, product pages and docs landing pages: anything that isn't recognisably one of the other types.
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

### Resurfacing

**Resurfacing**:
Bringing a forgotten Item back to the User at a moment it's likely to be useful. Cues, Related Items, the Rediscover digest and Reminders are its four forms.
_Avoid_: Recommendation, feed

**Cue**:
A Resurfacing triggered by what the User is doing outside CueMemory, such as a search they typed or a page they're reading.
_Avoid_: Nudge, suggestion, notification, reminder

**Related Items**:
Items similar in meaning to the one the User is looking at inside CueMemory.
_Avoid_: Recommendations, similar posts

**Rediscover digest**:
A periodic email that brings back a few Items the User hasn't looked at in a while.
_Avoid_: Newsletter, summary, recap

**Reminder**:
A Resurfacing at a moment the User chose for an Item.
_Avoid_: Cue, alarm, alert
