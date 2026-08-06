import { describe, expect, it, vi } from "vitest";
import { generateTalkingAvatar } from "@/features/video/heygen";

describe("HeyGen video adapter", () => {
  it("creates, polls, validates, and downloads a talking-avatar video", async () => {
    const responses = [
      Response.json({ error: null, data: { video_id: "video_123" } }),
      Response.json({ error: null, data: { status: "processing" } }),
      Response.json({
        error: null,
        data: {
          status: "completed",
          video_url: "https://files.heygencdn.com/video.mp4",
        },
      }),
      new Response(new Uint8Array([0, 1, 2, 3]), {
        status: 200,
        headers: { "content-length": "4", "content-type": "video/mp4" },
      }),
    ];
    const request = vi.fn(
      async (url: string | URL | Request, init?: RequestInit) => {
        void url;
        void init;
        return responses.shift()!;
      },
    );
    const validateDownloadUrl = vi.fn(async () => undefined);
    const result = await generateTalkingAvatar(
      {
        avatarId: "avatar_123",
        voiceId: "voice_123",
        script: "A truthful product introduction",
        format: "story",
        title: "AdForge test",
      },
      "test-key",
      {
        fetch: request as unknown as typeof fetch,
        wait: async () => undefined,
        validateDownloadUrl,
      },
    );
    expect(result.videoId).toBe("video_123");
    expect(result.body.byteLength).toBe(4);
    expect(request).toHaveBeenCalledTimes(4);
    expect(validateDownloadUrl).toHaveBeenCalledWith(
      "https://files.heygencdn.com/video.mp4",
    );
    const createBody = JSON.parse(String(request.mock.calls[0]?.[1]?.body)) as {
      video_inputs: Array<{ character: { avatar_id: string } }>;
    };
    expect(createBody.video_inputs[0]?.character.avatar_id).toBe("avatar_123");
  });
});
