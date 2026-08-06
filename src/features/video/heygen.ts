type HeyGenEnvelope = {
  error?: { message?: string } | string | null;
  data?: {
    video_id?: string;
    status?: "pending" | "waiting" | "processing" | "completed" | "failed";
    video_url?: string;
    error?: string;
  };
};

export type TalkingAvatarInput = {
  avatarId: string;
  voiceId: string;
  script: string;
  format: string;
  title: string;
};

export async function generateTalkingAvatar(
  input: TalkingAvatarInput,
  apiKey: string,
  dependencies: {
    fetch?: typeof fetch;
    wait?: (milliseconds: number) => Promise<void>;
    validateDownloadUrl?: (url: string) => Promise<void>;
    timeoutMs?: number;
  } = {},
) {
  const request = dependencies.fetch ?? fetch;
  const wait =
    dependencies.wait ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  async function json(url: string, init?: RequestInit) {
    const response = await request(url, {
      ...init,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      signal: AbortSignal.timeout(30_000),
    });
    const payload = (await response.json()) as HeyGenEnvelope;
    if (!response.ok || payload.error)
      throw new Error(
        typeof payload.error === "string"
          ? payload.error
          : (payload.error?.message ??
              `HeyGen request failed (${response.status})`),
      );
    return payload;
  }
  const dimension =
    input.format === "landscape"
      ? { width: 1280, height: 720 }
      : input.format === "square"
        ? { width: 1080, height: 1080 }
        : { width: 720, height: 1280 };
  const created = await json("https://api.heygen.com/v2/video/generate", {
    method: "POST",
    body: JSON.stringify({
      video_inputs: [
        {
          character: {
            type: "avatar",
            avatar_id: input.avatarId,
            avatar_style: "normal",
          },
          voice: {
            type: "text",
            input_text: input.script.slice(0, 4999),
            voice_id: input.voiceId,
            speed: 1,
          },
        },
      ],
      dimension,
      caption: true,
      title: input.title,
    }),
  });
  const videoId = created.data?.video_id;
  if (!videoId) throw new Error("HeyGen returned no video ID");
  const deadline = Date.now() + (dependencies.timeoutMs ?? 20 * 60_000);
  while (Date.now() < deadline) {
    const status = await json(
      `https://api.heygen.com/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`,
    );
    if (status.data?.status === "failed")
      throw new Error(status.data.error ?? "HeyGen video generation failed");
    if (status.data?.status === "completed" && status.data.video_url) {
      await dependencies.validateDownloadUrl?.(status.data.video_url);
      const response = await request(status.data.video_url, {
        redirect: "error",
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) throw new Error("HeyGen video download failed");
      const declared = Number(response.headers.get("content-length") ?? 0);
      if (declared > 500_000_000)
        throw new Error("HeyGen video exceeds 500 MB");
      const body = Buffer.from(await response.arrayBuffer());
      if (body.byteLength > 500_000_000)
        throw new Error("HeyGen video exceeds 500 MB");
      return { body, videoId };
    }
    await wait(5_000);
  }
  throw new Error("HeyGen video generation timed out after 20 minutes");
}
