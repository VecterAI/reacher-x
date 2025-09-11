# Composer Components System

A comprehensive, composable composer system for X-like applications built with React, TypeScript, and Lexical editor.

## Architecture Overview

The composer system follows a **primitive-first, composable architecture** inspired by shadcn/ui and Radix UI. It's designed to be:

- **Highly reusable**: Core primitives can be combined in various ways
- **Type-safe**: Full TypeScript support with comprehensive type definitions
- **Customizable**: Configurable through props and theme system
- **Accessible**: Built with accessibility best practices
- **Extensible**: Easy to add new features and composer types

## Component Hierarchy

```
BaseComposer (Foundation)
├── ComposerEditor (Lexical integration)
├── ComposerToolbar (Formatting controls)
├── MediaUploadSection (File handling)
└── User-specific composers
    ├── ReplyComposer (Reply to tweets)
    └── NoteComposer (Add notes)
```

## Core Components

### BaseComposer

The foundational composer component that provides:

- Rich text editing with Lexical
- Media upload with progress tracking
- Character counting
- Toolbar with formatting options
- User avatar and info display

### ReplyComposer

Specialized composer for replying to tweets:

- Shows reply context ("Replying to @user1, @user2")
- Inherits all BaseComposer functionality
- Submit button labeled "Reply"

### NoteComposer

Specialized composer for adding notes:

- Shows note identifier ("Note #1")
- Inherits all BaseComposer functionality
- Submit button labeled "Add"

## Features

### Rich Text Editor

- **Lexical Integration**: Powered by Facebook's Lexical editor
- **Formatting**: Bold, italic, and more (extensible)
- **Character Count**: Real-time counting with X's 280 limit
- **Auto-save**: Content persistence (configurable)

### Media Upload

- **Multi-file Support**: Upload multiple images/videos
- **Progress Tracking**: Real-time upload progress
- **Preview**: Image/video preview with remove option
- **Descriptions**: Add alt text to media
- **Error Handling**: Graceful error states

### Toolbar

- **Formatting Controls**: Bold, italic buttons
- **Media Upload**: Image and video upload buttons
- **Emoji Picker**: Integrated Frimousse emoji picker
- **GIF Support**: GIF upload button
- **Extensible**: Easy to add new toolbar items

### Emoji Integration

- **Frimousse**: Lightweight, composable emoji picker
- **Search**: Find emojis quickly
- **Categories**: Organized emoji categories
- **Customizable**: Styled to match your theme

## Usage Examples

### Basic Composer

```tsx
import { BaseComposer } from "@/features/composer/ui/components";

<BaseComposer
  currentUser={{
    name: "John Doe",
    screenName: "johndoe",
    profileImageUrl: "/avatar.jpg",
  }}
  placeholder="What's happening?"
  onSubmit={handleSubmit}
  onCancel={handleCancel}
/>;
```

### Reply Composer

```tsx
import { ReplyComposer } from "@/features/composer/ui/components";

<ReplyComposer
  replyTo={{
    tweet: tweetData,
    users: [
      { screenName: "user1", name: "User One" },
      { screenName: "user2", name: "User Two" },
    ],
  }}
  currentUser={currentUser}
  onSubmit={handleReply}
/>;
```

### Note Composer

```tsx
import { NoteComposer } from "@/features/composer/ui/components";

<NoteComposer noteId="1" currentUser={currentUser} onSubmit={handleNoteAdd} />;
```

## Configuration

### Toolbar Configuration

```tsx
const toolbarConfig = {
  showBold: true,
  showItalic: true,
  showEmoji: true,
  showMedia: true,
  showGif: true,
  showLink: true,
  showHashtag: true,
  showMention: true,
};
```

### Editor Plugin Configuration

```tsx
const pluginConfig = {
  maxLength: 280,
  showCharacterCount: true,
  enableAutoEmbed: true,
  enableDragDrop: true,
  enableEmoji: true,
  enableHashtag: true,
  enableMention: true,
  enableLink: true,
  enableAutocomplete: true,
  enableTypingPref: true,
};
```

## TypeScript Types

### Core Types

```tsx
interface ComposerBaseProps {
  placeholder?: string;
  maxLength?: number;
  showCharacterCount?: boolean;
  showToolbar?: boolean;
  showMediaUpload?: boolean;
  disabled?: boolean;
  onContentChange?: (content: SerializedEditorState) => void;
  onSubmit?: (content: SerializedEditorState) => void;
  onCancel?: () => void;
}

interface MediaUpload {
  id: string;
  file: File;
  url?: string;
  type: "image" | "video";
  progress: number;
  status: "uploading" | "completed" | "error";
  error?: string;
}
```

## Styling

The composer system uses Tailwind CSS and follows your design system:

- **Consistent spacing**: Uses design token spacing
- **Theme integration**: Respects light/dark mode
- **Responsive**: Works on all screen sizes
- **Customizable**: Easy to override styles

## Accessibility

- **Keyboard navigation**: Full keyboard support
- **Screen readers**: Proper ARIA labels and roles
- **Focus management**: Logical tab order
- **Error states**: Clear error messaging

## Performance

- **Optimized rendering**: Minimal re-renders
- **Lazy loading**: Components load on demand
- **Memory management**: Proper cleanup of uploads
- **Debounced updates**: Efficient content change handling

## Future Enhancements

### Planned Features

- **Mention autocomplete**: @user suggestions
- **Hashtag highlighting**: #tag styling
- **Link previews**: Rich link cards
- **Voice input**: Speech-to-text
- **Draft saving**: Auto-save drafts
- **Scheduled posts**: Post scheduling

### Plugin System

- **Custom plugins**: Easy to add new features
- **Plugin marketplace**: Share plugins
- **Configuration UI**: Visual plugin configuration

## Contributing

1. **Follow the architecture**: Use primitives and compose components
2. **Type safety**: All new features must be typed
3. **Accessibility**: Test with screen readers
4. **Performance**: Profile for performance impact
5. **Documentation**: Update this README

## Demo

Visit `/editor-00` to see all composer components in action with interactive examples.

## Dependencies

- **Lexical**: Rich text editor framework
- **Frimousse**: Emoji picker component
- **Lucide React**: Icon library
- **Tailwind CSS**: Styling framework
- **TypeScript**: Type safety
