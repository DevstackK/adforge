import { PageHeading } from "@/components/page-heading";
import { MediaStudio } from "@/features/editor/media-studio";
import { ImageTemplateEditor } from "@/features/editor/image-template";
import { AssetLibrary } from "@/features/editor/asset-library";
export default function Page() {
  return (
    <>
      <PageHeading
        eyebrow="Visual forge"
        title="Image studio"
        description="Generate and transform product creative for every feed, story and carousel placement."
      />
      <ImageTemplateEditor />
      <MediaStudio mode="image" />
      <AssetLibrary types={["IMAGE", "LOGO", "FONT"]} />
    </>
  );
}
