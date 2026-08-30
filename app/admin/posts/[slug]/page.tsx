import { notFound } from "next/navigation";
import { getCategories, getEditablePost } from "@/lib/queries/admin";
import { PostEditor } from "@/components/admin/PostEditor";

export default async function EditPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [post, categories] = await Promise.all([getEditablePost(slug), getCategories()]);
  if (!post) notFound();
  return <PostEditor post={post} categories={categories} />;
}
