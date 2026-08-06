import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type AdScene = {
  id?: string;
  durationSeconds: number;
  script: string;
  caption?: string;
  background?: string;
  backgroundType?: "IMAGE" | "VIDEO";
  transition?: "fade" | "slide" | "zoom";
};
export type AdVideoProps = {
  title: string;
  scenes: AdScene[];
  brand: { primary: string; background: string; foreground: string };
  format: "square" | "portrait" | "landscape" | "story";
};

function Scene({
  scene,
  brand,
}: {
  scene: AdScene;
  brand: AdVideoProps["brand"];
}) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const exit = interpolate(
    frame,
    [durationInFrames - fps * 0.4, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" },
  );
  const scale =
    scene.transition === "zoom"
      ? interpolate(frame, [0, durationInFrames], [1.08, 1], {
          extrapolateRight: "clamp",
        })
      : 1;
  const x =
    scene.transition === "slide" ? interpolate(enter, [0, 1], [120, 0]) : 0;
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg,${brand.background},${brand.primary})`,
        color: brand.foreground,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "9%",
        opacity: Math.min(enter, exit),
        transform: `translateX(${x}px) scale(${scale})`,
      }}
    >
      {scene.background && (
        <AbsoluteFill>
          {scene.backgroundType === "VIDEO" ? (
            <OffthreadVideo
              src={scene.background}
              volume={0}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <Img
              src={scene.background}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          )}
          <AbsoluteFill style={{ background: "rgba(8,10,16,.48)" }} />
        </AbsoluteFill>
      )}
      <div style={{ maxWidth: 900, textAlign: "center", zIndex: 1 }}>
        <div
          style={{
            height: 8,
            width: 90,
            borderRadius: 99,
            background: brand.primary,
            margin: "0 auto 42px",
          }}
        />
        <div
          style={{
            fontFamily: "Arial, sans-serif",
            fontSize: 72,
            lineHeight: 1.04,
            fontWeight: 900,
            letterSpacing: -3,
          }}
        >
          {scene.script}
        </div>
        {scene.caption && (
          <div
            style={{
              marginTop: 38,
              display: "inline-block",
              borderRadius: 18,
              background: "rgba(0,0,0,.6)",
              padding: "14px 24px",
              fontFamily: "Arial, sans-serif",
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            {scene.caption}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}

export function AdVideo({ scenes, brand }: AdVideoProps) {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: "#111827" }}>
      {scenes.map((scene, index) => {
        const start = scenes
          .slice(0, index)
          .reduce(
            (sum, item) =>
              sum + Math.max(1, Math.round(item.durationSeconds * fps)),
            0,
          );
        const duration = Math.max(1, Math.round(scene.durationSeconds * fps));
        return (
          <Sequence
            key={scene.id ?? index}
            from={start}
            durationInFrames={duration}
          >
            <Scene scene={scene} brand={brand} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
