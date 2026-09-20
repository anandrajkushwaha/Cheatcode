import { notFound } from "next/navigation";
import { getCategories, getEditablePost } from "@/lib/queries/admin";
import { PostEditor } from "@/components/admin/PostEditor";
import { currentAdmin } from "@/lib/admin/guard";

export default async function EditPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [post, categories] = await Promise.all([getEditablePost(slug), getCategories()]);
  if (!post) notFound();
  const session = await currentAdmin();

  return (
    <PostEditor
      post={post}
      categories={categories}
      canDelete={session?.role === "owner"}
    />
  );
}
