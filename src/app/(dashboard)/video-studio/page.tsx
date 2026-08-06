import { PageHeading } from "@/components/page-heading";
import { MediaStudio } from "@/features/editor/media-studio";
import { VideoTimeline } from "@/features/editor/video-timeline";
import { AssetLibrary } from "@/features/editor/asset-library";
export default function Page() {
  return (
    <>
      <PageHeading
        eyebrow="Motion forge"
        title="Video studio"
        description="Build UGC, slideshow, avatar and showcase ads with scenes, voice, captions and production-safe exports."
      />
      <VideoTimeline />
      <MediaStudio mode="video" />
      <AssetLibrary types={["VIDEO", "AUDIO", "IMAGE"]} />
    </>
  );
}
