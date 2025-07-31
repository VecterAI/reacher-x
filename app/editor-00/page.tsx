"use client";

import { useState } from "react";
import { SerializedEditorState } from "lexical";
import {
  BaseComposer,
  ReplyComposer,
  NoteComposer,
} from "@/features/composer/ui/components";
import { Tweet } from "@/features/threads/types";

// Mock data for demo
const mockTweet: Tweet = {
  id_str: "123456789",
  full_text: "This is a mock tweet for demonstration purposes",
  user: {
    id: 123456,
    id_str: "123456",
    screen_name: "mockuser",
    name: "Mock User",
    profile_image_url_https: "https://via.placeholder.com/40",
    protected: false,
    verified: false,
    followers_count: 1000,
    friends_count: 500,
    listed_count: 50,
    favourites_count: 200,
    statuses_count: 100,
    created_at: "2020-01-01T00:00:00.000Z",
    can_dm: false,
  },
  tweet_created_at: new Date().toISOString(),
};

const mockUser = {
  name: "Demo User",
  screenName: "demouser",
  profileImageUrl: "https://via.placeholder.com/40",
};

export default function ComposerDemoPage() {
  const [, setReplyContent] = useState<SerializedEditorState | undefined>(
    undefined
  );
  const [, setNoteContent] = useState<SerializedEditorState | undefined>(
    undefined
  );
  const [, setBaseContent] = useState<SerializedEditorState | undefined>(
    undefined
  );

  const handleReplySubmit = async (content: SerializedEditorState) => {
    console.log("Reply submitted:", content);
    // Here you would typically send the reply to your backend
    alert("Reply submitted successfully!");
  };

  const handleNoteSubmit = async (content: SerializedEditorState) => {
    console.log("Note submitted:", content);
    // Here you would typically save the note to your backend
    alert("Note added successfully!");
  };

  const handleBaseSubmit = async (content: SerializedEditorState) => {
    console.log("Post submitted:", content);
    // Here you would typically post to your backend
    alert("Post submitted successfully!");
  };

  return (
    <div className="container mx-auto space-y-8 p-6">
      <div className="text-center">
        <h1 className="mb-2 text-3xl font-bold">Composer Components Demo</h1>
        <p className="text-muted-foreground">
          Demonstrating the different composer components for your X-like
          application
        </p>
      </div>

      <div className="mx-auto grid max-w-2xl gap-8">
        {/* Base Composer */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Base Composer</h2>
          <p className="text-sm text-muted-foreground">
            The foundational composer component with basic functionality
          </p>
          <BaseComposer
            currentUser={mockUser}
            placeholder="What's happening?"
            onContentChange={setBaseContent}
            onSubmit={handleBaseSubmit}
            onCancel={() => setBaseContent(undefined)}
          />
        </div>

        {/* Reply Composer */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Reply Composer</h2>
          <p className="text-sm text-muted-foreground">
            Composer for replying to tweets with reply context
          </p>
          <ReplyComposer
            replyTo={{
              tweet: mockTweet,
              users: [
                { screenName: "mockuser", name: "Mock User" },
                { screenName: "anotheruser", name: "Another User" },
              ],
            }}
            currentUser={mockUser}
            placeholder="Post your reply"
            onContentChange={setReplyContent}
            onSubmit={handleReplySubmit}
            onCancel={() => setReplyContent(undefined)}
          />
        </div>

        {/* Note Composer */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Note Composer</h2>
          <p className="text-sm text-muted-foreground">
            Composer for adding notes to your application
          </p>
          <NoteComposer
            noteId="1"
            currentUser={mockUser}
            placeholder="Add your note..."
            onContentChange={setNoteContent}
            onSubmit={handleNoteSubmit}
            onCancel={() => setNoteContent(undefined)}
          />
        </div>
      </div>

      {/* Features Overview */}
      <div className="mx-auto mt-12 max-w-4xl">
        <h2 className="mb-6 text-center text-2xl font-bold">Features</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border p-4">
            <h3 className="mb-2 font-semibold">Rich Text Editor</h3>
            <p className="text-sm text-muted-foreground">
              Powered by Lexical with support for bold, italic, and more
              formatting options
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="mb-2 font-semibold">Media Upload</h3>
            <p className="text-sm text-muted-foreground">
              Upload images and videos with progress indicators and preview
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="mb-2 font-semibold">Character Count</h3>
            <p className="text-sm text-muted-foreground">
              Real-time character counting with X&apos;s 280 character limit
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="mb-2 font-semibold">Emoji Picker</h3>
            <p className="text-sm text-muted-foreground">
              Integrated emoji picker using Frimousse for easy emoji insertion
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="mb-2 font-semibold">Composable Design</h3>
            <p className="text-sm text-muted-foreground">
              Built with reusable primitives for easy customization and
              extension
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="mb-2 font-semibold">TypeScript Support</h3>
            <p className="text-sm text-muted-foreground">
              Fully typed components with comprehensive TypeScript definitions
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
