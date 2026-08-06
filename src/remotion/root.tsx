import { Composition, type CalculateMetadataFunction } from "remotion";
import { AdVideo, type AdVideoProps } from "./ad-video";

const defaults: AdVideoProps = {
  title: "AdForge video",
  format: "story",
  brand: { primary: "#ff5a36", background: "#111827", foreground: "#ffffff" },
  scenes: [
    {
      durationSeconds: 4,
      script: "Turn product truth into creative that performs.",
      caption: "Forged with AdForge AI",
      transition: "fade",
    },
  ],
};
const calculate: CalculateMetadataFunction<AdVideoProps> = ({ props }) => {
  const dimensions =
    props.format === "square"
      ? [1080, 1080]
      : props.format === "landscape"
        ? [1920, 1080]
        : [1080, 1920];
  return {
    width: dimensions[0],
    height: dimensions[1],
    durationInFrames: Math.max(
      30,
      Math.ceil(
        props.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0) *
          30,
      ),
    ),
    fps: 30,
    props,
  };
};
export function RemotionRoot() {
  return (
    <Composition
      id="AdForgeVideo"
      component={AdVideo}
      durationInFrames={120}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={defaults}
      calculateMetadata={calculate}
    />
  );
}
